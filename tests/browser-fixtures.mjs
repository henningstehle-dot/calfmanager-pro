import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export const owner = fixtureUser('11111111-1111-4111-8111-111111111111', 'owner', 'Hanna');
export const employee = fixtureUser('11111111-1111-4111-8111-222222222222', 'employee', 'Toni');
export const fixturePassword = 'local-fixture-password';
export const farm = {
  id: '22222222-2222-4222-8222-222222222222', name: 'Testbetrieb',
  street_address: 'Testweg 1', postal_code: '70173', city: 'Stuttgart',
};
export const boxes = [
  { id: '55555555-5555-4555-8555-111111111111', name: 'Box Nord', kind: 'group' },
  { id: '55555555-5555-4555-8555-222222222222', name: 'Box Süd', kind: 'group' },
].map(box => ({ ...box, farm_id: farm.id }));
export const calf = {
  id: '33333333-3333-4333-8333-111111111111', farm_id: farm.id,
  ear_tag: 'TEST-001', name: 'Luna', sex: 'female', breed: 'Fleckvieh',
  birth_date: '2026-01-01', created_at: '2026-01-01T00:00:00Z', status: 'active',
  box_id: boxes[0].id, health_status: 'green',
};
export const secondCalf = { ...calf, id: '33333333-3333-4333-8333-222222222222', ear_tag: 'TEST-002', name: 'Frieda' };
export const unboxedCalf = { ...calf, id: '33333333-3333-4333-8333-333333333333', ear_tag: 'TEST-003', name: 'Maja', box_id: null };
export const archivedCalf = { ...calf, id: '33333333-3333-4333-8333-444444444444', ear_tag: 'TEST-004', name: 'Marla', status: 'archived' };
export const recurringTemplate = {
  id: '44444444-4444-4444-8444-111111111111', farm_id: farm.id, name: 'Temperatur messen',
  description: 'Prüfvorlage', recurring: true, times_per_day: 2, duration_days: 3, active: true,
};
export const legacyTemplate = {
  id: '44444444-4444-4444-8444-222222222222', farm_id: farm.id, name: 'Bestehende Behandlung',
  days: 2, times_per_day: 1, is_halocur: false, notes: null,
};

function fixtureUser(id, role, first_name) {
  return {
    id, aud: 'authenticated', role: 'authenticated', email: `${role}@example.test`,
    app_metadata: { provider: 'email' }, user_metadata: { first_name, last_name: 'Test' },
    created_at: '2026-01-01T00:00:00Z',
  };
}

