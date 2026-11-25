import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateMat, getMatDemand, parseMatNumber, validateMatRecipe } from '../src/mat-model.ts';

const manufacturerRecipe = {
  concentration_basis: 'prepared',
  grams_per_liter: 150,
  reference_water_liters: 9,
  reference_prepared_liters: 10,
};

const missingReference = {
  ...manufacturerRecipe,
  reference_water_liters: null,
  reference_prepared_liters: null,
};

test('MAT calculator scales the manufacturer water yield for the requested finished amount', () => {
  const demand = getMatDemand({ mode: 'prepared', prepared: '90' });
  assert.deepEqual(demand, { liters: 90, notice: null });
  assert.deepEqual(calculateMat(demand.liters, manufacturerRecipe), { waterLiters: 81, powderKg: 13.5, notice: null });
});

test('MAT calculator subtracts available whole milk and respects a water-based concentration', () => {
  const demand = getMatDemand({ mode: 'difference', total: '150', whole: '60' });
  assert.equal(demand.liters, 90);
  const result = calculateMat(demand.liters, { ...manufacturerRecipe, concentration_basis: 'water' });
  assert.equal(result.waterLiters, 81);
  assert.ok(Math.abs(result.powderKg - 12.15) < 1e-9);
  assert.equal(result.notice, null);
});

test('manufacturer yield can differ from the powder mass in kilograms', () => {
  const result = calculateMat(90, { ...manufacturerRecipe, reference_water_liters: 8.5 });
  assert.equal(result.waterLiters, 76.5);
  assert.equal(result.powderKg, 13.5);
});

test('MAT demand accepts decimal commas and decimal points and waits for missing input', () => {
  assert.equal(parseMatNumber(' 1,25 '), 1.25);
  assert.equal(parseMatNumber('1.25'), 1.25);
  assert.equal(getMatDemand({ mode: 'difference', total: '150,5', whole: '60,5' }).liters, 90);
  assert.deepEqual(getMatDemand({ mode: 'difference', total: '150', whole: '' }), { liters: null, notice: null });
  assert.deepEqual(getMatDemand({ mode: 'prepared', prepared: '' }), { liters: null, notice: null });
});

test('negative, malformed and non-finite volumes yield no calculated amount', () => {
  for (const prepared of ['-5', '1e3', '10l', 'Infinity', '9'.repeat(320)]) {
    const demand = getMatDemand({ mode: 'prepared', prepared });
    assert.equal(demand.liters, null, prepared);
    assert.match(demand.notice, /Literzahl/);
  }
  assert.match(getMatDemand({ mode: 'difference', total: '150', whole: '-60' }).notice, /Literzahl/);
  assert.match(calculateMat(-1, manufacturerRecipe).notice, /Literzahl/);
});

test('whole milk covering the entire requirement needs no water or powder', () => {
  const demand = getMatDemand({ mode: 'difference', total: '150', whole: '160' });
  assert.equal(demand.liters, 0);
  assert.deepEqual(calculateMat(demand.liters, null), { waterLiters: 0, powderKg: 0, notice: null });
});

test('missing concentration does not silently use a standard dose', () => {
  const result = calculateMat(90, null);
  assert.equal(result.waterLiters, null);
  assert.equal(result.powderKg, null);
  assert.match(result.notice, /keine MAT-Konzentration/);
});

test('without manufacturer yield a prepared-based dose can still give powder only', () => {
  const result = calculateMat(90, missingReference);
  assert.equal(result.waterLiters, null);
  assert.equal(result.powderKg, 13.5);
  assert.match(result.notice, /Herstellerbeispiel/);
});

test('without manufacturer yield a water-based dose cannot give either quantity', () => {
  const result = calculateMat(90, { ...missingReference, concentration_basis: 'water' });
  assert.equal(result.waterLiters, null);
  assert.equal(result.powderKg, null);
  assert.match(result.notice, /Herstellerbeispiel/);
});

test('MAT settings reject incomplete reference pairs and implausible dose or water values', () => {
  assert.equal(validateMatRecipe(manufacturerRecipe), null);
  assert.equal(validateMatRecipe(missingReference), null);
  assert.match(validateMatRecipe({ ...manufacturerRecipe, grams_per_liter: 10 }), /50 und 300/);
  assert.match(validateMatRecipe({ ...manufacturerRecipe, reference_prepared_liters: null }), /beide Mengen/);
  assert.match(validateMatRecipe({ ...manufacturerRecipe, reference_water_liters: 11 }), /Wassermenge/);
  assert.match(validateMatRecipe({ ...manufacturerRecipe, reference_water_liters: -1 }), /größer als 0/);
  assert.match(validateMatRecipe({ ...manufacturerRecipe, reference_prepared_liters: Infinity }), /Herstellerbeispiel/);
});
