import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Check, ChevronDown, Plus, X } from 'lucide-react';
import {
  addTaskDays, dateInFarmTime, isActiveTaskCalf, maximumDailyTasks, maximumTaskDays,
  taskCalfGroups, taskDurationDays, taskKey, tasksByBox, taskWorkGroups,
  type FarmTask, type TaskBox, type TaskCalf, type TaskCategory, type TaskTemplate,
} from './task-model';
import type { FarmTasks } from './use-farm-tasks';
import './tasks.css';

export { cachedLegacyTasks, countDueTasks, dateInFarmTime } from './task-model';
export type { FarmTask } from './task-model';
export { useFarmTasks } from './use-farm-tasks';
export type { FarmTasks } from './use-farm-tasks';

type TaskEdit = {
  name: string;
  recurring: boolean;
  times: string;
  duration: 'unlimited' | 'days' | 'date';
  days: string;
  notes: string;
};

function blankTask(): TaskEdit {
  return { name: '', recurring: false, times: '1', duration: 'unlimited', days: '7', notes: '' };
}

function taskFromTemplate(template: TaskTemplate): TaskEdit {
  return {
    name: template.name,
    recurring: template.recurring,
    times: String(template.times_per_day),
    duration: template.duration_days ? 'days' : 'unlimited',
    days: String(template.duration_days ?? 7),
    notes: template.description ?? '',
  };
}

function pluralCalves(count: number) {
  return `${count} ${count === 1 ? 'Kalb' : 'Kälber'}`;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Bitte erneut versuchen.';
}

function localDate(date: string) {
  return date.split('-').reverse().join('.');
}

const completionFormat = new Intl.DateTimeFormat('de-DE', {
  dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Berlin',
});

function TaskTiming({ edit, setEdit, dates }: {
  edit: TaskEdit;
  setEdit: (edit: TaskEdit) => void;
  dates?: { start: string; end: string; setEnd: (end: string) => void };
}) {
  const end = dates && edit.duration === 'days'
    ? addTaskDays(dates.start, Number(edit.days) - 1)
    : '';
  return <>
    <label>Aufgabenart
      <select value={edit.recurring ? 'repeat' : 'once'} onChange={event => setEdit({ ...edit, recurring: event.target.value === 'repeat' })}>
        <option value="once">Einmalige Aufgabe</option>
        <option value="repeat">Serienaufgabe (täglich)</option>
      </select>
    </label>
    {edit.recurring && <>
      <label>Durchführungen pro Tag
        <input type="number" value={edit.times} min={1} max={maximumDailyTasks} required
          onChange={event => setEdit({ ...edit, times: event.target.value })}/>
      </label>
      <label>Dauer
        <select value={edit.duration} onChange={event => {
          const duration = event.target.value as TaskEdit['duration'];
          if (duration === 'date' && dates && !dates.end) dates.setEnd(end || dates.start);
          setEdit({ ...edit, duration });
        }}>
          <option value="unlimited">Bis zur Beendigung</option>
          <option value="days">Feste Anzahl Tage</option>
          {dates && <option value="date">Bis zu einem Enddatum</option>}
        </select>
      </label>
      {edit.duration === 'days' && <label>Dauer in Tagen
        <input type="number" value={edit.days} min={1} max={maximumTaskDays} required
          onChange={event => setEdit({ ...edit, days: event.target.value })}/>
        {edit.days !== '' && end && <span className="task-help">Bis einschließlich {localDate(end)}</span>}
      </label>}
      {edit.duration === 'date' && dates && <label>Enddatum
        <input type="date" value={dates.end} min={dates.start || undefined}
          max={addTaskDays(dates.start, maximumTaskDays - 1) || undefined} required
          onChange={event => dates.setEnd(event.target.value)}/>
      </label>}
    </>}
  </>;
}

