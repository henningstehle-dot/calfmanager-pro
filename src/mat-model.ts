export type ConcentrationBasis = 'prepared' | 'water';

export type MatRecipe = {
  concentration_basis: ConcentrationBasis;
  grams_per_liter: number;
  reference_water_liters: number | null;
  reference_prepared_liters: number | null;
};

export type MatDemand = { mode: 'prepared'; prepared: string }
  | { mode: 'difference'; total: string; whole: string };

const concentrationError = 'Die MAT-Konzentration muss zwischen 50 und 300 g je Liter liegen. Wähle dazu die Bezugsmenge der Herstellerangabe.';

export function parseMatNumber(input: string): number | null {
  const value = input.trim();
  if (!value) return null;
  if (!/^(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(value)) return Number.NaN;
  return Number(value.replace(',', '.'));
}

export function getMatDemand(input: MatDemand): { liters: number | null; notice: string | null } {
  const values = input.mode === 'prepared' ? [input.prepared] : [input.total, input.whole];
  const amounts = values.map(parseMatNumber);
  if (amounts.some(amount => amount !== null && !Number.isFinite(amount))) {
    return { liters: null, notice: 'Gib eine gültige Literzahl ab 0 ein.' };
  }
  const [first, second] = amounts;
  if (first === null || (input.mode === 'difference' && second === null)) {
    return { liters: null, notice: null };
  }
  return { liters: Math.max(0, first - (second ?? 0)), notice: null };
}

function hasValidConcentration(recipe: MatRecipe): boolean {
  return (recipe.concentration_basis === 'prepared' || recipe.concentration_basis === 'water')
    && Number.isFinite(recipe.grams_per_liter)
    && recipe.grams_per_liter >= 50
    && recipe.grams_per_liter <= 300;
}

function referenceIssue(water: number | null, prepared: number | null): string | null {
  if (water === null && prepared === null) return null;
  if (water === null || prepared === null) return 'Gib beide Mengen aus demselben Herstellerbeispiel an.';
  if (!Number.isFinite(water) || !Number.isFinite(prepared) || water <= 0 || prepared <= 0 || water > prepared) {
    return 'Prüfe das Herstellerbeispiel. Beide Mengen müssen größer als 0 sein. Die Wassermenge darf höchstens der fertigen Tränkemenge entsprechen.';
  }
  return null;
}

export function validateMatRecipe(recipe: MatRecipe): string | null {
  if (!hasValidConcentration(recipe)) return concentrationError;
  return referenceIssue(recipe.reference_water_liters, recipe.reference_prepared_liters);
}

export function calculateMat(preparedLiters: number, recipe: MatRecipe | null): {
  waterLiters: number | null;
  powderKg: number | null;
  notice: string | null;
} {
  if (!Number.isFinite(preparedLiters) || preparedLiters < 0) {
    return { waterLiters: null, powderKg: null, notice: 'Gib eine gültige Literzahl ab 0 ein.' };
  }
  if (preparedLiters === 0) return { waterLiters: 0, powderKg: 0, notice: null };
  if (!recipe) {
    return { waterLiters: null, powderKg: null, notice: 'In den Betriebseinstellungen ist noch keine MAT-Konzentration hinterlegt.' };
  }
  if (!hasValidConcentration(recipe)) return { waterLiters: null, powderKg: null, notice: concentrationError };

  const { reference_water_liters: water, reference_prepared_liters: prepared } = recipe;
  const invalidReference = referenceIssue(water, prepared);
  const waterLiters = water !== null && prepared !== null && !invalidReference
    ? preparedLiters * (water / prepared)
    : null;
  const baseLiters = recipe.concentration_basis === 'prepared' ? preparedLiters : waterLiters;
  return {
    waterLiters,
    powderKg: baseLiters === null ? null : baseLiters * (recipe.grams_per_liter / 1000),
    notice: waterLiters === null
      ? invalidReference ?? 'Für die Wassermenge fehlt das Herstellerbeispiel in den Betriebseinstellungen.'
      : null,
  };
}