export function dateOffset(date, days = 0) {
  const result = new Date(`${date}T12:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

export const initialDate = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });

export function makeFixture() {
  const legacyTask = { id: randomUUID(), farm_id: farm.id, calf_id: calf.id,
    kind: 'task', details: 'Ältere Bestandsaufgabe', priority: 'urgent', task_status: 'open',
    due_date: dateOffset(initialDate, -1), event_date: dateOffset(initialDate, -1), weight_kg: null,
  };
  const members = [
    { user_id: owner.id, role: 'owner', email: owner.email },
    { user_id: employee.id, role: 'employee', email: employee.email },
  ];
  return {
    today: initialDate, requests: [], unexpected: [], failNextGroup: false,
    workOrders: [], workDone: [], assignments: [], completions: new Map(),
    tables: {
      farms: [farm], calves: structuredClone([calf, secondCalf, unboxedCalf, archivedCalf]),
      calf_events: [legacyTask, { ...legacyTask, id: randomUUID(), calf_id: archivedCalf.id, details: 'Archivierte Aufgabe' }],
      farm_boxes: boxes, calf_feeding_rounds: [], calf_box_moves: [],
      calf_health_cases: [], calf_vaccinations: [], calf_followups: [], calf_treatments: [], farm_medicines: [],
      farm_milk_curves: [{ id: randomUUID(), farm_id: farm.id, name: 'Tränkekurve', breed: calf.breed,
        sex: calf.sex, milk_type: 'whole', grams_per_liter: 140, feedings_per_day: 2,
        points: [{ day: 0, liters: 7 }, { day: 1000, liters: 7 }] }],
      farm_growth_settings: [{ farm_id: farm.id, min_gain_g: 700 }],
      farm_mat_settings: [{ farm_id: farm.id, concentration_basis: 'prepared', grams_per_liter: 150,
        reference_water_liters: 9, reference_prepared_liters: 10 }],
      farm_task_templates_322: [structuredClone(recurringTemplate)],
      farm_treatment_templates_320: [legacyTemplate],
      farm_treatment_settings_320: [{ farm_id: farm.id, suggest_halocur: false }],
    },
    members,
  };
}

// Synthetic browser backend only; PostgreSQL tests remain authoritative for permissions.
export function workRows(state) {
  const rows = [];
  for (const a of state.workOrders.filter(a=>a.p_farm_id===farm.id)) {
    const next = a.p_start_date > state.today ? a.p_start_date : dateOffset(state.today, 1);
    const end = a.p_recurring ? (a.p_end_date && a.p_end_date < next ? a.p_end_date : next) : a.p_start_date;
    for (let due = a.p_start_date; due <= end; due = dateOffset(due, 1)) {
      for (let occurrence = 1; occurrence <= a.p_times_per_day; occurrence++) {
        const done = state.workDone.find(c => c.order_id === a.id && c.due_date === due && c.occurrence === occurrence);
        if ((!done && a.ended) || (done && done.completed_on !== state.today)) continue;
        rows.push({source:'farm', recurring:a.p_recurring, assignment_id:a.id, event_id:null, group_id:null, calf_id:'', ear_tag:'Betrieb', box_id:null, name:a.p_name, notes:a.p_notes, due_date:due, occurrence, times_per_day:a.p_times_per_day, treatment_day:null,treatment_days:null, priority:null, completed_at:null, completed_by:null, completed_by_name:null, ...done, category:done?'completed':due<state.today?'overdue':due===state.today?'today':'planned', is_treatment:false, can_end:!done&&!a.ended});
      }
    }
  }
  return rows.sort((a,b)=>a.due_date.localeCompare(b.due_date)||a.assignment_id.localeCompare(b.assignment_id)||a.occurrence-b.occurrence);
}

async function bodyOf(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null;
}

function matches(row, params) {
  for (const [key, value] of params) {
    const splitAt = value.indexOf('.');
    const operator = value.slice(0, splitAt);
    const operand = value.slice(splitAt + 1);
    if (key === 'select' || key === 'order' || key === 'limit' || key === 'on_conflict' || key === 'offset') continue;
    if (operator === 'eq' && String(row[key]) !== operand) return false;
    if (operator === 'is' && operand === 'null' && row[key] != null) return false;
    if (operator === 'in' && !operand.slice(1, -1).split(',').includes(String(row[key]))) return false;
    if (operator === 'like' && !String(row[key]).startsWith(operand.replace(/%$/, ''))) return false;
  }
  return true;
}

function completionKey(task) {
  return task.assignment_id ? `${task.assignment_id}:${task.due_date}:${task.occurrence}` : task.event_id;
}

function assignTasks(state, params) {
  const groupId = params.p_request_id;
  assert.match(groupId, /^[a-f0-9-]{36}$/, 'an assignment has a retry identifier');
  const previous = state.assignments.filter(row => row.group_id === groupId);
  if (previous.length) return previous.length;
  const members = state.tables.calves.filter(row => params.p_calf_ids.includes(row.id) && row.status === 'active');
  assert.equal(members.length, params.p_calf_ids.length, 'assignment contains only active calves');
  for (const row of members) state.assignments.push({
    id: randomUUID(), group_id: groupId, calf_id: row.id,
    name: params.p_name, recurring: params.p_recurring, times_per_day: params.p_times_per_day,
    start_date: params.p_start_date, end_date: params.p_end_date, notes: params.p_notes,
  });
  return members.length;
}

function taskRows(state, calfId) {
  const rows = [];
  function makeRow(task, calfId) {
    const row = state.tables.calves.find(c => c.id === calfId);
    return { calf_id: calfId, ear_tag: row.ear_tag, box_id: row.box_id, ...task };
  }
  for (const task of state.assignments) {
    const row = state.tables.calves.find(c => c.id === task.calf_id);
    const nextDate = task.start_date > state.today ? task.start_date : dateOffset(state.today, 1);
    const end = task.end_date ?? (task.recurring ? nextDate : task.start_date);
    const listUntil = end < nextDate ? end : nextDate;
    for (let due = task.start_date; due <= listUntil; due = dateOffset(due, 1)) {
      for (let occurrence = 1; occurrence <= task.times_per_day; occurrence++) {
        const completion = state.completions.get(completionKey({ assignment_id: task.id, due_date: due, occurrence }));
        if (!completion && (calfId || task.ended || row.status !== 'active')) continue;
        if (!calfId && completion && completion.completed_at.slice(0, 10) !== state.today) continue;
        const fixed = task.recurring && task.end_date;
        rows.push(makeRow({
          source: 'assignment', recurring:task.recurring, assignment_id: task.id, event_id: null, group_id: task.group_id,
          name: task.name, notes: task.notes, due_date: due, occurrence, times_per_day: task.times_per_day,
          treatment_day: fixed ? (Date.parse(due) - Date.parse(task.start_date)) / 86400000 + 1 : null,
          treatment_days: fixed ? (Date.parse(task.end_date) - Date.parse(task.start_date)) / 86400000 + 1 : null,
          priority: null,
          completed_at: null, completed_by: null, completed_by_name: null, ...completion,
          category: completion ? 'completed' : due === state.today ? 'today' : due < state.today ? 'overdue' : 'planned',
          is_treatment: false, can_end: !completion && !task.ended,
        }, row.id));
      }
      if (!task.recurring) break;
    }
  }
  for (const task of state.tables.calf_events.filter(event => event.kind === 'task')) {
    const row = state.tables.calves.find(c => c.id === task.calf_id);
    const completion = state.completions.get(task.id);
    if (!completion && (task.task_status === 'cancelled' || row.status !== 'active')) continue;
    if (!calfId && completion && completion.completed_at.slice(0, 10) !== state.today) continue;
    const isTreatment = task.details.startsWith('[BEHANDLUNG:');
    rows.push(makeRow({
      source: 'legacy', assignment_id: null, event_id: task.id, group_id: null,
      name: task.details.replace(/^\[(?:BEHANDLUNG:[^\]]+|AUTO-GESUNDHEIT)\]\s*/, ''),
      notes: null, due_date: task.due_date, occurrence: isTreatment ? 1 : null, times_per_day: isTreatment ? 1 : null,
      treatment_day: isTreatment ? 1 : null, treatment_days: isTreatment ? legacyTemplate.days : null, priority: task.priority,
      completed_at: null, completed_by: null, completed_by_name: null, ...completion,
      category: completion ? 'completed' : task.due_date < state.today ? 'overdue' : task.due_date > state.today ? 'planned' : 'today',
      is_treatment: isTreatment, can_end: !completion,
    }, row.id));
  }
  return calfId ? rows.filter(row => row.calf_id === calfId && row.completed_at) : rows;
}

function completeTasks(state, items, user) {
  const rows = taskRows(state);
  let count = 0;
  for (const item of items) {
    const key = completionKey(item);
    if (state.completions.has(key)) continue;
    const row = rows.find(task => completionKey(task) === key);
    assert.ok(row && ['today', 'overdue'].includes(row.category), 'completion must identify a due row');
    const completedAt = `${state.today}T09:15:00Z`;
    state.completions.set(key, { completed_at: completedAt, completed_on: state.today,
      completed_by: user.id, completed_by_name: `${user.user_metadata.first_name} Test` });
    if (item.event_id) {
      const event = state.tables.calf_events.find(value => value.id === item.event_id);
      Object.assign(event, { task_status: 'done', completed_at: completedAt, completed_by: user.id });
    }
    count++;
  }
  return count;
}

export function isMockApi(path) {
  return /^\/(auth|rest)\//.test(path);
}

export async function mockApi(request, response, state) {
  const { pathname, searchParams } = new URL(request.url, 'http://localhost');
  const route = `${request.method} ${pathname}`;
  const requestBody = await bodyOf(request);
  const user = request.headers.authorization === 'Bearer local-fixture-employee' ? employee : owner;
  const farmIds = state.farmIdsByUser?.[user.id] ?? [farm.id];
  state.requests.push({ route, body: requestBody, query: Object.fromEntries(searchParams), userId: user.id });
  function json(status, body) {
    response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify(body));
  }
  function session(signedIn) {
    const account = signedIn === owner ? 'owner' : 'employee';
    return json(200, {
      access_token: `local-fixture-${account}`,
      refresh_token: `local-fixture-refresh-${account}`,
      token_type: 'bearer', expires_in: 3600, user: signedIn,
    });
  }
  if (route === 'POST /auth/v1/token' && searchParams.get('grant_type') === 'password') {
    const signedIn = [owner, employee].find(candidate => candidate.email === requestBody.email);
    if (!signedIn || requestBody.password !== fixturePassword) return json(400, { code: 'invalid_credentials', msg: 'Invalid login credentials' });
    return session(signedIn);
  }
  if (route === 'POST /auth/v1/token' && searchParams.get('grant_type') === 'refresh_token') {
    const signedIn = { 'local-fixture-refresh-owner': owner, 'local-fixture-refresh-employee': employee }[requestBody.refresh_token];
    return signedIn ? session(signedIn) : json(400, { code: 'refresh_token_not_found' });
  }
  if (route === 'GET /auth/v1/user') return json(200, user);
  if (pathname.startsWith('/rest/v1/rpc/')) {
    const rpc = pathname.split('/').at(-1);
    if (requestBody?.p_farm_id && !farmIds.includes(requestBody.p_farm_id)) return json(403, { message: 'Kein Betriebszugriff' });
    switch (rpc) {
      case 'is_platform_admin': return json(200, false);
      case 'list_farm_members': return json(200, requestBody.p_farm_id === farm.id ? state.members : state.members.filter(member => member.user_id === owner.id));
      case 'list_farm_invitations': return json(200, []);
      case 'list_farm_tasks_340': {
        const rows = requestBody.p_farm_id === farm.id ? workRows(state) : [];
        const farmCounts = {}, page = [];
        for (const category of ['today','overdue','planned','completed']) {
          const subset = rows.filter(r=>r.category===category).sort((a,b)=>a.due_date.localeCompare(b.due_date)||a.assignment_id.localeCompare(b.assignment_id)||a.occurrence-b.occurrence);
          farmCounts[category]=subset.length;
          if (!requestBody.p_category || requestBody.p_category===category) page.push(...subset.filter(r=>!requestBody.p_after_due || r.due_date>requestBody.p_after_due || (r.due_date===requestBody.p_after_due && (r.assignment_id>requestBody.p_after_order || (r.assignment_id===requestBody.p_after_order && r.occurrence>requestBody.p_after_occurrence)))).slice(requestBody.p_offset??0,(requestBody.p_offset??0)+200));
        }
        return json(200,{today:state.today,rows:[...(!requestBody.p_category&&requestBody.p_farm_id===farm.id?taskRows(state):[]),...page],farmCounts,farmDoneToday:rows.filter(r=>r.category==='completed'&&r.due_date===state.today).length});
      }
      case 'create_farm_work_340': {
        const existing=state.workOrders.find(a=>a.p_farm_id===requestBody.p_farm_id&&a.p_request_id===requestBody.p_request_id);
        if(existing) return json(200,1);
        state.workOrders.push({...requestBody,id:randomUUID()});
        if(state.loseWorkResponse){state.loseWorkResponse=false;return json(503,{message:'Test: Antwort nach Speicherung verloren'});}
        return json(200,1);
      }
      case 'complete_farm_work_340': {
        const a=state.workOrders.find(a=>a.id===requestBody.p_order_id&&a.p_farm_id===requestBody.p_farm_id);
        if(!a) return json(400,{message:'Aufgabe nicht vorhanden'});
        const due=requestBody.p_due_date, occurrence=requestBody.p_occurrence;
        if(state.workDone.some(c=>c.order_id===a.id&&c.due_date===due&&c.occurrence===occurrence))return json(200,0);
        if(a.ended||due>state.today||due<a.p_start_date||due>(a.p_end_date??(a.p_recurring?'9999-12-31':a.p_start_date))||occurrence<1||occurrence>a.p_times_per_day)return json(400,{message:'Ungültige Durchführung'});
        state.workDone.push({order_id:a.id,due_date:due,occurrence,completed_at:new Date().toISOString(),completed_on:state.today,completed_by:user.id,completed_by_name:user.user_metadata.first_name});return json(200,1);
      }
      case 'end_farm_work_340': {
        const a=state.workOrders.find(a=>a.id===requestBody.p_order_id&&a.p_farm_id===requestBody.p_farm_id);
        if(!a)return json(400,{message:'Aufgabe nicht vorhanden'});a.ended=true;return json(200,null);
      }
      case 'farm_work_history_page_340': {
        const key=c=>[c.completed_at,c.order_id,c.due_date,String(c.occurrence).padStart(2,'0')].join('|');
        const before=requestBody.p_before?key({completed_at:requestBody.p_before,order_id:requestBody.p_order,due_date:requestBody.p_due,occurrence:requestBody.p_occurrence}):null;
        return json(200,state.workDone.filter(c=>state.workOrders.some(a=>a.id===c.order_id&&a.p_farm_id===requestBody.p_farm_id)&&(!before||key(c)<before)).sort((a,b)=>key(b).localeCompare(key(a))).slice(0,200).map(c=>({...c,name:state.workOrders.find(a=>a.id===c.order_id).p_name})));
      }
      case 'list_farm_tasks_322': return json(200, { today: state.today, rows: requestBody.p_farm_id === farm.id ? taskRows(state) : [] });
      case 'list_calf_task_history_322': return json(200, taskRows(state, requestBody.p_calf_id));
      case 'create_farm_tasks_322': {
        if (state.failNextGroup && requestBody.p_calf_ids.length > 1) {
          state.failNextGroup = false;
          return json(400, { message: 'Testfehler bei der Gruppenaufgabe' });
        }
        return json(200, assignTasks(state, requestBody));
      }
      case 'complete_farm_tasks_322': {
        if (user === owner && state.delayOwnerCompletion) await state.delayOwnerCompletion;
        return json(200, completeTasks(state, requestBody.p_tasks, user));
      }
      case 'complete_farm_task_320': {
        completeTasks(state, [{ event_id: requestBody.p_event_id }], user);
        return json(200, null);
      }
      case 'end_farm_task_322': {
        if (requestBody.p_assignment_id) state.assignments.find(item => item.id === requestBody.p_assignment_id).ended = true;
        else state.tables.calf_events.find(item => item.id === requestBody.p_event_id).task_status = 'cancelled';
        return json(200, null);
      }
      case 'schedule_treatment_320': {
        assert.equal(requestBody.p_template_id, legacyTemplate.id);
        for (let day = 0; day < legacyTemplate.days; day++) {
          const date = dateOffset(requestBody.p_start_date, day);
          state.tables.calf_events.push({ id: randomUUID(), farm_id: farm.id, calf_id: requestBody.p_calf_id,
            kind: 'task', details: `[BEHANDLUNG:${legacyTemplate.id}] ${legacyTemplate.name}`, event_date: date,
            due_date: date, task_status: 'open', priority: 'normal', weight_kg: null });
        }
        return json(200, legacyTemplate.days);
      }
      case 'move_farm_calves_320': {
        for (const row of state.tables.calves.filter(value => requestBody.p_calf_ids.includes(value.id))) {
          state.tables.calf_box_moves.push({ id: randomUUID(), farm_id: farm.id, calf_id: row.id,
            from_box_id: row.box_id, to_box_id: requestBody.p_target_box_id, moved_at: `${state.today}T09:10:00Z` });
          row.box_id = requestBody.p_target_box_id;
        }
        return json(200, requestBody.p_calf_ids.length);
      }
    }
  }
  const table = pathname.split('/').at(-1);
  if (!pathname.startsWith('/rest/v1/rpc/') && Object.hasOwn(state.tables, table)) {
    const rows = state.tables[table];
    const selected = rows.filter(row =>
      farmIds.includes(table === 'farms' ? row.id : row.farm_id) && matches(row, searchParams));
    const single = request.headers.accept?.includes('vnd.pgrst.object');
    const representation = request.headers.prefer?.includes('return=representation');
    if (request.method === 'GET') return json(200, single ? selected[0] ?? null : selected);
    if (request.method === 'PATCH') {
      if (table === 'calves' && Object.hasOwn(requestBody, 'health_status')) {
        assert.match(searchParams.get('farm_id') ?? '', /^eq\./, 'health writes require a farm filter');
        assert.equal(searchParams.get('status'), 'eq.active');
      }
      for (const row of selected) Object.assign(row, requestBody);
      return json(200, representation ? (single ? selected[0] : selected) : null);
    }
    if (request.method === 'POST') {
      if (!farmIds.includes(requestBody.farm_id)) return json(403, { message: 'Kein Betriebszugriff' });
      if (table === 'calf_feeding_rounds') {
        assert.ok(state.tables.calves.some(calf => calf.id === requestBody.calf_id && calf.farm_id === requestBody.farm_id));
      }
      const conflictKeys = searchParams.get('on_conflict')?.split(',');
      const existing = conflictKeys && rows.find(row => conflictKeys.every(key => row[key] === requestBody[key]));
      const defaults = table === 'farm_task_templates_322' ? { active: true } : {};
      const item = existing ?? { id: randomUUID(), ...defaults, ...requestBody };
      if (!existing) rows.push(item);
      else if (!request.headers.prefer?.includes('ignore-duplicates')) Object.assign(item, requestBody);
      return json(201, representation ? (single ? item : [item]) : null);
    }
  }
  state.unexpected.push(route);
  return json(404, { message: 'No local fixture for this route' });
}
