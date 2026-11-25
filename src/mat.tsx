import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Plus, X } from 'lucide-react';
import { calculateMat, getMatDemand, parseMatNumber, validateMatRecipe, type ConcentrationBasis, type MatRecipe } from './mat-model';
import './mat.css';

type FarmMatProps = {
  client: SupabaseClient;
  farmId: string;
  online: boolean;
};

type LoadedRecipe = { farmId: string; recipe: MatRecipe | null; error: string | null };

function useFarmMatRecipe({ client, farmId, online }: FarmMatProps) {
  const [loaded, setLoaded] = useState<LoadedRecipe | null>(null);

  useEffect(() => {
    if (!online) return;
    let active = true;
    void client.from('farm_mat_settings')
      .select('concentration_basis,grams_per_liter,reference_water_liters,reference_prepared_liters')
      .eq('farm_id', farmId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (active) setLoaded({
          farmId,
          recipe: error ? null : data as MatRecipe | null,
          error: error ? 'Die MAT-Angaben konnten nicht geladen werden.' : null,
        });
      });
    return () => { active = false; };
  }, [client, farmId, online]);

  if (loaded?.farmId === farmId) return { ...loaded, loading: false };
  return {
    recipe: null,
    error: online ? null : 'Zum Laden der MAT-Angaben ist eine Internetverbindung erforderlich.',
    loading: online,
  };
}

const quantityFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 3 });

function formatQuantity(amount: number | null, unit: string): string {
  if (amount === null) return '–';
  if (amount > 0 && amount < 0.001) return '< 0,001 ' + unit;
  return quantityFormat.format(amount) + ' ' + unit;
}

export function MatCalculatorButton(props: FarmMatProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [mode, setMode] = useState<'prepared' | 'difference'>('prepared');
  const [prepared, setPrepared] = useState('');
  const [total, setTotal] = useState('');
  const [whole, setWhole] = useState('');
  const { recipe, error, loading } = useFarmMatRecipe(props);

  const demand = getMatDemand(mode === 'prepared' ? { mode, prepared } : { mode, total, whole });
  const result = demand.liters === null ? null : calculateMat(demand.liters, recipe);
  const notice = loading ? 'MAT-Angaben werden geladen …' : error ?? demand.notice ?? result?.notice;

  return <>
    <button type="button" className="outline mat-touch-target" onClick={() => dialog.current?.showModal()}>
      <Plus size={17} aria-hidden="true" /> MAT-Rechner
    </button>
    <dialog ref={dialog} className="mat-dialog" aria-labelledby={titleId}>
      <div className="mat-dialog-header">
        <h2 id={titleId}>MAT-Rechner</h2>
        <button type="button" className="outline mat-touch-target" aria-label="MAT-Rechner schließen" onClick={() => dialog.current?.close()}>
          <X size={20} aria-hidden="true" />
        </button>
      </div>
      <div className="mat-modes" role="group" aria-label="Berechnungsart">
        <button type="button" className={mode === 'prepared' ? 'primary' : 'outline'} aria-pressed={mode === 'prepared'} onClick={() => setMode('prepared')}>
          Fertige MAT-Tränke
        </button>
        <button type="button" className={mode === 'difference' ? 'primary' : 'outline'} aria-pressed={mode === 'difference'} onClick={() => setMode('difference')}>
          Gesamtbedarf und Vollmilch
        </button>
      </div>
      {mode === 'prepared'
        ? <label>Benötigte fertige MAT-Tränke (l)
          <input type="text" inputMode="decimal" autoComplete="off" value={prepared} onChange={event => setPrepared(event.target.value)} />
        </label>
        : <div className="form-grid mat-form-grid">
          <label>Gesamtbedarf (l)
            <input type="text" inputMode="decimal" autoComplete="off" value={total} onChange={event => setTotal(event.target.value)} />
          </label>
          <label>Vorhandene Vollmilch (l)
            <input type="text" inputMode="decimal" autoComplete="off" value={whole} onChange={event => setWhole(event.target.value)} />
          </label>
        </div>}
      <div role="status">
        <dl className="mat-results">
          <div><dt>Wasser</dt><dd>{formatQuantity(result?.waterLiters ?? null, 'l')}</dd></div>
          <div><dt>MAT-Pulver</dt><dd>{formatQuantity(result?.powderKg ?? null, 'kg')}</dd></div>
          <div><dt>Fertige MAT-Tränke</dt><dd>{formatQuantity(demand.liters, 'l')}</dd></div>
        </dl>
        {notice && <p className="notice">{notice}</p>}
      </div>
      {recipe && <p className="subtle mat-recipe-note">
        Im Betrieb hinterlegt sind {quantityFormat.format(recipe.grams_per_liter)} g je Liter {recipe.concentration_basis === 'water' ? 'Wasser' : 'fertige Tränke'}.
      </p>}
    </dialog>
  </>;
}

