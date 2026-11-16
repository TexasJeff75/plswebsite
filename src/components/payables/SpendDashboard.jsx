import React, { useEffect, useMemo, useState } from 'react';
import {
  endOfMonth, endOfQuarter, endOfYear, format, parseISO, startOfMonth,
  startOfQuarter, startOfYear, subMonths,
} from 'date-fns';
import {
  Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { AlertTriangle, Copy, Loader2, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import { payablesService } from '../../services/payablesService';
import VendorDrawer from './VendorDrawer';
import { money } from './format';

const SERIES_COLORS = ['#14b8a6', '#38bdf8', '#a78bfa', '#f59e0b', '#f472b6', '#4ade80', '#fb7185', '#64748b', '#475569'];

const PRESETS = [
  { id: 'month', label: 'This month' },
  { id: 'quarter', label: 'This quarter' },
  { id: 'year', label: 'This year' },
  { id: 'last12', label: 'Last 12 months' },
  { id: 'custom', label: 'Custom' },
];

const BREAKDOWNS = [
  { id: 'chart_of_account', label: 'GL account' },
  { id: 'department', label: 'Department' },
  { id: 'accounting_class', label: 'Class' },
  { id: 'location', label: 'Location' },
];

const iso = (d) => format(d, 'yyyy-MM-dd');

function presetRange(id, today = new Date()) {
  switch (id) {
    case 'quarter': return { from: iso(startOfQuarter(today)), to: iso(endOfQuarter(today)) };
    case 'year': return { from: iso(startOfYear(today)), to: iso(endOfYear(today)) };
    case 'last12': return { from: iso(startOfMonth(subMonths(today, 11))), to: iso(endOfMonth(today)) };
    default: return { from: iso(startOfMonth(today)), to: iso(endOfMonth(today)) };
  }
}

function compactMoney(n) {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `$${Math.round(v / 1_000)}K`;
  return `$${Math.round(v)}`;
}

function changePct(current, prior) {
  if (!prior) return null;
  return ((current - prior) / prior) * 100;
}

function formatDay(d) {
  return d ? format(parseISO(d), 'MMM d, yyyy') : '';
}

function Change({ current, prior }) {
  const pct = changePct(Number(current), Number(prior));
  if (pct === null) return <span className="text-slate-500">No spend same period last year</span>;
  // Spending more is shown in amber, not green: higher spend is not good news.
  const up = pct >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 ${up ? 'text-amber-400' : 'text-teal-400'}`}>
      <Icon className="h-3 w-3" />
      {up ? '+' : ''}{pct.toFixed(1)}% vs last year ({money(prior)})
    </span>
  );
}

function Kpi({ label, value, children }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-white tabular-nums">{value}</p>
      <div className="mt-1 text-xs">{children}</div>
    </div>
  );
}

function Panel({ title, action, children, className = '' }) {
  return (
    <section className={`rounded-lg border border-slate-700 bg-slate-800/50 p-4 ${className}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Select({ id, label, value, onChange, children }) {
  return (
    <label htmlFor={id} className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-medium text-slate-400">{label}</span>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white focus:border-teal-500 focus:outline-none"
      >
        {children}
      </select>
    </label>
  );
}

function Segmented({ value, onChange, items }) {
  return (
    <div className="inline-flex rounded-lg border border-slate-600 bg-slate-900 p-0.5">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={`rounded-md px-3 py-1 text-xs font-medium ${value === item.id ? 'bg-teal-500 text-slate-950' : 'text-slate-300 hover:text-white'}`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function BarList({ rows, total, onSelect, emptyText }) {
  if (!rows?.length) return <p className="text-sm text-slate-500">{emptyText}</p>;
  const max = Math.max(...rows.map((r) => Number(r.amount)));
  return (
    <ul className="space-y-2">
      {rows.map((r) => {
        const share = total ? (Number(r.amount) / total) * 100 : 0;
        const inner = (
          <>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className={`truncate ${r.id ? 'text-slate-200' : 'italic text-slate-400'}`}>{r.name}</span>
              <span className="flex-shrink-0 tabular-nums text-white">
                {money(r.amount)} <span className="text-xs text-slate-400">{share.toFixed(1)}%</span>
              </span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-slate-700">
              <div className="h-1.5 rounded-full bg-teal-500" style={{ width: `${max ? (Number(r.amount) / max) * 100 : 0}%` }} />
            </div>
          </>
        );
        return (
          <li key={r.id ?? 'none'}>
            {onSelect && r.id ? (
              <button type="button" onClick={() => onSelect(r)} className="block w-full rounded text-left hover:bg-slate-700/40 focus:outline-none focus:ring-1 focus:ring-teal-500">
                {inner}
              </button>
            ) : inner}
          </li>
        );
      })}
    </ul>
  );
}

function TrendTooltip({ active, payload, label, groups }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 p-3 text-sm shadow-xl">
      <p className="mb-1 font-medium text-slate-200">{label}</p>
      <p className="mb-2 text-white tabular-nums">Total {money(point.total)}</p>
      {groups.filter((g) => point[g.id]).map((g) => (
        <p key={g.id} className="tabular-nums" style={{ color: SERIES_COLORS[groups.indexOf(g) % SERIES_COLORS.length] }}>
          {g.name}: {money(point[g.id])}
        </p>
      ))}
      <p className="mt-2 text-slate-400 tabular-nums">3-month average {money(point.avg3)}</p>
    </div>
  );
}

export default function SpendDashboard({ options }) {
  const [preset, setPreset] = useState('month');
  const [range, setRange] = useState(() => presetRange('month'));
  const [basis, setBasis] = useState('billed');
  const [groupBy, setGroupBy] = useState('chart_of_account');
  const [filters, setFilters] = useState({ vendorId: '', chartOfAccountId: '', departmentId: '', accountingClassId: '', locationId: '' });
  const [breakdown, setBreakdown] = useState('chart_of_account');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [vendorId, setVendorId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    payablesService.getSpendDashboard({ ...range, ...filters, basis, groupBy })
      .then((d) => { if (!cancelled) setData(d); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [range, filters, basis, groupBy]);

  function choosePreset(id) {
    setPreset(id);
    if (id !== 'custom') setRange(presetRange(id));
  }

  function setFilter(key, value) {
    setFilters((f) => ({ ...f, [key]: value }));
  }

  const trendData = useMemo(() => {
    const months = data?.trend?.months || [];
    return months.map((m, i) => {
      const window = months.slice(Math.max(0, i - 2), i + 1);
      return {
        label: format(parseISO(m.month), "MMM ''yy"),
        total: Number(m.total),
        avg3: window.reduce((s, w) => s + Number(w.total), 0) / window.length,
        ...Object.fromEntries(Object.entries(m.by_group || {}).map(([k, v]) => [k, Number(v)])),
      };
    });
  }, [data]);

  const groups = data?.trend?.groups || [];
  const kpis = data?.kpis;
  const total = Number(kpis?.total || 0);
  const anyFilter = Object.values(filters).some(Boolean);
  const watch = data?.watch || {};
  const recurring = Number(data?.recurring?.recurring || 0);
  const oneTime = Number(data?.recurring?.one_time || 0);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="space-y-3 rounded-lg border border-slate-700 bg-slate-800/50 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented value={preset} onChange={choosePreset} items={PRESETS} />
          {preset === 'custom' && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <input id="spend-from" type="date" value={range.from} max={range.to}
                onChange={(e) => e.target.value && setRange((r) => ({ ...r, from: e.target.value }))}
                className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-white" aria-label="From date" />
              <span className="text-slate-400">to</span>
              <input id="spend-to" type="date" value={range.to} min={range.from}
                onChange={(e) => e.target.value && setRange((r) => ({ ...r, to: e.target.value }))}
                className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 text-white" aria-label="To date" />
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-slate-400">Count spend when</span>
            <Segmented value={basis} onChange={setBasis} items={[{ id: 'billed', label: 'Billed' }, { id: 'paid', label: 'Paid' }]} />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Select id="spend-vendor" label="Vendor" value={filters.vendorId} onChange={(v) => setFilter('vendorId', v)}>
            <option value="">All vendors</option>
            {options.vendors.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </Select>
          <Select id="spend-gl" label="GL account" value={filters.chartOfAccountId} onChange={(v) => setFilter('chartOfAccountId', v)}>
            <option value="">All GL accounts</option>
            {options.chart_of_account.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </Select>
          <Select id="spend-dept" label="Department" value={filters.departmentId} onChange={(v) => setFilter('departmentId', v)}>
            <option value="">All departments</option>
            {options.department.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </Select>
          <Select id="spend-class" label="Class" value={filters.accountingClassId} onChange={(v) => setFilter('accountingClassId', v)}>
            <option value="">All classes</option>
            {options.accounting_class.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </Select>
          <Select id="spend-location" label="Location" value={filters.locationId} onChange={(v) => setFilter('locationId', v)}>
            <option value="">All locations</option>
            {options.location.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </Select>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
          <span>
            {formatDay(range.from)} to {formatDay(range.to)} · {basis === 'billed' ? 'by bill date' : 'by payment date'}
          </span>
          {anyFilter && (
            <button type="button" className="text-teal-400 hover:text-teal-300"
              onClick={() => setFilters({ vendorId: '', chartOfAccountId: '', departmentId: '', accountingClassId: '', locationId: '' })}>
              Clear filters
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">Could not load spend: {error}</div>
      )}

      {loading && !data && (
        <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-teal-400" /></div>
      )}

      {data && (
        <div className={`space-y-6 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          {/* Headline numbers */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Spend in range" value={money(total)}>
              <Change current={total} prior={kpis.prior_year_total} />
            </Kpi>
            <Kpi label="Month to date" value={money(kpis.periods.month.current)}>
              <Change current={kpis.periods.month.current} prior={kpis.periods.month.prior} />
            </Kpi>
            <Kpi label="Quarter to date" value={money(kpis.periods.quarter.current)}>
              <Change current={kpis.periods.quarter.current} prior={kpis.periods.quarter.prior} />
            </Kpi>
            <Kpi label="Year to date" value={money(kpis.periods.year.current)}>
              <Change current={kpis.periods.year.current} prior={kpis.periods.year.prior} />
            </Kpi>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Kpi label="Bills in range" value={Number(kpis.bill_count).toLocaleString()} />
            <Kpi label="Vendors in range" value={Number(kpis.vendor_count).toLocaleString()} />
            <Kpi label="Average bill" value={money(kpis.average_bill)} />
          </div>

          {/* Trend */}
          <Panel
            title="Monthly spend, last 24 months"
            action={<Segmented value={groupBy} onChange={setGroupBy} items={[{ id: 'chart_of_account', label: 'By GL account' }, { id: 'department', label: 'By department' }]} />}
          >
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: '#334155' }} interval="preserveStartEnd" minTickGap={12} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={compactMoney} axisLine={{ stroke: '#334155' }} width={56} />
                  <Tooltip content={<TrendTooltip groups={groups} />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#cbd5e1' }} />
                  {groups.map((g, i) => (
                    <Bar key={g.id} dataKey={g.id} name={g.name} stackId="spend" fill={SERIES_COLORS[i % SERIES_COLORS.length]}
                      radius={i === groups.length - 1 ? [3, 3, 0, 0] : 0} />
                  ))}
                  <Line type="monotone" dataKey="avg3" name="3-month average" stroke="#e2e8f0" strokeWidth={2} dot={false} strokeDasharray="4 3" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-xs text-slate-500">The chart shows the 24 months ending with the last month of the selected range, with the vendor and coding filters applied.</p>
          </Panel>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Panel title="Top vendors">
              <BarList
                rows={(data.top_vendors || []).map((v) => ({ id: v.vendor_id, name: v.vendor_name || 'Unknown vendor', amount: v.amount }))}
                total={total}
                onSelect={(r) => setVendorId(r.id)}
                emptyText="No spend in this range."
              />
              {data.top_vendors?.length > 0 && <p className="mt-3 text-xs text-slate-500">Click a vendor for its bills, payments and trend.</p>}
            </Panel>

            <Panel
              title="Where it went"
              action={<Segmented value={breakdown} onChange={setBreakdown} items={BREAKDOWNS} />}
            >
              <BarList rows={(data.breakdowns?.[breakdown] || []).slice(0, 15)} total={total} emptyText="No spend in this range." />
            </Panel>
          </div>

          <Panel title="Recurring versus one-time">
            <div className="flex flex-wrap items-baseline gap-6 text-sm">
              <div><span className="text-slate-400">Recurring bills</span> <span className="ml-2 font-semibold text-white tabular-nums">{money(recurring)}</span></div>
              <div><span className="text-slate-400">One-time bills</span> <span className="ml-2 font-semibold text-white tabular-nums">{money(oneTime)}</span></div>
            </div>
            <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-slate-700">
              <div className="bg-sky-400" style={{ width: `${recurring + oneTime ? (recurring / (recurring + oneTime)) * 100 : 0}%` }} />
              <div className="bg-teal-500" style={{ width: `${recurring + oneTime ? (oneTime / (recurring + oneTime)) * 100 : 0}%` }} />
            </div>
            <p className="mt-2 text-xs text-slate-500">Recurring means the bill was created from a recurring bill in BILL.</p>
          </Panel>

          {/* Watch list */}
          <Panel title="Watch list">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="min-w-0">
                <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-300"><AlertTriangle className="h-4 w-4" />Unusually large bills</h4>
                <p className="mb-3 text-xs text-slate-500">More than twice that vendor's average over the prior 12 months.</p>
                {watch.large_bills?.length ? (
                  <ul className="space-y-2 text-sm">
                    {watch.large_bills.map((b) => (
                      <li key={b.id} className="rounded border border-slate-700 p-2">
                        <button type="button" className="text-left text-slate-200 hover:text-teal-300" onClick={() => setVendorId(b.vendor_id)}>{b.vendor_name}</button>
                        <div className="flex justify-between gap-2 text-xs text-slate-400">
                          <span>{b.invoice_number || 'No invoice #'} · {formatDay(b.bill_date)}</span>
                          <span className="tabular-nums text-white">{money(b.amount)}</span>
                        </div>
                        <p className="text-xs text-slate-500">Usual: about {money(b.avg_amount)}</p>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-slate-500">None in this range.</p>}
              </div>
              <div className="min-w-0">
                <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-sky-300"><Sparkles className="h-4 w-4" />New vendors</h4>
                <p className="mb-3 text-xs text-slate-500">First bill falls in this range.</p>
                {watch.new_vendors?.length ? (
                  <ul className="space-y-2 text-sm">
                    {watch.new_vendors.map((v) => (
                      <li key={v.vendor_id} className="flex justify-between gap-2 rounded border border-slate-700 p-2">
                        <button type="button" className="truncate text-left text-slate-200 hover:text-teal-300" onClick={() => setVendorId(v.vendor_id)}>{v.vendor_name}</button>
                        <span className="flex-shrink-0 text-xs text-slate-400">{formatDay(v.first_bill_date)} · <span className="tabular-nums text-white">{money(v.amount_in_range)}</span></span>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-slate-500">None in this range.</p>}
              </div>
              <div className="min-w-0">
                <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-rose-300"><Copy className="h-4 w-4" />Possible duplicates</h4>
                <p className="mb-3 text-xs text-slate-500">Same vendor and amount within 30 days. Recurring bills are left out.</p>
                {watch.duplicates?.length ? (
                  <ul className="space-y-2 text-sm">
                    {watch.duplicates.map((d) => (
                      <li key={`${d.bill_id}-${d.other_bill_id}`} className="rounded border border-slate-700 p-2">
                        <div className="flex justify-between gap-2">
                          <button type="button" className="truncate text-left text-slate-200 hover:text-teal-300" onClick={() => setVendorId(d.vendor_id)}>{d.vendor_name}</button>
                          <span className="tabular-nums text-white">{money(d.amount, { cents: true })}</span>
                        </div>
                        <p className="text-xs text-slate-400">
                          {d.invoice_number || 'No invoice #'} ({formatDay(d.bill_date)}) and {d.other_invoice_number || 'no invoice #'} ({formatDay(d.other_bill_date)})
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : <p className="text-sm text-slate-500">None in this range.</p>}
              </div>
            </div>
          </Panel>
        </div>
      )}

      {vendorId && <VendorDrawer vendorId={vendorId} onClose={() => setVendorId(null)} />}
    </div>
  );
}