function TaskCheckbox({ label, checked, partial, disabled, onChange }: {
  label: ReactNode;
  checked: boolean;
  partial?: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return <label className="task-check">
    <input type="checkbox" checked={checked} disabled={disabled} onChange={onChange}
      ref={input => { if (input) input.indeterminate = Boolean(partial); }}/>
    {label}
  </label>;
}

function GroupCalfPicker({ calves, boxes, selected, setSelected }: {
  calves: TaskCalf[];
  boxes: TaskBox[];
  selected: Set<string>;
  setSelected: (ids: Set<string>) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const id = useId();
  const groups = taskCalfGroups(calves, boxes);
  function toggle(ids: string[]) {
    const next = new Set(selected);
    const allSelected = ids.every(calfId => next.has(calfId));
    ids.forEach(calfId => allSelected ? next.delete(calfId) : next.add(calfId));
    setSelected(next);
  }
  function toggleBox(boxId: string) {
    const next = new Set(expanded);
    if (next.has(boxId)) next.delete(boxId);
    else next.add(boxId);
    setExpanded(next);
  }
  return <fieldset className="task-picker">
    <legend>Kälber auswählen</legend>
    <output className="task-selection" aria-live="polite">{pluralCalves(selected.size)} ausgewählt</output>
    {groups.map(group => {
      const ids = group.calves.map(calf => calf.id);
      const checked = ids.filter(calfId => selected.has(calfId)).length;
      const open = expanded.has(group.id);
      const bodyId = `${id}-${group.id}`;
      return <div className="task-box" key={group.id}>
        <div className="task-box-heading">
          <TaskCheckbox label={<><strong>{group.name}</strong><small>{pluralCalves(ids.length)}</small></>}
            checked={ids.length > 0 && checked === ids.length} partial={checked > 0 && checked < ids.length}
            disabled={!ids.length} onChange={() => toggle(ids)}/>
          <button className="task-icon-button" type="button" disabled={!ids.length} aria-expanded={open}
            aria-controls={bodyId} aria-label={`${group.name} ${open ? 'einklappen' : 'aufklappen'}`}
            onClick={() => toggleBox(group.id)}><ChevronDown size={20}/></button>
        </div>
        <div id={bodyId} className="task-picker-calves" hidden={!open}>
          {open && group.calves.map(calf => <TaskCheckbox key={calf.id}
            label={<>{calf.ear_tag}{calf.name && <small>{calf.name}</small>}</>}
            checked={selected.has(calf.id)} onChange={() => toggle([calf.id])}/>)}
        </div>
      </div>;
    })}
    {!groups.some(group => group.calves.length) && <p className="task-help">Es sind keine aktiven Kälber vorhanden.</p>}
  </fieldset>;
}

export function TaskAssignmentForm({ tasks, calf, calves = [], boxes = [], onClose, onCreated, initialFarmWide = false }: {
  tasks: FarmTasks;
  initialFarmWide?: boolean;
  calf?: TaskCalf;
  calves?: TaskCalf[];
  boxes?: TaskBox[];
  onClose: () => void;
  onCreated: (count: number) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const labelId = useId();
  const submitting = useRef(false);
  const request = useRef<{ signature: string; id: string }>();
  const [farmWide,setFarmWide] = useState(initialFarmWide);
  const [selected, setSelected] = useState(() => new Set<string>());
  const [templateId, setTemplateId] = useState('');
  const [edit, setEdit] = useState(blankTask);
  const [start, setStart] = useState(() => dateInFarmTime());
  const [end, setEnd] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const choices = tasks.templates.filter(template => template.active);
  const eligibleSelection = new Set(calves.filter(item => selected.has(item.id) && isActiveTaskCalf(item)).map(item => item.id));

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  function chooseTemplate(id: string) {
    setTemplateId(id);
    const template = choices.find(choice => choice.id === id);
    setEdit(template ? taskFromTemplate(template) : blankTask());
    setEnd('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const calfIds = calf ? [calf.id] : [...eligibleSelection].sort();
    if (!farmWide && !calfIds.length) {
      setNotice('Bitte mindestens ein Kalb auswählen.');
      return;
    }
    if (!edit.name.trim()) {
      setNotice('Bitte eine Aufgabenbezeichnung eingeben.');
      return;
    }
    const endDate = !edit.recurring || edit.duration === 'unlimited' ? null
      : edit.duration === 'days' ? addTaskDays(start, Number(edit.days) - 1) : end;
    if (endDate && !(taskDurationDays(start, endDate) >= 1 && taskDurationDays(start, endDate) <= maximumTaskDays)) {
      setNotice('Bitte ein gültiges Enddatum ab dem Beginn eingeben.');
      return;
    }
    const assignment = {
      farmWide, calfIds: farmWide ? [] : calfIds, templateId: templateId || null, name: edit.name.trim(), recurring: edit.recurring,
      timesPerDay: edit.recurring ? Number(edit.times) : 1, startDate: start, endDate,
      notes: edit.notes.trim() || null,
    };
    const signature = JSON.stringify(assignment);
    if (request.current?.signature !== signature) request.current = { signature, id: crypto.randomUUID() };
    submitting.current = true;
    setBusy(true);
    setNotice('');
    try {
      const count = await tasks.create({ ...assignment, requestId: request.current.id });
      onCreated(count);
    } catch (error) {
      setNotice(`Aufgabe konnte nicht angelegt werden. ${errorMessage(error)}`);
    } finally {
      setBusy(false);
      submitting.current = false;
    }
  }

  return <dialog ref={dialog} className="modal task-dialog" aria-labelledby={labelId}
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className="modal-head">
      <div><h2 id={labelId}>{calf ? 'Aufgabe anlegen' : 'Aufgabe anlegen'}</h2>
        {calf && <p className="task-help">Kalb {calf.ear_tag}</p>}</div>
      <button className="task-icon-button" type="button" aria-label="Aufgabe schließen" disabled={busy} onClick={onClose}><X size={22}/></button>
    </div>
    <form className="task-form" onSubmit={event => void submit(event)}>
      {!calf && <label>Zuordnung<select value={farmWide ? "farm" : "group"} onChange={e=>setFarmWide(e.target.value==="farm")}><option value="group">Kälber / Gruppe</option><option value="farm">Betrieb (ohne Tierbezug)</option></select></label>}
      {!calf && !farmWide && <GroupCalfPicker calves={calves} boxes={boxes} selected={eligibleSelection} setSelected={setSelected}/>}
      <label>Aufgabenvorlage
        <select value={templateId} onChange={event => chooseTemplate(event.target.value)}>
          <option value="">Individuelle Aufgabe</option>
          {choices.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}
        </select>
      </label>
      {tasks.templateError && <p className="task-feedback error" role="alert">Vorlagen konnten nicht geladen werden. {tasks.templateError}</p>}
      <label>Aufgabenbezeichnung
        <input value={edit.name} maxLength={120} required onChange={event => setEdit({ ...edit, name: event.target.value })}/>
      </label>
      <div className="task-form-grid">
        <label>Beginn
          <input type="date" value={start} min={addTaskDays(tasks.today, -maximumTaskDays)}
            max={addTaskDays(tasks.today, maximumTaskDays)} required onChange={event => setStart(event.target.value)}/>
        </label>
        <TaskTiming edit={edit} setEdit={setEdit} dates={{ start, end, setEnd }}/>
      </div>
      <label>Bemerkung (optional)
        <textarea value={edit.notes} rows={2} maxLength={2000} onChange={event => setEdit({ ...edit, notes: event.target.value })}/>
      </label>
      {notice && <p className="task-feedback error" role="alert">{notice}</p>}
      <div className="task-form-actions">
        <button className="outline" type="button" disabled={busy} onClick={onClose}>Abbrechen</button>
        <button className="primary" type="submit" disabled={busy || !tasks.online || (!calf && !farmWide && !eligibleSelection.size)}>
          {busy ? 'Wird angelegt …' : 'Anlegen'}
        </button>
      </div>
    </form>
  </dialog>;
}

export function GroupTaskButton({ tasks, calves, boxes, farmWide = false }: { farmWide?:boolean; tasks: FarmTasks; calves: TaskCalf[]; boxes: TaskBox[] }) {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState('');
  return <>
    <button type="button" className="primary task-action" disabled={!tasks.online} onClick={() => {
      setNotice('');
      setOpen(true);
      void tasks.refreshTemplates();
    }}><Plus size={17} aria-hidden="true"/> {farmWide?"Betriebsaufgabe":"Gruppenaufgabe"}</button>
    {open && <TaskAssignmentForm initialFarmWide={farmWide} tasks={tasks} calves={calves} boxes={boxes} onClose={() => setOpen(false)}
      onCreated={count => { setOpen(false); setNotice(`Aufgabe angelegt (${count} Zuordnungen).`); }}/>}
    {notice && <span className="task-action-status" role="status">{notice}</span>}
  </>;
}

export function CalfTaskButton({ tasks, calf }: { tasks: FarmTasks; calf: TaskCalf }) {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState('');
  if (!isActiveTaskCalf(calf)) return null;
  return <>
    <button type="button" className="primary task-action" disabled={!tasks.online} onClick={() => {
      setNotice('');
      setOpen(true);
      void tasks.refreshTemplates();
    }}><Plus size={17} aria-hidden="true"/> Aufgabe</button>
    {open && <TaskAssignmentForm tasks={tasks} calf={calf} onClose={() => setOpen(false)}
      onCreated={() => { setOpen(false); setNotice('Aufgabe angelegt.'); }}/>}
    {notice && <span className="task-action-status" role="status">{notice}</span>}
  </>;
}

export function TaskTemplateSettings({ tasks }: { tasks: FarmTasks }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [edit, setEdit] = useState(blankTask);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [feedback, setFeedback] = useState<{ text: string; failed: boolean }>();
  const sorted = [...tasks.templates].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, 'de'));

  function select(template?: TaskTemplate) {
    setEditing(template?.id ?? '');
    setEdit(template ? taskFromTemplate(template) : blankTask());
    setFeedback(undefined);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!edit.name.trim()) {
      setFeedback({ failed: true, text: 'Bitte eine Aufgabenbezeichnung eingeben.' });
      return;
    }
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setFeedback(undefined);
    try {
      await tasks.saveTemplate({
        name: edit.name.trim(), description: edit.notes.trim() || null, recurring: edit.recurring,
        times_per_day: edit.recurring ? Number(edit.times) : 1,
        duration_days: edit.recurring && edit.duration === 'days' ? Number(edit.days) : null,
      }, editing || undefined);
      setEditing(null);
      setFeedback({ failed: false, text: 'Aufgabenvorlage gespeichert.' });
    } catch (error) {
      setFeedback({ failed: true, text: `Vorlage konnte nicht gespeichert werden. ${errorMessage(error)}` });
    } finally {
      setBusy(false);
      locked.current = false;
    }
  }

  async function toggle(template: TaskTemplate) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setFeedback(undefined);
    try {
      await tasks.setTemplateActive(template.id, !template.active);
      if (editing === template.id) setEditing(null);
      setFeedback({ failed: false, text: template.active ? 'Vorlage deaktiviert.' : 'Vorlage aktiviert.' });
    } catch (error) {
      setFeedback({ failed: true, text: `Vorlage konnte nicht geändert werden. ${errorMessage(error)}` });
    } finally {
      setBusy(false);
      locked.current = false;
    }
  }

  return <section className="panel task-templates" aria-label="Aufgabenvorlagen">
    <div className="panel-head">
      <h2>Aufgabenvorlagen</h2>
      {editing === null && <button type="button" className="outline task-action" disabled={!tasks.online || busy}
        onClick={() => select()}><Plus size={17} aria-hidden="true"/> Vorlage anlegen</button>}
    </div>
    {editing !== null && <form className="task-form task-template-form" onSubmit={event => void save(event)}>
      <h3>{editing ? 'Vorlage bearbeiten' : 'Neue Vorlage'}</h3>
      <label>Aufgabenbezeichnung<input value={edit.name} required maxLength={120}
        onChange={event => setEdit({ ...edit, name: event.target.value })}/></label>
      <div className="task-form-grid"><TaskTiming edit={edit} setEdit={setEdit}/></div>
      <label>Beschreibung (optional)<textarea rows={2} value={edit.notes} maxLength={2000}
        onChange={event => setEdit({ ...edit, notes: event.target.value })}/></label>
      <div className="task-form-actions">
        <button type="button" className="outline" disabled={busy} onClick={() => setEditing(null)}>Abbrechen</button>
        <button type="submit" className="primary" disabled={busy || !tasks.online}>Vorlage speichern</button>
      </div>
    </form>}
    {feedback && <p className={`task-feedback${feedback.failed ? ' error' : ''}`} role={feedback.failed ? 'alert' : 'status'}>{feedback.text}</p>}
    {!tasks.online && <p className="task-help">Aufgabenvorlagen sind online verfügbar.</p>}
    {tasks.templateError && <p className="task-feedback error" role="alert">Vorlagen konnten nicht geladen werden. {tasks.templateError}</p>}
    {tasks.online && !tasks.templatesLoading && !tasks.templateError && !sorted.length && <p className="task-help">Noch keine Aufgabenvorlagen.</p>}
    {sorted.map(template => <div className="task-template-row" key={template.id}>
      <div className="task-info"><strong>{template.name}</strong>
        <small>{template.recurring ? `${template.times_per_day} × täglich · ${template.duration_days ? `${template.duration_days} Tage` : 'Bis zur Beendigung'}` : 'Einmalig'}
          {!template.active && ' · Deaktiviert'}</small>
        {template.description && <small>{template.description}</small>}</div>
      <div className="task-template-actions">
        <button className="outline" type="button" disabled={busy || !tasks.online} onClick={() => select(template)}>Bearbeiten</button>
        <button className="outline" type="button" disabled={busy || !tasks.online}
          onClick={() => void toggle(template)}>{template.active ? 'Deaktivieren' : 'Aktivieren'}</button>
      </div>
    </div>)}
  </section>;
}