export function MatSettings(props: FarmMatProps & { owner: boolean }) {
  const { recipe, error, loading } = useFarmMatRecipe(props);
  const titleId = useId();

  return <section className="panel mat-settings" aria-labelledby={titleId}>
    <h2 id={titleId}>MAT-Anmischung</h2>
    {loading && <p className="subtle" role="status">MAT-Angaben werden geladen …</p>}
    {error && <p className="notice" role="status">{error}</p>}
    {!loading && !error && (props.owner
      ? <MatSettingsForm {...props} initialRecipe={recipe} />
      : recipe
        ? <>
          <p>{quantityFormat.format(recipe.grams_per_liter)} g MAT-Pulver je Liter {recipe.concentration_basis === 'water' ? 'Wasser' : 'fertige Tränke'}.</p>
          <p className="subtle">{recipe.reference_water_liters === null || recipe.reference_prepared_liters === null
            ? 'Das Herstellerbeispiel zur Wassermenge fehlt noch.'
            : `${formatQuantity(recipe.reference_water_liters, 'l')} Wasser ergeben ${formatQuantity(recipe.reference_prepared_liters, 'l')} fertige Tränke.`}</p>
        </>
        : <p className="subtle">Die Betriebsleitung hat noch keine MAT-Angaben hinterlegt.</p>)}
  </section>;
}

function MatSettingsForm({ client, farmId, online, initialRecipe }: FarmMatProps & { initialRecipe: MatRecipe | null }) {
  const [basis, setBasis] = useState<ConcentrationBasis>(initialRecipe?.concentration_basis ?? 'prepared');
  const [grams, setGrams] = useState(initialRecipe?.grams_per_liter.toString() ?? '');
  const [water, setWater] = useState(initialRecipe?.reference_water_liters?.toString() ?? '');
  const [prepared, setPrepared] = useState(initialRecipe?.reference_prepared_liters?.toString() ?? '');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!online || saving) return;

    const recipe: MatRecipe = {
      concentration_basis: basis,
      grams_per_liter: parseMatNumber(grams) ?? Number.NaN,
      reference_water_liters: parseMatNumber(water),
      reference_prepared_liters: parseMatNumber(prepared),
    };
    const issue = validateMatRecipe(recipe);
    if (issue) {
      setNotice(issue);
      return;
    }

    setSaving(true);
    setNotice('');
    const { error } = await client.from('farm_mat_settings').upsert({ farm_id: farmId, ...recipe }, { onConflict: 'farm_id' });
    setSaving(false);
    setNotice(error ? 'Die MAT-Angaben konnten nicht gespeichert werden. Bitte versuche es erneut.' : 'MAT-Angaben gespeichert.');
  }

  return <form className="mat-settings-form" onSubmit={save}>
    <div className="form-grid mat-form-grid">
      <label>MAT-Konzentration (g je Liter)
        <input type="text" inputMode="decimal" required value={grams} onChange={event => setGrams(event.target.value)} />
      </label>
      <label>Bezugsmenge der Konzentration
        <select value={basis} onChange={event => setBasis(event.target.value as ConcentrationBasis)}>
          <option value="prepared">Je Liter fertiger MAT-Tränke</option>
          <option value="water">Je Liter Wasser</option>
        </select>
      </label>
    </div>
    <fieldset>
      <legend>Mengen aus demselben Herstellerbeispiel (optional)</legend>
      <div className="form-grid mat-form-grid">
        <label>Wasser (l)
          <input type="text" inputMode="decimal" value={water} onChange={event => setWater(event.target.value)} />
        </label>
        <label>Fertige MAT-Tränke (l)
          <input type="text" inputMode="decimal" value={prepared} onChange={event => setPrepared(event.target.value)} />
        </label>
      </div>
      <p className="subtle mat-recipe-note">Der Rechner übernimmt aus diesen beiden Mengen das Mischungsverhältnis.</p>
    </fieldset>
    {!online && <p className="subtle">Zum Speichern ist eine Internetverbindung erforderlich.</p>}
    {notice && <p className="notice" role="status">{notice}</p>}
    <button type="submit" className="primary mat-touch-target" disabled={!online || saving}>
      {saving ? 'Speichert …' : 'MAT-Angaben speichern'}
    </button>
  </form>;
}
