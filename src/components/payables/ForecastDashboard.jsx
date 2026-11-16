import React, { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Bar, CartesianGrid, ComposedChart, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { AlertTriangle, Clock, Loader2, Save } from 'lucide-react';
import { payablesService } from '../../services/payablesService';
import { money } from './format';

const SOURCE_LABELS = { scheduled: 'Scheduled in BILL', planned: 'Planned', unplanned: 'Due, not planned' };
const SOURCE_COLORS = { scheduled: '#14b8a6', planned: '#38bdf8', unplanned: '#f59e0b' };

const day = (d) => (d ? format(parseISO(d), 'MMM d') : '');
const label = (s) => (s ? s.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : '');

function compactMoney(n) {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `$${Math.round(v / 1_000)}K`;
  return `$${Math.round(v)}`;
}

function Kpi({ label: title, value, note, tone }) {
  const toneClass = tone === 'warn' ? 'text-amber-300' : tone === 'bad' ? 'text-red-300' : 'text-white';
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{title}</p>
      <p className={`mt-2 text-2xl font-bold tabular-nums ${toneClass}`}>{value}</p>
      {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
    </div>
  );
}

function Panel({ title, action, children }) {
  return (
    <section className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Segmented({ value, onChange, items }) {
  return (
    <div className="inline-flex rounded-lg border border-slate-600 bg-slate-900 p-0.5">
      {items.map((item) => (
        <button key={item.id} type="button" onClick={() => onChange(item.id)}
          className={`rounded-md px-3 py-1 text-xs font-medium ${value === item.id ? 'bg-teal-500 text-slate-950' : 'text-slate-300 hover:text-white'}`}>
          {item.label}
        </button>
      ))}
    </div>
  );
}

function WeekTooltip({ active, payload, view }) {
  if (!active || !payload?.length) return null;
  const w = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 p-3 text-sm shadow-xl">
      <p className="mb-1 font-medium text-slate-200">Week of {day(w.week_start)}</p>
      {view === 'plan' ? (
        <>
          {['scheduled', 'planned', 'unplanned'].map((k) => w[k] > 0 && (
            <p key={k} className="tabular-nums" style={{ color: SOURCE_COLORS[k] }}>{SOURCE_LABELS[k]}: {money(w[k])}</p>
          ))}
          <p className="mt-1 text-white tabular-nums">Total {money(w.total)}</p>
        </>
      ) : (
        <p className="text-white tabular-nums">Due this week {money(w.by_due_date)}</p>
      )}
      {w.cash_after !== null && <p className="mt-1 text-slate-400 tabular-nums">Cash after this week {money(w.cash_after)}</p>}
      <p className="mt-1 text-xs text-slate-500">Click for details</p>
    </div>
  );
}

export default function ForecastDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [view, setView] = useState('plan');
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [cash, setCash] = useState({ startingCash: '', minCash: '' });
  const [savingCash, setSavingCash] = useState(false);
  const [cashMessage, setCashMessage] = useState('');

  async function load() {
    try {
      setError('');
      await payablesService.refreshPayPlans();
      const d = await payablesService.getForecast();
      setData(d);
      setCash({
        startingCash: d.settings?.starting_cash ?? '',
        minCash: d.settings?.min_cash ?? '',
      });
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { load(); }, []);

  async function saveCash(e) {
    e.preventDefault();
    setSavingCash(true);
    setCashMessage('');
    try {
      await payablesService.saveCashSettings(cash);
      await load();
      setCashMessage('Saved');
    } catch (err) {
      setCashMessage(err.message);
    } finally {
      setSavingCash(false);
    }
  }

  const weeks = useMemo(() => (data?.weeks || []).map((w) => ({
    ...w,
    label: format(parseISO(w.week_start), 'MMM d'),
    scheduled: Number(w.scheduled), planned: Number(w.planned), unplanned: Number(w.unplanned),
    total: Number(w.total), by_due_date: Number(w.by_due_date),
    cash_after: w.cash_after === null ? null : Number(w.cash_after),
  })), [data]);

  if (error) return <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">Could not load the forecast: {error}</div>;
  if (!data) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-teal-400" /></div>;

  const k = data.kpis;
  const hasCash = weeks.some((w) => w.cash_after !== null);
  const lowWeeks = weeks.filter((w) => w.below_minimum);
  const minCash = data.settings?.min_cash;
  const weekItems = selectedWeek
    ? (data.items || []).filter((i) => i.date >= selectedWeek.week_start && i.date <= selectedWeek.week_end)
    : [];

  return (
    <div className="space-y-6">
      {data.exceptions?.length > 0 && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-red-200"><AlertTriangle className="h-4 w-4" />Payment problems in the last 60 days</p>
          <ul className="mt-2 space-y-1 text-sm text-red-100">
            {data.exceptions.map((x) => (
              <li key={x.payment_id} className="flex flex-wrap justify-between gap-2">
                <span>{x.vendor_name} · {money(x.amount, { cents: true })} · {day(x.process_date)}</span>
                <span className="text-red-300">{label(x.status)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-red-300/80">Open the payment in BILL to fix or reissue it.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Open AP" value={money(k.open_ap)} note="Owed on all open bills" />
        <Kpi label="Past due" value={money(k.past_due)} tone={Number(k.past_due) > 0 ? 'bad' : undefined} note="Due date has passed" />
        <Kpi label="Due with no plan" value={money(k.due_not_planned)} tone={Number(k.due_not_planned) > 0 ? 'warn' : undefined} note="Not scheduled or planned yet" />
        <Kpi label="On hold" value={money(k.on_hold)} note="Bills you put on hold" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Kpi label="Cash out, next 7 days" value={money(k.next_7)} />
        <Kpi label="Cash out, next 30 days" value={money(k.next_30)} />
        <Kpi label="Cash out, next 90 days" value={money(k.next_90)} />
      </div>

      <Panel
        title="Cash out by week, next 13 weeks"
        action={<Segmented value={view} onChange={(v) => { setView(v); setSelectedWeek(null); }} items={[{ id: 'plan', label: 'By planned date' }, { id: 'due', label: 'By due date' }]} />}
      >
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={weeks} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              onClick={(e) => { const w = e?.activePayload?.[0]?.payload; if (w) setSelectedWeek(w); }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: '#334155' }} minTickGap={8} />
              <YAxis yAxisId="out" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={compactMoney} axisLine={{ stroke: '#334155' }} width={56} />
              {hasCash && <YAxis yAxisId="cash" orientation="right" tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={compactMoney} axisLine={{ stroke: '#334155' }} width={56} />}
              <Tooltip content={<WeekTooltip view={view} />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
              <Legend wrapperStyle={{ fontSize: 12, color: '#cbd5e1' }} />
              {view === 'plan' ? (
                ['scheduled', 'planned', 'unplanned'].map((key, i) => (
                  <Bar key={key} yAxisId="out" dataKey={key} name={SOURCE_LABELS[key]} stackId="out" fill={SOURCE_COLORS[key]}
                    radius={i === 2 ? [3, 3, 0, 0] : 0} cursor="pointer" />
                ))
              ) : (
                <Bar yAxisId="out" dataKey="by_due_date" name="Due" fill="#a78bfa" radius={[3, 3, 0, 0]} cursor="pointer" />
              )}
              {hasCash && view === 'plan' && (
                <Line yAxisId="cash" type="monotone" dataKey="cash_after" name="Cash after payments" stroke="#e2e8f0" strokeWidth={2}
                  dot={(p) => <circle key={p.index} cx={p.cx} cy={p.cy} r={p.payload.below_minimum ? 5 : 3} fill={p.payload.below_minimum ? '#f87171' : '#e2e8f0'} stroke="none" />} />
              )}
              {hasCash && view === 'plan' && minCash !== null && minCash !== undefined && (
                <ReferenceLine yAxisId="cash" y={Number(minCash)} stroke="#f87171" strokeDasharray="4 3" label={{ value: 'Minimum', fill: '#f87171', fontSize: 11, position: 'insideTopRight' }} />
              )}
              {selectedWeek && <ReferenceLine yAxisId="out" x={selectedWeek.label} stroke="#64748b" />}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-400">
          <span>Weeks run Monday to Sunday. Past-due and missed amounts show up today.</span>
          {Number(k.planned_after_due) > 0 && (
            <span className="text-amber-300">
              <Clock className="mr-1 inline h-3 w-3" />{money(k.planned_after_due)} is planned after its due date, {k.average_days_late} days late on average.
            </span>
          )}
          {Number(k.later_than_window) > 0 && <span>{money(k.later_than_window)} more is due after these 13 weeks.</span>}
        </div>
        {lowWeeks.length > 0 && view === 'plan' && (
          <p className="mt-2 text-sm text-red-300">
            Cash drops below your minimum in {lowWeeks.length === 1 ? 'the week' : 'the weeks'} of {lowWeeks.map((w) => day(w.week_start)).join(', ')}.
          </p>
        )}
      </Panel>

      {selectedWeek && (
        <Panel
          title={`Week of ${format(parseISO(selectedWeek.week_start), 'MMM d')} to ${format(parseISO(selectedWeek.week_end), 'MMM d, yyyy')}`}
          action={<button type="button" onClick={() => setSelectedWeek(null)} className="text-xs text-teal-400 hover:text-teal-300">Close</button>}
        >
          {view === 'due' && <p className="mb-2 text-xs text-slate-500">Showing what is expected to go out this week under the plan.</p>}
          {weekItems.length ? (
            <div className="overflow-x-auto rounded-lg border border-slate-700">
              <table className="w-full text-sm">
                <thead className="bg-slate-800 text-left text-xs uppercase tracking-wider text-slate-400">
                  <tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Vendor</th><th className="px-3 py-2">Invoice</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Due</th><th className="px-3 py-2 text-right">Amount</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {weekItems.map((i, idx) => (
                    <tr key={idx} className="text-slate-200">
                      <td className="whitespace-nowrap px-3 py-2">{day(i.date)}</td>
                      <td className="px-3 py-2">{i.vendor_name || 'Unknown vendor'}</td>
                      <td className="px-3 py-2 text-slate-400">{i.invoice_number || ''}</td>
                      <td className="px-3 py-2"><span style={{ color: SOURCE_COLORS[i.source] }}>{SOURCE_LABELS[i.source]}</span>
                        {i.status === 'missed' && <span className="ml-2 text-xs text-red-300">missed</span>}
                        {i.status === 'past_due' && <span className="ml-2 text-xs text-red-300">past due</span>}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-slate-400">{day(i.due_date)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{money(i.amount, { cents: true })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="text-sm text-slate-500">Nothing goes out this week.</p>}
        </Panel>
      )}

      <Panel title="Cash cushion">
        <form onSubmit={saveCash} className="flex flex-wrap items-end gap-3">
          <label htmlFor="cash-start" className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-400">Starting cash balance</span>
            <input id="cash-start" type="number" step="0.01" min="0" value={cash.startingCash}
              onChange={(e) => setCash((c) => ({ ...c, startingCash: e.target.value }))}
              className="w-48 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white focus:border-teal-500 focus:outline-none" placeholder="e.g. 250000" />
          </label>
          <label htmlFor="cash-min" className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-400">Minimum to keep</span>
            <input id="cash-min" type="number" step="0.01" min="0" value={cash.minCash}
              onChange={(e) => setCash((c) => ({ ...c, minCash: e.target.value }))}
              className="w-48 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white focus:border-teal-500 focus:outline-none" placeholder="e.g. 50000" />
          </label>
          <button type="submit" disabled={savingCash}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-60">
            {savingCash ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save
          </button>
          {cashMessage && <span className={`text-sm ${cashMessage === 'Saved' ? 'text-teal-400' : 'text-red-300'}`}>{cashMessage}</span>}
        </form>
        <p className="mt-2 text-xs text-slate-500">The chart subtracts each week's payments from the starting balance and marks any week that would fall below the minimum. Leave blank to hide.</p>
      </Panel>

      <Panel title="AP aging">
        <div className="overflow-x-auto rounded-lg border border-slate-700">
          <table className="w-full text-sm">
            <thead className="bg-slate-800 text-left text-xs uppercase tracking-wider text-slate-400">
              <tr><th className="px-3 py-2">Vendor</th><th className="px-3 py-2 text-right">Current</th><th className="px-3 py-2 text-right">1 to 30</th><th className="px-3 py-2 text-right">31 to 60</th><th className="px-3 py-2 text-right">61 to 90</th><th className="px-3 py-2 text-right">Over 90</th><th className="px-3 py-2 text-right">Total</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {(data.aging.vendors || []).map((v) => (
                <tr key={v.vendor_id || v.vendor_name} className="text-slate-200">
                  <td className="px-3 py-2">{v.vendor_name || 'Unknown vendor'}</td>
                  {['current', 'd1_30', 'd31_60', 'd61_90', 'd90_plus'].map((col) => (
                    <td key={col} className={`px-3 py-2 text-right tabular-nums ${col !== 'current' && Number(v[col]) > 0 ? 'text-amber-300' : ''}`}>
                      {Number(v[col]) ? money(v[col]) : '·'}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right font-medium tabular-nums">{money(v.total)}</td>
                </tr>
              ))}
              {!data.aging.vendors?.length && <tr><td colSpan={7} className="px-3 py-4 text-center text-slate-500">No open bills.</td></tr>}
            </tbody>
            {data.aging.vendors?.length > 0 && (
              <tfoot className="bg-slate-800/60 font-semibold text-white">
                <tr>
                  <td className="px-3 py-2">All vendors</td>
                  {['current', 'd1_30', 'd31_60', 'd61_90', 'd90_plus', 'total'].map((col) => (
                    <td key={col} className="px-3 py-2 text-right tabular-nums">{money(data.aging.totals[col])}</td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-500">Days past the due date, including amounts already scheduled but not cleared. Top 30 vendors by balance; the total row covers all vendors.</p>
      </Panel>

      <Panel title="Waiting on approval">
        {data.approvals?.length ? (
          <ul className="divide-y divide-slate-800 text-sm">
            {data.approvals.map((a) => (
              <li key={a.bill_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-slate-200">{a.vendor_name} <span className="text-slate-400">· {a.invoice_number || 'No invoice #'} · due {day(a.due_date)}</span></span>
                <span className="flex items-center gap-3">
                  <span className="tabular-nums text-white">{money(a.amount, { cents: true })}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${a.days_waiting > 7 ? 'bg-amber-500/15 text-amber-300' : 'bg-slate-700 text-slate-300'}`}>
                    {a.days_waiting} days · {label(a.approval_status)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-slate-500">No bills are waiting on approval.</p>}
        <p className="mt-2 text-xs text-slate-500">Days are counted from when the bill was entered in BILL.</p>
      </Panel>
    </div>
  );
}
