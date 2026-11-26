import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addTaskDays, cachedLegacyTasks, countDueTasks, dateInFarmTime,
  taskCalfGroups, taskDurationDays, taskKey, tasksByBox, taskWorkGroups,
} from '../src/task-model.ts';

const calves = [
  { id: 'a', ear_tag: 'DE-20', box_id: 'west', status: 'active' },
  { id: 'b', ear_tag: 'DE-3', box_id: 'west', status: 'active' },
  { id: 'c', ear_tag: 'DE-1', box_id: null, status: 'active' },
  { id: 'd', ear_tag: 'DE-2', box_id: 'west', status: 'left' },
  { id: 'e', ear_tag: 'DE-5', box_id: 'west', status: 'archived' },
];
const boxes = [{ id: 'west', name: 'Box West' }, { id: 'east', name: 'Box Ost' }];
const today = '2026-03-29';

const row = (properties = {}) => ({
  source: 'assignment', assignment_id: 'assignment-a', group_id: 'group-a',
  calf_id: 'a', ear_tag: 'DE-20', box_id: 'west', name: 'Temperatur messen',
  due_date: today, occurrence: 1, times_per_day: 2, category: 'today', ...properties,
});

test('task date and inclusive duration follow Berlin calendar across daylight saving', () => {
  assert.equal(dateInFarmTime(new Date('2026-03-29T22:30:00Z')), '2026-03-30');
  assert.equal(addTaskDays('2026-03-27', 6), '2026-04-02');
  assert.equal(taskDurationDays('2026-03-27', '2026-04-02'), 7);
  assert.equal(taskDurationDays(today, today), 1);
  assert.equal(addTaskDays('2026-02-30', 1), '');
  assert.equal(addTaskDays(today, 0.5), '');
});

test('group calf picker lists every box and groups active calves with no box separately', () => {
  const groups = taskCalfGroups(calves, boxes);
  assert.deepEqual(groups.map(group => [group.name, group.calves.map(calf => calf.id)]), [
    ['Box West', ['b', 'a']],
    ['Box Ost', []],
    ['Ohne Box', ['c']],
  ]);
});

test('box batch completion only selects the same group, date and occurrence in the box', () => {
  const first = row();
  const secondCalf = row({ calf_id: 'b', ear_tag: 'DE-3', assignment_id: 'assignment-b' });
  const movedCalf = row({ calf_id: 'c', ear_tag: 'DE-1', assignment_id: 'assignment-c', box_id: 'east' });
  const nextRun = row({ occurrence: 2 });
  const previousRun = row({ due_date: '2026-03-28', category: 'overdue' });
  const independent = row({ group_id: 'other', assignment_id: 'other' });
  const groups = tasksByBox([first, secondCalf, movedCalf, nextRun, previousRun, independent], boxes);
  assert.deepEqual(groups.map(box => [box.id, box.rows.length]), [['east', 1], ['west', 5]]);
  const batches = taskWorkGroups(groups.find(box => box.id === 'west').rows);
  assert.equal(batches.length, 4);
  assert.deepEqual(batches.find(batch => batch.rows.length === 2).rows.map(taskKey), [taskKey(secondCalf), taskKey(first)]);
  assert.notEqual(taskKey(first), taskKey(nextRun));
  assert.notEqual(taskKey(first), taskKey(previousRun));
});

test('dashboard count reflects both due sections and retains the second occurrence', () => {
  const first = row();
  const second = row({ occurrence: 2 });
  const overdue = row({ category: 'overdue', due_date: '2026-03-28' });
  const planned = row({ category: 'planned', due_date: '2026-03-30' });
  assert.equal(countDueTasks([first, second, overdue, planned]), 3);
  assert.equal(countDueTasks([{ ...first, category: 'completed' }, second, overdue, planned]), 2);
});

test('offline compatibility preserves due legacy tasks for active calves', () => {
  const legacy = { id: 'legacy', calf_id: 'a', kind: 'task', details: '[AUTO-GESUNDHEIT] Kontrolle', event_date: today };
  const result = cachedLegacyTasks([
    legacy,
    { ...legacy, id: 'overdue', due_date: '2026-03-28' },
    { ...legacy, id: 'planned', due_date: '2026-03-30' },
    { ...legacy, calf_id: 'd' },
    { ...legacy, task_status: 'done' },
    { ...legacy, kind: 'feeding' },
  ], calves, today);
  assert.deepEqual(result.map(task => [task.source, task.name, task.category]), [
    ['legacy', 'Kontrolle', 'today'], ['legacy', 'Kontrolle', 'overdue'], ['legacy', 'Kontrolle', 'planned'],
  ]);
  assert.equal(countDueTasks(result), 2);
});