const categories: { key: TaskCategory; label: string; empty: string }[] = [
  { key: 'today', label: 'Heute', empty: 'Keine offenen Aufgaben für heute.' },
  { key: 'overdue', label: 'Überfällig', empty: 'Keine überfälligen Aufgaben.' },
  { key: 'planned', label: 'Geplant', empty: 'Keine geplanten Aufgaben.' },
  { key: 'completed', label: 'Heute erledigt', empty: 'Heute sind noch keine Erledigungen erfasst.' },
];

function occurrenceLabel(row: FarmTask) {
  return row.occurrence && (row.times_per_day ?? 0) > 1
    ? `Durchführung ${row.occurrence}/${row.times_per_day}`
    : '';
}

function taskSummary(row: FarmTask) {
  const date = row.category === 'planned' || row.category === 'overdue' ? localDate(row.due_date)
    : row.category === 'completed' && row.completed_on && row.due_date !== row.completed_on
      ? `Fällig am ${localDate(row.due_date)}` : '';
  const treatment = row.treatment_day && row.treatment_days
    ? `${row.is_treatment ? 'Behandlungstag' : 'Tag'} ${row.treatment_day}/${row.treatment_days}` : '';
  return [date, occurrenceLabel(row), treatment].filter(Boolean).join(' · ');
}

