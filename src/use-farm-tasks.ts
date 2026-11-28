import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readSnapshot, saveSnapshot } from './offline';
import { dateInFarmTime, taskKey, taskSeriesKey, type FarmTask, type TaskCategory, type TaskAssignment, type TaskTemplate, type TaskTemplateValues } from './task-model';

type TaskSnapshot = { today: string; rows: FarmTask[]; savedAt?: number; farmCounts?: Partial<Record<TaskCategory,number>>; farmDoneToday?: number };
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
      const { data, error } = await db.rpc('list_farm_tasks_340', { p_farm_id: farmId });
      if (error) throw error;
      const snapshot = data as TaskSnapshot | null;
      if (!snapshot?.today || !Array.isArray(snapshot.rows)) throw new Error('Ungültige Antwort des Servers.');
      if (taskRequest.current !== request || activeScope.current !== scope) return;
      setState({ scope, snapshot: {...snapshot,savedAt:Date.now()}, loading: false, error: '' });
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
          snapshot: {...snapshot,savedAt:snapshot.savedAt??cached?.savedAt},
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

  async function loadMore(category: TaskCategory) {
    const {db,farmId}=assertWrite();
    const loaded=snapshot?.rows.filter(r=>r.source==='farm'&&r.category===category)??[];
    const last=loaded[loaded.length-1];
    if(!last?.assignment_id) return;
    const request=taskRequest.current;
    const {data,error}=await db.rpc('list_farm_tasks_340',{p_farm_id:farmId,p_category:category,p_after_due:last.due_date,p_after_order:last.assignment_id,p_after_occurrence:last.occurrence});
    if(error) throw new Error(taskError(error));
    const page=data as TaskSnapshot;
    if(activeScope.current!==scope||taskRequest.current!==request||page.today!==snapshot?.today) throw new Error('Aufgabenstand geändert. Bitte erneut laden.');
    setState(old=>{if(old.scope!==scope||!old.snapshot)return old;const rows=new Map(old.snapshot.rows.map(r=>[taskKey(r),r]));for(const r of page.rows)rows.set(taskKey(r),r);return {...old,snapshot:{...old.snapshot,rows:[...rows.values()],farmCounts:page.farmCounts,farmDoneToday:page.farmDoneToday}};});
  }

  async function create(assignment: TaskAssignment) {
    const { db, farmId } = assertWrite();
    const {requestId, ...payload} = assignment;
    const pendingKey = `calfmanager:pending-work:${scope}:${JSON.stringify(payload)}`;
    // Keep an ambiguous request across dialog closure and reload. Fail closed if storage fails.
    const durableId = assignment.farmWide ? (sessionStorage.getItem(pendingKey) || requestId || crypto.randomUUID()) : requestId;
    if (assignment.farmWide && durableId) sessionStorage.setItem(pendingKey, durableId);
    const { data, error } = await db.rpc(assignment.farmWide ? 'create_farm_work_340' : 'create_farm_tasks_322', {
      p_farm_id: farmId,
      ...(!assignment.farmWide ? {p_calf_ids: assignment.calfIds} : {}),
      p_template_id: assignment.templateId,
      p_name: assignment.name,
      p_recurring: assignment.recurring,
      p_times_per_day: assignment.timesPerDay,
      p_start_date: assignment.startDate,
      p_end_date: assignment.endDate,
      p_notes: assignment.notes,
      p_request_id: durableId,
    });
    if (error) throw new Error(taskError(error));
    if (assignment.farmWide) sessionStorage.removeItem(pendingKey);
    recordChange();
    return Number(data);
  }

  async function complete(rows: FarmTask[]) {
    const { db, farmId } = assertWrite();
    if (rows.some(row => row.source === 'farm')) {
      if (rows.length !== 1) throw new Error('Betriebsaufgaben einzeln bestätigen.');
      const row = rows[0];
      const {data,error} = await db.rpc('complete_farm_work_340',{p_farm_id:farmId,p_order_id:row.assignment_id,p_due_date:row.due_date,p_occurrence:row.occurrence});
      if(error) throw new Error(taskError(error));
      recordChange(); return Number(data);
    }
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
    if(row.source === 'farm'){
      const {error}=await db.rpc('end_farm_work_340',{p_farm_id:farmId,p_order_id:row.assignment_id});
      if(error) throw new Error(taskError(error)); recordChange(); return;
    }
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
    scope,
    farmCounts: snapshot?.farmCounts,
    farmDoneToday: snapshot?.farmDoneToday,
    loadMore,
    savedAt: current?.snapshot?.savedAt??null,
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
    history: async (before?: {completed_at:string;order_id:string;due_date:string;occurrence:number}) => { const {db,farmId}=assertWrite(); const {data,error}=await db.rpc('farm_work_history_page_340',{p_farm_id:farmId,p_before:before?.completed_at??null,p_order:before?.order_id??null,p_due:before?.due_date??null,p_occurrence:before?.occurrence??null}); if(error) throw new Error(taskError(error)); if(activeScope.current!==scope) throw new Error('Betrieb gewechselt.'); return data as {order_id:string;name:string;due_date:string;occurrence:number;completed_at:string;completed_by_name:string}[]; },
    saveTemplate,
    setTemplateActive,
  };
}

export type FarmTasks = ReturnType<typeof useFarmTasks>;
