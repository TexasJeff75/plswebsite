import React, { useEffect, useMemo, useRef, useState } from 'react';
import { addDays, format, getWeek, parseISO } from 'date-fns';
import {
  Bar, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { AlertTriangle, Loader2, Pencil, Plus, Repeat, Save, Trash2, Users, X } from 'lucide-react';
import { payablesService } from '../../services/payablesService';
import { money } from './format';

// Weeks start on Sunday, like the cash flow spreadsheet.
const iso = (d) => format(d, 'yyyy-MM-dd');
const sunday = (isoDay) => {
  const d = parseISO(isoDay);
  return iso(addDays(d, -d.getDay()));
};
const shift = (isoDay, days) => iso(addDays(parseISO(isoDay), days));
const chicagoToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
const weekLabel = (w) => format(parseISO(w), 'MMM d');
const num = (v) => Number(v) || 0;

function compactMoney(n) {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `$${Math.round(v / 1_000)}K`;
  return `$${Math.round(v)}`;
}

function cellMoney(v) {
  if (v === null || v === undefined || Number(v) === 0) return '';
  return money(v);
}

function Kpi({ title, value, note, tone }) {
  const toneClass = tone === 'bad' ? 'text-red-300' : tone === 'warn' ? 'text-amber-300' : 'text-white';
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{title}</p>
      <p className={`mt-2 text-2xl font-bold tabular-nums ${toneClass}`}>{value}</p>
      {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
    </div>
  );
}

// A grid cell you can click to type an amount. Saves on Enter or when you leave it.
function EditCell({ value, onSave, className = '', label }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const ref = useRef(null);
  useEffect(() => { if (editing) ref.current?.select(); }, [editing]);

  function start() {
    setText(value ? String(Number(value)) : '');
    setEditing(true);
  }
  async function finish(save) {
    setEditing(false);
    if (!save) return;
    const cleaned = text.replace(/[$,\s]/g, '');
    if (cleaned !== '' && Number.isNaN(Number(cleaned))) return;
    const next = cleaned === '' ? null : Number(cleaned);
    if ((next || null) === (value ? Number(value) : null)) return;
    await onSave(next);
  }

  if (editing) {
    return (
      <input ref={ref} value={text} onChange={(e) => setText(e.target.value)} inputMode="decimal" aria-label={label}
        onBlur={() => finish(true)} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') finish(false); }}
        className="w-24 rounded border border-teal-500 bg-slate-900 px-1.5 py-0.5 text-right text-sm text-white focus:outline-none" />
    );
  }
  return (
    <button type="button" onClick={start} aria-label={label} title="Click to edit"
      className={`block min-h-[1.5rem] w-full rounded px-1.5 py-0.5 text-right tabular-nums hover:bg-slate-700/60 hover:ring-1 hover:ring-slate-500 ${className}`}>
      {cellMoney(value) || <span className="text-slate-700">·</span>}
    </button>
  );
}

const KIND_STYLE = {
  paid: 'bg-yellow-400/15 text-yellow-100',
  scheduled: 'bg-teal-500/15 text-teal-200',
  planned: 'bg-sky-500/10 text-sky-200',
};
const KIND_LABEL = { paid: 'Paid', scheduled: 'Scheduled in BILL', planned: 'Planned, not yet in BILL' };

function vendorCell(cell) {
  if (!cell) return null;
  const total = num(cell.paid) + num(cell.scheduled) + num(cell.planned);
  const kind = cell.planned ? 'planned' : cell.scheduled ? 'scheduled' : 'paid';
  const title = ['paid', 'scheduled', 'planned'].filter((k) => cell[k]).map((k) => `${KIND_LABEL[k]}: ${money(cell[k], { cents: true })}`).join('\n');
  return { total, kind, title };
}

function FillDialog({ line, weeks, currentWeek, onClose, onSave }) {
  const future = weeks.filter((w) => w >= currentWeek);
  const [amount, setAmount] = useState('');
  const [first, setFirst] = useState(currentWeek);
  const [every, setEvery] = useState(2);
  const [last, setLast] = useState(future[future.length - 1] || currentWeek);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const picks = [];
  for (let w = first; w <= last; w = shift(w, 7 * every)) picks.push(w);

  async function save() {
    const value = Number(String(amount).replace(/[$,\s]/g, ''));
    if (!value && value !== 0) return setError('Enter an amount');
    setBusy(true);
    setError('');
    try {
      await onSave(picks.map((w) => ({ week_start: w, amount: value })));
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const field = 'w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white focus:border-teal-500 focus:outline-none';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4" onClick={onClose}>
      <div role="dialog" aria-label={`Repeat ${line.name}`} className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-white">Repeat {line.name}</h3>
        <p className="mt-1 text-sm text-slate-400">Puts the same amount in a run of weeks. Enter 0 to clear them.</p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <label className="col-span-2 text-slate-300">Amount
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="e.g. 12572" className={`mt-1 ${field}`} />
          </label>
          <label className="text-slate-300">First week
            <select value={first} onChange={(e) => setFirst(e.target.value)} className={`mt-1 ${field}`}>
              {weeks.map((w) => <option key={w} value={w}>{weekLabel(w)}</option>)}
            </select>
          </label>
          <label className="text-slate-300">How often
            <select value={every} onChange={(e) => setEvery(Number(e.target.value))} className={`mt-1 ${field}`}>
              <option value={1}>Every week</option>
              <option value={2}>Every 2 weeks</option>
              <option value={3}>Every 3 weeks</option>
              <option value={4}>Every 4 weeks</option>
            </select>
          </label>
          <label className="col-span-2 text-slate-300">Through week
            <select value={last} onChange={(e) => setLast(e.target.value)} className={`mt-1 ${field}`}>
              {weeks.filter((w) => w >= first).map((w) => <option key={w} value={w}>{weekLabel(w)}</option>)}
            </select>
          </label>
        </div>
        <p className="mt-3 text-xs text-slate-400">{picks.length} {picks.length === 1 ? 'week' : 'weeks'}: {picks.slice(0, 8).map(weekLabel).join(', ')}{picks.length > 8 ? ', …' : ''}</p>
        {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">Cancel</button>
          <button type="button" disabled={busy || !picks.length || amount === ''} onClick={save}
            className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-teal-400 disabled:opacity-50">{busy ? 'Saving…' : 'Fill weeks'}</button>
        </div>
      </div>
    </div>
  );
}

function LineDialog({ line, direction, onClose, onSave }) {
  const [name, setName] = useState(line?.name || '');
  const [dir, setDir] = useState(line?.direction || direction || 'out');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function save() {
    setBusy(true);
    setError('');
    try {
      await onSave({ id: line?.id, name, direction: dir });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }
  const field = 'mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white focus:border-teal-500 focus:outline-none';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4" onClick={onClose}>
      <div role="dialog" aria-label={line ? 'Edit line' : 'Add line'} className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-white">{line ? 'Edit line' : 'Add a line'}</h3>
        <label className="mt-4 block text-sm text-slate-300">Name
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus className={field} />
        </label>
        <label className="mt-3 block text-sm text-slate-300">Type
          <select value={dir} onChange={(e) => setDir(e.target.value)} className={field}>
            <option value="in">Money in</option>
            <option value="out">Money out</option>
          </select>
        </label>
        {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">Cancel</button>
          <button type="button" disabled={busy || !name.trim()} onClick={save}
            className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-teal-400 disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

export default function CashFlow() {
  const [weeksBack, setWeeksBack] = useState(4);
  const [weeksAhead, setWeeksAhead] = useState(13);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [start, setStart] = useState({ amount: '', week: '', minCash: '' });
  const [savingStart, setSavingStart] = useState(false);
  const [filling, setFilling] = useState(null);
  const [lineDialog, setLineDialog] = useState(null); // { line } or { direction }
  const [deleting, setDeleting] = useState(null);

  const today = chicagoToday();
  const currentWeek = sunday(today);
  const viewFrom = shift(currentWeek, -7 * weeksBack);
  const viewTo = shift(currentWeek, 7 * weeksAhead);

  async function load() {
    try {
      setError('');
      const settings = await payablesService.getCashSettings();
      // Fetch from the opening-balance week so the running balance is right.
      let from = viewFrom;
      if (settings.starting_cash_week && settings.starting_cash_week < from) {
        from = settings.starting_cash_week < shift(viewTo, -7 * 100) ? shift(viewTo, -7 * 100) : settings.starting_cash_week;
      }
      const result = await payablesService.getCashFlow({ from, to: viewTo });
      setData(result);
      setStart({
        amount: settings.starting_cash ?? '',
        week: settings.starting_cash_week || currentWeek,
        minCash: settings.min_cash ?? '',
      });
    } catch (err) {
      setError(err.message);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [weeksBack, weeksAhead]);

  async function guard(fn) {
    setSaveError('');
    try {
      await fn();
      await load();
    } catch (err) {
      setSaveError(err.message);
    }
  }

  const model = useMemo(() => {
    if (!data) return null;
    const allWeeks = [];
    for (let w = data.from; w <= data.to; w = shift(w, 7)) allWeeks.push(w);
    const lines = data.lines || [];
    const inLines = lines.filter((l) => l.direction === 'in');
    const outLines = lines.filter((l) => l.direction === 'out');
    const vendors = data.vendors || [];
    const people = vendors.filter((v) => v.group === 'people');
    const others = vendors.filter((v) => v.group !== 'people');
    const settings = data.settings || {};
    const startWeek = settings.starting_cash_week || null;
    const startCash = settings.starting_cash === null || settings.starting_cash === undefined ? null : Number(settings.starting_cash);
    const minCash = settings.min_cash === null || settings.min_cash === undefined ? null : Number(settings.min_cash);

    const groupTotal = (list, w) => list.reduce((s, v) => {
      const c = v.weeks?.[w];
      return s + (c ? num(c.paid) + num(c.scheduled) + num(c.planned) : 0);
    }, 0);

    const cols = {};
    let prev = null;
    for (const w of allWeeks) {
      const totalIn = inLines.reduce((s, l) => s + num(l.amounts?.[w]), 0);
      const manualOut = outLines.reduce((s, l) => s + num(l.amounts?.[w]), 0);
      const peopleOut = groupTotal(people, w);
      const vendorOut = groupTotal(others, w);
      const totalOut = manualOut + peopleOut + vendorOut;
      const actual = data.actuals?.[w] !== undefined ? Number(data.actuals[w]) : null;
      let beg = null;
      if (startCash !== null && startWeek && w >= startWeek) {
        beg = w === startWeek ? startCash : (prev ? (prev.actual ?? prev.ending) : null);
      }
      const ending = beg === null ? null : beg + totalIn - totalOut;
      cols[w] = { totalIn, manualOut, peopleOut, vendorOut, totalOut, actual, beg, ending, unplanned: num(data.unplanned?.[w]) };
      prev = cols[w];
    }
    const weeks = allWeeks.filter((w) => w >= viewFrom);
    return { weeks, cols, inLines, outLines, people, others, minCash, startCash, startWeek };
  }, [data, viewFrom]);

  if (error) return <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">Could not load the cash flow: {error}</div>;
  if (!model) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-teal-400" /></div>;

  const { weeks, cols, inLines, outLines, people, others, minCash, startCash } = model;
  const ahead = weeks.filter((w) => w >= currentWeek);
  const hasBalance = startCash !== null;
  const lowest = hasBalance ? ahead.reduce((lo, w) => (cols[w].ending !== null && (lo === null || cols[w].ending < cols[lo].ending) ? w : lo), null) : null;
  const underMin = hasBalance && minCash !== null ? ahead.filter((w) => cols[w].ending !== null && cols[w].ending < minCash) : [];
  const next4 = ahead.slice(0, 4);
  const out4 = next4.reduce((s, w) => s + cols[w].totalOut, 0);
  const in4 = next4.reduce((s, w) => s + cols[w].totalIn, 0);
  const unplannedTotal = ahead.reduce((s, w) => s + cols[w].unplanned, 0);

  const chartData = weeks.map((w) => ({
    week: weekLabel(w), in: cols[w].totalIn, out: cols[w].totalOut, ending: cols[w].ending, actual: cols[w].actual,
  }));

  const endTone = (v) => {
    if (v === null) return '';
    if (v < 0) return 'bg-red-500/20 text-red-200 font-semibold';
    if (minCash !== null && v < minCash) return 'bg-amber-500/15 text-amber-200 font-semibold';
    return 'text-white font-semibold';
  };
  const colClass = (w) => (w === currentWeek ? 'bg-violet-500/10' : '');
  const stickyCell = 'sticky left-0 z-10 bg-slate-900 px-3 py-1.5 text-left';
  const numCell = (w) => `px-1.5 py-1 text-right tabular-nums whitespace-nowrap ${colClass(w)}`;
  const sectionRow = (title) => (
    <tr className="bg-slate-800/80">
      <th className="sticky left-0 z-10 bg-slate-800 px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</th>
      {weeks.map((w) => <td key={w} className={colClass(w)} />)}
    </tr>
  );
  const totalRow = (title, get, cls = 'font-semibold text-white') => (
    <tr className="border-t border-slate-700">
      <th className={`${stickyCell} ${cls}`}>{title}</th>
      {weeks.map((w) => <td key={w} className={`${numCell(w)} ${cls}`}>{cellMoney(get(w))}</td>)}
    </tr>
  );

  const lineRow = (l) => (
    <tr key={l.id} className="group">
      <th className={`${stickyCell} font-normal text-slate-200`}>
        <span className="flex items-center justify-between gap-2">
          <span className="truncate">{l.name}</span>
          <span className="flex shrink-0 gap-0.5 opacity-60 group-hover:opacity-100">
            <button type="button" onClick={() => setFilling(l)} title="Repeat an amount" aria-label={`Repeat ${l.name}`} className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-white"><Repeat className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => setLineDialog({ line: l })} title="Rename" aria-label={`Rename ${l.name}`} className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-white"><Pencil className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => setDeleting(l)} title="Delete line" aria-label={`Delete ${l.name}`} className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-red-300"><Trash2 className="h-3.5 w-3.5" /></button>
          </span>
        </span>
      </th>
      {weeks.map((w) => (
        <td key={w} className={`px-0.5 py-0.5 ${colClass(w)}`}>
          <EditCell value={l.amounts?.[w]} label={`${l.name}, week of ${weekLabel(w)}`}
            onSave={(v) => guard(() => payablesService.setCashAmounts(l.id, [{ week_start: w, amount: v ?? 0 }]))} />
        </td>
      ))}
    </tr>
  );

  const vendorRow = (v) => (
    <tr key={v.vendor_id} className="group">
      <th className={`${stickyCell} font-normal text-slate-300`}>
        <span className="flex items-center justify-between gap-2">
          <span className="truncate" title={v.vendor_name}>{v.vendor_name}</span>
          <button type="button" onClick={() => guard(() => payablesService.setVendorGroup(v.vendor_id, v.group === 'people' ? 'vendors' : 'people'))}
            title={v.group === 'people' ? 'Move to Vendors' : 'Move to People'} aria-label={v.group === 'people' ? `Move ${v.vendor_name} to Vendors` : `Move ${v.vendor_name} to People`}
            className="shrink-0 rounded p-1 text-slate-500 opacity-0 hover:bg-slate-700 hover:text-white group-hover:opacity-100 focus:opacity-100">
            <Users className="h-3.5 w-3.5" />
          </button>
        </span>
      </th>
      {weeks.map((w) => {
        const c = vendorCell(v.weeks?.[w]);
        return (
          <td key={w} className={`${numCell(w)} text-sm`}>
            {c && c.total > 0 && <span title={c.title} className={`inline-block rounded px-1.5 py-0.5 ${KIND_STYLE[c.kind]}`}>{money(c.total)}</span>}
          </td>
        );
      })}
    </tr>
  );

  const startField = 'rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white focus:border-teal-500 focus:outline-none';
  const startWeeks = [];
  for (let w = shift(currentWeek, -7 * 26); w <= currentWeek; w = shift(w, 7)) startWeeks.push(w);
  if (start.week && !startWeeks.includes(start.week)) startWeeks.unshift(start.week);

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-400">
        Week-by-week cash. Vendor and people payments come from BILL and your Pay Plan. Type your other lines (payroll, rent, loans, cash collected)
        into the grid. Each week starts with last week&apos;s actual ending if you entered one, otherwise the forecast ending.
      </p>

      <section className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm text-slate-300">Opening balance
            <input value={start.amount} onChange={(e) => setStart({ ...start, amount: e.target.value })} inputMode="decimal" placeholder="Bank balance" className={`mt-1 block w-40 ${startField}`} />
          </label>
          <label className="text-sm text-slate-300">At the start of the week of
            <select value={start.week} onChange={(e) => setStart({ ...start, week: e.target.value })} className={`mt-1 block ${startField}`}>
              {startWeeks.map((w) => <option key={w} value={w}>{weekLabel(w)}{w === currentWeek ? ' (this week)' : ''}</option>)}
            </select>
          </label>
          <label className="text-sm text-slate-300">Minimum cash
            <input value={start.minCash} onChange={(e) => setStart({ ...start, minCash: e.target.value })} inputMode="decimal" placeholder="e.g. 20000" className={`mt-1 block w-36 ${startField}`} />
          </label>
          <button type="button" disabled={savingStart}
            onClick={async () => { setSavingStart(true); await guard(() => payablesService.saveCashStart(start)); setSavingStart(false); }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-teal-400 disabled:opacity-50">
            <Save className="h-4 w-4" />{savingStart ? 'Saving…' : 'Save'}
          </button>
          <span className="ml-auto flex flex-wrap gap-3">
            <label className="text-sm text-slate-300">Past weeks
              <select value={weeksBack} onChange={(e) => setWeeksBack(Number(e.target.value))} className={`mt-1 block ${startField}`}>
                {[2, 4, 8, 13].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label className="text-sm text-slate-300">Weeks ahead
              <select value={weeksAhead} onChange={(e) => setWeeksAhead(Number(e.target.value))} className={`mt-1 block ${startField}`}>
                {[8, 13, 17, 26].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          </span>
        </div>
        {!hasBalance && <p className="mt-3 text-sm text-amber-300">Enter an opening balance to see the running balance.</p>}
      </section>

      {saveError && (
        <div className="flex items-start justify-between gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          <span>Not saved: {saveError}</span>
          <button type="button" onClick={() => setSaveError('')} aria-label="Dismiss"><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi title="Cash this week" value={hasBalance && cols[currentWeek]?.beg !== null && cols[currentWeek] ? money(cols[currentWeek].beg) : '·'} note={`Start of the week of ${weekLabel(currentWeek)}`} />
        <Kpi title="Lowest balance ahead" value={lowest ? money(cols[lowest].ending) : '·'}
          note={lowest ? `Week of ${weekLabel(lowest)}` : 'Needs an opening balance'}
          tone={lowest && cols[lowest].ending < 0 ? 'bad' : lowest && minCash !== null && cols[lowest].ending < minCash ? 'warn' : undefined} />
        <Kpi title="Weeks under minimum" value={minCash === null ? '·' : String(underMin.length)}
          note={minCash === null ? 'Set a minimum cash amount' : underMin.length ? `First: week of ${weekLabel(underMin[0])}` : `Above ${money(minCash)} every week`}
          tone={underMin.length ? 'warn' : undefined} />
        <Kpi title="Next 4 weeks" value={money(in4 - out4)} note={`${money(in4)} in, ${money(out4)} out`} tone={in4 - out4 < 0 ? 'warn' : undefined} />
      </div>

      {unplannedTotal > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{money(unplannedTotal)} of open bills have no pay plan, so they are not in this forecast. Plan or hold them on the Pay Plan tab.</span>
        </div>
      )}

      <section className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
        <h3 className="mb-3 text-base font-semibold text-white">Weekly cash</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#334155" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="week" tick={{ fill: '#94a3b8', fontSize: 12 }} tickLine={false} axisLine={{ stroke: '#475569' }} />
              <YAxis tickFormatter={compactMoney} tick={{ fill: '#94a3b8', fontSize: 12 }} tickLine={false} axisLine={false} width={56} />
              <Tooltip formatter={(v, n) => [money(v), n]} contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8 }} labelStyle={{ color: '#e2e8f0' }} />
              <Legend wrapperStyle={{ fontSize: 12, color: '#cbd5e1' }} />
              <Bar dataKey="in" name="Money in" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={22} />
              <Bar dataKey="out" name="Money out" fill="#f43f5e" radius={[3, 3, 0, 0]} maxBarSize={22} />
              <Line dataKey="ending" name="Ending balance" stroke="#38bdf8" strokeWidth={2.5} dot={{ r: 3 }} connectNulls isAnimationActive={false} />
              <Line dataKey="actual" name="Actual ending" stroke="#facc15" strokeWidth={0} dot={{ r: 5, fill: '#facc15' }} legendType="circle" isAnimationActive={false} />
              {minCash !== null && <ReferenceLine y={minCash} stroke="#f59e0b" strokeDasharray="5 4" label={{ value: 'Minimum', fill: '#f59e0b', fontSize: 11, position: 'insideTopLeft' }} />}
              <ReferenceLine y={0} stroke="#64748b" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-white">Cash flow forecast</h3>
          <span className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className={`rounded px-1.5 py-0.5 ${KIND_STYLE.paid}`}>Paid</span>
            <span className={`rounded px-1.5 py-0.5 ${KIND_STYLE.scheduled}`}>Scheduled in BILL</span>
            <span className={`rounded px-1.5 py-0.5 ${KIND_STYLE.planned}`}>Planned</span>
            <span className="rounded bg-violet-500/20 px-1.5 py-0.5 text-violet-200">This week</span>
          </span>
        </div>
        <div className="max-h-[75vh] overflow-auto rounded-lg border border-slate-700">
          <table className="text-sm">
            <thead className="sticky top-0 z-20 bg-slate-800 text-xs text-slate-400">
              <tr>
                <th className="sticky left-0 z-30 min-w-[14rem] bg-slate-800 px-3 py-2 text-left font-medium uppercase tracking-wider">Week of</th>
                {weeks.map((w) => (
                  <th key={w} className={`min-w-[6.5rem] px-1.5 py-2 text-right font-medium ${w === currentWeek ? 'bg-violet-500/25 text-violet-100' : ''}`}>
                    <span className="block text-slate-200">{weekLabel(w)}</span>
                    <span className="block font-normal">Wk {getWeek(parseISO(w), { weekStartsOn: 0 })}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {totalRow('Beginning balance', (w) => cols[w].beg)}

              {sectionRow('Money in')}
              {inLines.map(lineRow)}
              <tr><th className={stickyCell}><button type="button" onClick={() => setLineDialog({ direction: 'in' })} className="inline-flex items-center gap-1 text-xs text-teal-300 hover:text-teal-200"><Plus className="h-3.5 w-3.5" />Add money-in line</button></th>{weeks.map((w) => <td key={w} className={colClass(w)} />)}</tr>
              {totalRow('Total in', (w) => cols[w].totalIn, 'font-semibold text-emerald-300')}

              {sectionRow('Money out')}
              {outLines.map(lineRow)}
              <tr><th className={stickyCell}><button type="button" onClick={() => setLineDialog({ direction: 'out' })} className="inline-flex items-center gap-1 text-xs text-teal-300 hover:text-teal-200"><Plus className="h-3.5 w-3.5" />Add money-out line</button></th>{weeks.map((w) => <td key={w} className={colClass(w)} />)}</tr>
              {totalRow('People (from BILL)', (w) => cols[w].peopleOut, 'text-slate-200')}
              {totalRow('Vendors (from BILL)', (w) => cols[w].vendorOut, 'text-slate-200')}
              {totalRow('Total out', (w) => cols[w].totalOut, 'font-semibold text-rose-300')}

              <tr className="border-t-2 border-slate-600">
                <th className={`${stickyCell} font-semibold text-white`}>Ending balance</th>
                {weeks.map((w) => <td key={w} className={`${numCell(w)} ${endTone(cols[w].ending)}`}>{cols[w].ending === null ? '' : money(cols[w].ending)}</td>)}
              </tr>
              <tr>
                <th className={`${stickyCell} font-normal text-yellow-200`} title="Your bank balance at the end of the week. The next week starts from it.">Actual ending</th>
                {weeks.map((w) => (
                  <td key={w} className={`px-0.5 py-0.5 ${colClass(w)}`}>
                    {w <= currentWeek
                      ? <EditCell value={cols[w].actual} className="text-yellow-200" label={`Actual ending, week of ${weekLabel(w)}`} onSave={(v) => guard(() => payablesService.setCashActual(w, v))} />
                      : null}
                  </td>
                ))}
              </tr>
              <tr>
                <th className={`${stickyCell} font-normal text-xs text-slate-500`}>Actual minus forecast</th>
                {weeks.map((w) => {
                  const c = cols[w];
                  const diff = c.actual !== null && c.ending !== null ? c.actual - c.ending : null;
                  return <td key={w} className={`${numCell(w)} text-xs ${diff < 0 ? 'text-red-300' : 'text-slate-400'}`}>{diff === null ? '' : money(diff)}</td>;
                })}
              </tr>
              <tr>
                <th className={`${stickyCell} font-normal text-xs text-amber-300`} title="Open bills with no pay plan, by due date. Not counted above.">Not planned yet (not counted)</th>
                {weeks.map((w) => <td key={w} className={`${numCell(w)} text-xs text-amber-300/80`}>{cellMoney(cols[w].unplanned)}</td>)}
              </tr>

              {sectionRow(`People (${people.length})`)}
              {people.map(vendorRow)}
              {!people.length && <tr><td className={`${stickyCell} text-xs text-slate-500`}>Hover a vendor below and click the people icon to move it here.</td>{weeks.map((w) => <td key={w} className={colClass(w)} />)}</tr>}
              {sectionRow(`Vendors (${others.length})`)}
              {others.map(vendorRow)}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-500">Click any white amount to change it. Vendor amounts come from BILL: change them on the Pay Plan tab.</p>
      </section>

      {filling && (
        <FillDialog line={filling} weeks={weeks} currentWeek={currentWeek} onClose={() => setFilling(null)}
          onSave={async (amounts) => { await payablesService.setCashAmounts(filling.id, amounts); setFilling(null); await load(); }} />
      )}
      {lineDialog && (
        <LineDialog line={lineDialog.line} direction={lineDialog.direction} onClose={() => setLineDialog(null)}
          onSave={async (line) => { await payablesService.saveCashLine(line); setLineDialog(null); await load(); }} />
      )}
      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4" onClick={() => setDeleting(null)}>
          <div role="dialog" aria-label="Delete line" className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-white">Delete {deleting.name}?</h3>
            <p className="mt-1 text-sm text-slate-400">This removes the line and every amount in it.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setDeleting(null)} className="rounded-lg px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">Cancel</button>
              <button type="button" onClick={async () => { const l = deleting; setDeleting(null); await guard(() => payablesService.deleteCashLine(l.id)); }}
                className="rounded-lg bg-red-500/80 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
