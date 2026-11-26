export const maximumDailyTasks = 24;
export const maximumTaskDays = 3660;

export type TaskCategory = 'today' | 'overdue' | 'planned' | 'completed';
export type TaskSource = 'assignment' | 'legacy' | 'followup' | 'vaccination';

export type FarmTask = {
  source: TaskSource;
  assignment_id: string | null;
  event_id: string | null;
  group_id: string | null;
  calf_id: string;
  ear_tag: string;
  box_id: string | null;
  name: string;
  notes: string | null;
  due_date: string;
  occurrence: number | null;
  times_per_day: number | null;
  treatment_day: number | null;
  treatment_days: number | null;
  completed_at: string | null;
  completed_on?: string | null;
  completed_by: string | null;
  completed_by_name: string | null;
  category: TaskCategory;
  is_treatment: boolean;
  can_end: boolean;
  priority?: string | null;
};

export type TaskTemplateValues = {
  name: string;
  description: string | null;
  recurring: boolean;
  times_per_day: number;
  duration_days: number | null;
};

export type TaskTemplate = TaskTemplateValues & {
  id: string;
  farm_id: string;
  active: boolean;
};

export type TaskAssignment = {
  calfIds: string[];
  templateId: string | null;
  name: string;
  recurring: boolean;
  timesPerDay: number;
  startDate: string;
  endDate: string | null;
  notes: string | null;
  requestId?: string;
};

export type TaskCalf = {
  id: string;
  ear_tag: string;
  name?: string | null;
  box_id?: string | null;
  archived_at?: string | null;
  status: string;
};

export type TaskBox = { id: string; name: string };

export function dateInFarmTime(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function addTaskDays(date: string, days: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(days)) return '';
  const utc = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(utc.getTime()) || utc.toISOString().slice(0, 10) !== date) return '';
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().split('T')[0];
}

export function taskDurationDays(startDate: string, endDate: string) {
  if (!addTaskDays(startDate, 0) || !addTaskDays(endDate, 0)) return NaN;
  return (Date.parse(endDate) - Date.parse(startDate)) / 86_400_000 + 1;
}

export function isActiveTaskCalf(calf: TaskCalf) {
  return calf.status === 'active' && !calf.archived_at;
}

export function countDueTasks(rows: FarmTask[]) {
  return rows.filter(row => row.category === 'today' || row.category === 'overdue').length;
}

type LegacyTaskEvent = {
  id: string;
  calf_id: string;
  kind: string;
  details: string;
  event_date: string;
  due_date?: string | null;
  task_status?: string | null;
  priority?: string | null;
};

/** Compatibility for offline devices with a snapshot from before 3.2.2. */
export function cachedLegacyTasks(events: LegacyTaskEvent[], calves: TaskCalf[], today: string): FarmTask[] {
  const active = new Map(calves.filter(isActiveTaskCalf).map(calf => [calf.id, calf]));
  return events.flatMap(event => {
    const calf = active.get(event.calf_id);
    if (!calf || event.kind !== 'task' || ['done', 'cancelled', 'canceled', 'ended'].includes(event.task_status ?? '')) return [];
    const date = event.due_date || event.event_date;
    return [{
      source: 'legacy', assignment_id: null, event_id: event.id, group_id: null,
      calf_id: calf.id, ear_tag: calf.ear_tag, box_id: calf.box_id ?? null,
      name: event.details.replace(/^\[(AUTO-GESUNDHEIT|BEHANDLUNG:[^\]]*)\]\s*/, '').trim() || 'Aufgabe',
      notes: null, due_date: date, occurrence: null, times_per_day: null, treatment_day: null, treatment_days: null,
      completed_at: null, completed_by: null, completed_by_name: null,
      category: date < today ? 'overdue' : date === today ? 'today' : 'planned',
      is_treatment: event.details.startsWith('[BEHANDLUNG:'), can_end: false, priority: event.priority,
    }];
  });
}

export function taskKey(row: FarmTask) {
  return row.assignment_id
    ? `assignment:${row.assignment_id}:${row.due_date}:${row.occurrence}`
    : `${row.source}:${row.event_id}`;
}

export function taskSeriesKey(row: FarmTask) {
  return row.assignment_id ?? `${row.source}:${row.event_id}`;
}

const sortGerman = new Intl.Collator('de', { numeric: true });
const unknownBoxName = 'Box (Name nicht verfügbar)';

export function taskCalfGroups(calves: TaskCalf[], boxes: TaskBox[]) {
  const groups = boxes.map(box => ({ ...box, calves: [] as TaskCalf[] }));
  const withoutBox = { id: '', name: 'Ohne Box', calves: [] as TaskCalf[] };
  const byId = new Map(groups.map(group => [group.id, group]));
  for (const calf of calves.filter(isActiveTaskCalf)) {
    if (!calf.box_id) {
      withoutBox.calves.push(calf);
      continue;
    }
    const group = byId.get(calf.box_id);
    if (group) {
      group.calves.push(calf);
      continue;
    }
    const unlisted = { id: calf.box_id, name: unknownBoxName, calves: [calf] };
    byId.set(unlisted.id, unlisted);
    groups.push(unlisted);
  }
  for (const group of [...groups, withoutBox]) {
    group.calves.sort((a, b) => sortGerman.compare(a.ear_tag, b.ear_tag));
  }
  return withoutBox.calves.length ? [...groups, withoutBox] : groups;
}

export function tasksByBox(rows: FarmTask[], boxes: TaskBox[]) {
  const names = new Map(boxes.map(box => [box.id, box.name]));
  const groups = new Map<string, { id: string; name: string; rows: FarmTask[] }>();
  for (const row of rows) {
    const id = row.box_id ?? '';
    const group = groups.get(id) ?? { id, name: id ? names.get(id) ?? unknownBoxName : 'Ohne Box', rows: [] };
    group.rows.push(row);
    groups.set(id, group);
  }
  return [...groups.values()].sort((a, b) => Number(!a.id) - Number(!b.id) || sortGerman.compare(a.name, b.name));
}

export function taskWorkGroups(rows: FarmTask[]) {
  const groups = new Map<string, FarmTask[]>();
  const ordered = [...rows].sort((a, b) =>
    Number(b.priority === 'urgent') - Number(a.priority === 'urgent')
    || a.due_date.localeCompare(b.due_date)
    || sortGerman.compare(a.name, b.name)
    || (a.occurrence ?? 0) - (b.occurrence ?? 0)
    || sortGerman.compare(a.ear_tag, b.ear_tag));
  for (const row of ordered) {
    const key = row.group_id && row.category !== 'completed'
      ? JSON.stringify([row.group_id, row.due_date, row.occurrence])
      : taskKey(row);
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  return [...groups.entries()].map(([key, rows]) => ({ key, rows }));
}