function completedLabel(row: FarmTask) {
  const timestamp = row.completed_at ? completionFormat.format(new Date(row.completed_at))
    : row.completed_on ? localDate(row.completed_on) : '';
  return [timestamp, row.completed_by_name].filter(Boolean).join(' · ');
}

function TaskRows({ rows, tasks, boxes, onOpenCalf, visibleCategories, expanded, recurringOnly }: {
  visibleCategories?: TaskCategory[];
  expanded?: boolean;
  recurringOnly?: boolean;
  rows: FarmTask[];
  tasks: FarmTasks;
  boxes: TaskBox[];
  onOpenCalf?: (id: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [feedback, setFeedback] = useState<{ text: string; failed: boolean }>();

  async function complete(items: FarmTask[]) {
    if (locked.current) return;
    const first = items[0];
    if (items.length > 1) {
      const scope = [first.name, taskSummary(first)].filter(Boolean).join(' · ');
      const question = first.is_treatment
        ? `${scope} bei ${pluralCalves(items.length)} tatsächlich verabreicht? Datum, Uhrzeit und dein Benutzerkonto werden dokumentiert.`
        : `${scope} für ${pluralCalves(items.length)} als erledigt bestätigen?`;
      if (!window.confirm(question)) return;
    } else if (first.is_treatment && !window.confirm('Arzneimittel tatsächlich verabreicht? Datum, Uhrzeit und dein Benutzerkonto werden dokumentiert.')) {
      return;
    }
    locked.current = true;
    setBusy(true);
    setFeedback(undefined);
    try {
      const count = await tasks.complete(items);
      setFeedback({ failed: false, text: count ? `${count === 1 ? 'Durchführung' : `${count} Durchführungen`} erledigt.` : 'Die Aufgabenliste wurde aktualisiert.' });
    } catch (error) {
      setFeedback({ failed: true, text: `Erledigung konnte nicht gespeichert werden. ${errorMessage(error)}` });
      void tasks.refresh();
    } finally {
      setBusy(false);
      locked.current = false;
    }
  }

  async function end(row: FarmTask) {
    if (locked.current || !window.confirm(`Aufgabe „${row.name}“ ${row.source === "farm" ? "für den Betrieb" : `für Kalb ${row.ear_tag}`} beenden? Bereits erfasste Durchführungen bleiben in der Historie.`)) return;
    locked.current = true;
    setBusy(true);
    setFeedback(undefined);
    try {
      await tasks.end(row);
      setFeedback({ failed: false, text: 'Aufgabe beendet.' });
    } catch (error) {
      setFeedback({ failed: true, text: `Aufgabe konnte nicht beendet werden. ${errorMessage(error)}` });
      void tasks.refresh();
    } finally {
      setBusy(false);
      locked.current = false;
    }
  }

  return <>
    {feedback && <p className={`task-feedback${feedback.failed ? ' error' : ''}`} role={feedback.failed ? 'alert' : 'status'}>{feedback.text}</p>}
    {categories.filter(c=>!visibleCategories||visibleCategories.includes(c.key)).map(category => {
      const grouped = tasksByBox(rows.filter(row => row.category === category.key && (!recurringOnly || row.recurring === true)), boxes);
      const count = grouped.reduce((total, box) => total + box.rows.length, 0);
      const loadedFarm=rows.filter(r=>r.source==='farm'&&r.category===category.key).length;
      const remaining=onOpenCalf?Math.max(0,(tasks.farmCounts?.[category.key]??loadedFarm)-loadedFarm):0;
      const due = category.key === 'today' || category.key === 'overdue';
      return <details key={category.key} className={`task-category ${category.key}`} open={expanded||due}>
        <summary className="task-category-heading">
          <span>{category.label}</span><span className="count">{recurringOnly ? count : count+remaining}</span><ChevronDown size={19} aria-hidden="true"/>
        </summary>
        {!count && !remaining && <p className="task-empty">{recurringOnly ? "Keine wiederkehrenden Aufgaben in dieser Kategorie." : category.empty}</p>}
        {grouped.map(box => <details className="task-box" key={box.id} open={expanded||due}>
          <summary className="task-box-heading">
            <strong>{box.name}</strong><small>{box.rows.length} {box.rows.length === 1 ? 'Aufgabe' : 'Aufgaben'}</small>
            <ChevronDown size={18} aria-hidden="true"/>
          </summary>
          {taskWorkGroups(box.rows).map(group => <div className="task-work-group" key={group.key}>
            {box.id && due && group.rows.length > 1 && new Set(group.rows.map(row => row.calf_id)).size > 1 &&
              <div className="task-box-batch"><strong>{group.rows[0].name}</strong>
                <small>{taskSummary(group.rows[0])}</small>
                <button className="outline task-action" type="button" disabled={busy || !tasks.online}
                  aria-label={`${box.name}: ${group.rows[0].name} ${occurrenceLabel(group.rows[0])} für ${pluralCalves(group.rows.length)} abhaken`}
                  onClick={() => void complete(group.rows)}><Check size={17} aria-hidden="true"/> Box abhaken</button>
              </div>}
            {group.rows.map(row => <div className="task-work-row" key={taskKey(row)}>
              <div className="task-info">
                <strong>{row.name}{row.priority === 'urgent' && <span className="task-urgent">Dringend</span>}</strong>
                {onOpenCalf && row.source !== "farm"
                  ? <button type="button" className="task-calf-link" onClick={() => onOpenCalf(row.calf_id)}>{row.ear_tag}</button>
                  : <span>{row.ear_tag}</span>}
                {taskSummary(row) && <small>{taskSummary(row)}</small>}
                {row.notes && <small>{row.notes}</small>}
                {row.category === 'completed' && completedLabel(row) && <small>{completedLabel(row)}</small>}
              </div>
              {row.category !== 'completed' && <div className="task-work-actions">
                {due && (row.source === 'vaccination'
                  ? onOpenCalf && <button className="outline task-action" type="button" onClick={() => onOpenCalf(row.calf_id)}>Kalb öffnen</button>
                  : <button className="primary task-action" type="button" disabled={busy || !tasks.online}
                    aria-label={`${row.name} für ${row.ear_tag} erledigen${occurrenceLabel(row) ? `, ${occurrenceLabel(row)}` : ''}`}
                    onClick={() => void complete([row])}><Check size={17} aria-hidden="true"/> Erledigen</button>)}
                {row.can_end && <button className="outline task-action" type="button" disabled={busy || !tasks.online}
                  aria-label={`Aufgabe beenden: ${row.name} für ${row.ear_tag}`}
                  onClick={() => void end(row)}>Aufgabe beenden</button>}
              </div>}
            </div>)}
          </div>)}
        </details>)}
        {remaining>0&&<button className="outline" disabled={busy||!tasks.online||tasks.loading} onClick={async()=>{if(locked.current)return;locked.current=true;setBusy(true);try{await tasks.loadMore(category.key);}catch(e){setFeedback({text:errorMessage(e),failed:true});}finally{locked.current=false;setBusy(false);}}}>Weitere Betriebsaufgaben laden ({remaining})</button>}
      </details>;
    })}
  </>;
}

function FarmWorkHistory({tasks}:{tasks:FarmTasks}) {
 const [rows,setRows]=useState<Awaited<ReturnType<FarmTasks['history']>>>([]);
 const [notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false);
 const [more,setMore]=useState(false);
 async function load(append=false){setBusy(true);setNotice('');try{const page=await tasks.history(append?rows[rows.length-1]:undefined);setRows(old=>append?[...old,...page]:page);setMore(page.length===200);}catch(e){setNotice(errorMessage(e));}finally{setBusy(false);}}
 return <details className="task-category"><summary>Betriebshistorie</summary><button className="outline" disabled={!tasks.online||busy} onClick={()=>void load()}>Letzte 200 Durchführungen laden</button>{notice&&<p role="alert">{notice}</p>}{rows.map(r=><p key={`${r.order_id}:${r.due_date}:${r.occurrence}`}><strong>{r.name}</strong> · {localDate(r.due_date)} · Durchführung {r.occurrence} · {completionFormat.format(new Date(r.completed_at))} · {r.completed_by_name||'Ehemaliger oder unbekannter Nutzer'}</p>)}{more&&<button className="outline" disabled={!tasks.online||busy} onClick={()=>void load(true)}>Weitere Einträge laden</button>}</details>;
}

export function TaskOverview({ tasks, boxes, onOpenCalf, fallbackRows }: {
  tasks: FarmTasks;
  boxes: TaskBox[];
  onOpenCalf: (id: string) => void;
  fallbackRows?: FarmTask[];
}) {
  const [view,setView]=useState<"today"|"open"|"completed"|"planned"|"recurring">("today");
  const rows = tasks.available ? tasks.rows : fallbackRows ?? [];
  const todayRows = rows.filter(row => row.due_date === tasks.today);
  const done = todayRows.filter(row => row.category === 'completed' && (row.source!=='farm'||tasks.farmDoneToday===undefined)).length+(tasks.farmDoneToday??0);
  const total = done+todayRows.filter(row=>row.category==='today'&&(row.source!=='farm'||tasks.farmCounts===undefined)).length+(tasks.farmCounts?.today??0);
  const percent = total ? Math.round(done / total * 100) : 0;
  return <section className="panel task-panel" aria-label="Aufgabenübersicht">
    {(tasks.available || !!fallbackRows?.length) && <div className="task-progress-card">
      <div className="task-progress-ring" style={{background: `conic-gradient(#31852f ${percent}%, #e0e5df 0)`}}><div><strong>{done} / {total}</strong><small>erledigt</small></div></div>
      <div><h3>Heutige Aufgaben</h3><p>{done} erledigt · {total - done} offen</p><small>{localDate(tasks.today)}</small></div>
    </div>}
    <div className="work-tabs" role="group" aria-label="Aufgabenansicht">{([ ["today","Heute"],["open","Offen"],["completed","Erledigt"],["planned","Geplant"],["recurring","Wiederkehrend"] ] as const).map(([v,l])=><button key={v} aria-pressed={view===v} onClick={()=>setView(v)}>{l}</button>)}</div>{view==="completed"&&<FarmWorkHistory key={tasks.scope} tasks={tasks}/>} 
    {!tasks.online && <p className="task-help" role="status">
      {tasks.available ? `Offline · Aufgabenstand vom ${localDate(tasks.today)}. Zum Ändern bitte verbinden.`
        : 'Offline · Kein gespeicherter Aufgabenstand verfügbar.'}
    </p>}
    {tasks.error && <p className="task-feedback error" role="alert">Aufgaben konnten nicht geladen werden. {tasks.error}</p>}
    {tasks.loading && !tasks.available && !fallbackRows?.length
      ? <p className="task-help" role="status">Aufgaben werden geladen …</p>
      : !tasks.available && !fallbackRows?.length ? <p role="status">Aufgaben derzeit nicht verfügbar.</p> : <TaskRows expanded recurringOnly={view==="recurring"} visibleCategories={view==="open"||view==="recurring"?["today","overdue","planned"]:[view]} rows={tasks.available ? tasks.rows : fallbackRows ?? []} tasks={tasks} boxes={boxes} onOpenCalf={onOpenCalf}/>}
  </section>;
}

export function CalfTaskAssignments({ tasks, calf, boxes }: { tasks: FarmTasks; calf: TaskCalf; boxes: TaskBox[] }) {
  return <section className="task-panel calf-task-assignments" aria-label="Aufgaben dieses Kalbs">
    {tasks.error && <p className="task-feedback error" role="alert">Aufgaben konnten nicht geladen werden. {tasks.error}</p>}
    {tasks.available
      ? <TaskRows tasks={tasks} boxes={boxes} rows={tasks.rows.filter(row => row.calf_id === calf.id)}/>
      : !tasks.error && <p className="task-help" role="status">{tasks.loading ? 'Aufgaben werden geladen …' : 'Aufgaben sind derzeit nicht verfügbar.'}</p>}
  </section>;
}
