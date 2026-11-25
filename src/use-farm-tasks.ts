import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readSnapshot, saveSnapshot } from './offline';
import { dateInFarmTime, taskKey, taskSeriesKey, type FarmTask, type TaskAssignment, type TaskTemplate, type TaskTemplateValues } from './task-model';

type TaskSnapshot = { today: string; rows: FarmTask[] };
type TaskState = { scope: string; snapshot?: TaskSnapshot; loading: boolean; error: string };
type TemplateState = { scope: string; templates: TaskTemplate[]; loading: boolean; error: string };

function taskError(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error) return String(error.message);
  return 'Unbekannter Fehler. Bitte erneut versuchen.';
}

export function useFarmTasks(
  db: SupabaseClient | null,
  farmId: string | undefined,
  online: boolean,
  userId?: string,
) {
  const scope = farmId && userId ? `${userId}:${farmId}` : '';
  const cacheKey = farmId ? `__tasks__:${farmId}` : '';
  const [state, setState] = useState<TaskState>({ scope: '', loading: false, error: '' });
  const [templateState, setTemplateState] = useState<TemplateState>({ scope: '', templates: [], loading: false, error: '' });
  const [revision, setRevision] = useState(0);
  const activeScope = useRef(scope);
  const taskRequest = useRef(0);
  const templateRequest = useRef(0);
  activeScope.current = scope;

  const refresh = useCallback(async () => {
    if (!db || !farmId || !userId || !scope || activeScope.current !== scope || !online) return;
    const request = ++taskRequest.current;
    setState(previous => ({
      scope,
      snapshot: previous.scope === scope ? previous.snapshot : undefined,
      loading: true,
      error: '',
    }));
    try {
      const { data, error } = await db.rpc('list_farm_tasks_322', { p_farm_id: farmId });
      if (error) throw error;
      const snapshot = data as TaskSnapshot | null;
      if (!snapshot?.today || !Array.isArray(snapshot.rows)) throw new Error('Ungültige Antwort des Servers.');
      if (taskRequest.current !== request || activeScope.current !== scope) return;
      setState({ scope, snapshot, loading: false, error: '' });
    } catch (error) {
      if (taskRequest.current !== request || activeScope.current !== scope) return;
      setState(previous => ({ ...previous, scope, loading: false, error: taskError(error) }));
    }
  }, [db, farmId, userId, scope, online]);

  const refreshTemplates = useCallback(async () => {
    if (!db || !farmId || !scope || activeScope.current !== scope || !online) return;
    const request = ++templateRequest.current;
    setTemplateState(previous => ({
      scope,
      templates: previous.scope === scope ? previous.templates : [],
      loading: true,
      error: '',
    }));
    try {
      const { data, error } = await db.from('farm_task_templates_322')
        .select('id,farm_id,name,description,recurring,times_per_day,duration_days,active')
        .eq('farm_id', farmId)
        .order('name');
      if (error) throw error;
      if (templateRequest.current === request && activeScope.current === scope) {
        setTemplateState({ scope, templates: data ?? [], loading: false, error: '' });
      }
    } catch (error) {
      if (templateRequest.current === request && activeScope.current === scope) {
        setTemplateState(previous => ({ ...previous, scope, loading: false, error: taskError(error) }));
      }
    }
  }, [db, farmId, scope, online]);

  useEffect(() => {
    if (!scope || !userId) return;
    let current = true;
    void readSnapshot(userId, cacheKey).then(cached => {
      const snapshot = cached?.events[0] as TaskSnapshot | undefined;
      if (!current || activeScope.current !== scope || !snapshot?.today || !Array.isArray(snapshot.rows)) return;
      setState(previous => previous.scope === scope && previous.snapshot
        ? previous
        : {
          scope,
          snapshot,
          loading: previous.scope === scope && previous.loading,
          error: previous.scope === scope ? previous.error : '',
        });
    }).catch(() => undefined);
    return () => { current = false; };
  }, [cacheKey, scope, userId]);

  useEffect(() => {
    if (!scope || !online) return;
    void refresh();
    void refreshTemplates();
    const update = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const timer = window.setInterval(update, 60_000);
    document.addEventListener('visibilitychange', update);
    return () => {
      ++taskRequest.current;
      ++templateRequest.current;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
    };
  }, [scope, online, refresh, refreshTemplates]);

  const current = state.scope === scope ? state : undefined;
  const currentTemplates = templateState.scope === scope ? templateState : undefined;
  const snapshot = current?.snapshot;
  useEffect(() => {
    if (userId && cacheKey && snapshot) void saveSnapshot(userId, cacheKey, [], [snapshot]).catch(() => undefined);
  }, [userId, cacheKey, snapshot]);

  const assertWrite = () => {
    if (!db || !farmId || !scope || activeScope.current !== scope || !online || !navigator.onLine) {
      throw new Error('Aufgaben können nur online im ausgewählten Betrieb geändert werden.');
    }
    return { db, farmId };
  };

  const recordChange = (keep?: (row: FarmTask) => boolean) => {
    if (activeScope.current !== scope) return;
    ++taskRequest.current;
    if (keep) {
      setState(previous => previous.scope === scope && previous.snapshot
        ? { ...previous, snapshot: { ...previous.snapshot, rows: previous.snapshot.rows.filter(keep) } }
        : previous);
    }
    setRevision(value => value + 1);
    void refresh();
  };

  async function create(assignment: TaskAssignment) {
    const { db, farmId } = assertWrite();
    const { data, error } = await db.rpc('create_farm_tasks_322', {
      p_farm_id: farmId,
      p_calf_ids: assignment.calfIds,
      p_template_id: assignment.templateId,
      p_name: assignment.name,
      p_recurring: assignment.recurring,
      p_times_per_day: assignment.timesPerDay,
      p_start_date: assignment.startDate,
      p_end_date: assignment.endDate,
      p_notes: assignment.notes,
      p_request_id: assignment.requestId,
    });
    if (error) throw new Error(taskError(error));
    recordChange();
    return Number(data);
  }

  async function complete(rows: FarmTask[]) {
    const { db, farmId } = assertWrite();
    const { data, error } = await db.rpc('complete_farm_tasks_322', {
      p_farm_id: farmId,
      p_tasks: rows.map(row => ({
        source: row.source,
        assignment_id: row.assignment_id,
        event_id: row.event_id,
        due_date: row.due_date,
        occurrence: row.occurrence,
      })),
    });
    if (error) throw new Error(taskError(error));
    const keys = new Set(rows.map(taskKey));
    recordChange(row => row.category === 'completed' || !keys.has(taskKey(row)));
    return Number(data);
  }

  async function end(row: FarmTask) {
    const { db, farmId } = assertWrite();
    const { error } = await db.rpc('end_farm_task_322', {
      p_farm_id: farmId,
      p_assignment_id: row.assignment_id,
      p_event_id: row.event_id,
    });
    if (error) throw new Error(taskError(error));
    const series = taskSeriesKey(row);
    recordChange(task => task.category === 'completed' || taskSeriesKey(task) !== series);
  }

  async function saveTemplate(values: TaskTemplateValues, id?: string) {
    const { db, farmId } = assertWrite();
    const request = id
      ? db.from('farm_task_templates_322').update(values).eq('farm_id', farmId).eq('id', id)
      : db.from('farm_task_templates_322').insert({ ...values, farm_id: farmId });
    const { error } = await request.select('id').single();
    if (error) throw new Error(taskError(error));
    await refreshTemplates();
  }

  async function setTemplateActive(id: string, active: boolean) {
    const { db, farmId } = assertWrite();
    const { error } = await db.from('farm_task_templates_322')
      .update({ active }).eq('farm_id', farmId).eq('id', id).select('id').single();
    if (error) throw new Error(taskError(error));
    await refreshTemplates();
  }

  return {
    today: current?.snapshot?.today ?? dateInFarmTime(),
    rows: current?.snapshot?.rows ?? [],
    available: Boolean(current?.snapshot && scope),
    online,
    loading: online && Boolean(scope) && (!current || current.loading),
    error: online ? current?.error ?? '' : '',
    templates: currentTemplates?.templates ?? [],
    templatesLoading: online && Boolean(scope) && (!currentTemplates || currentTemplates.loading),
    templateError: online ? currentTemplates?.error ?? '' : '',
    revision,
    refresh,
    refreshTemplates,
    create,
    complete,
    end,
    saveTemplate,
    setTemplateActive,
  };
}

export type FarmTasks = ReturnType<typeof useFarmTasks>;
