import React, { useEffect, useMemo, useState } from 'react';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Loader2 } from 'lucide-react';
import { payablesService } from '../../services/payablesService';
import { money } from './format';

// Bank tab: the newest daily snapshot of the operating account (****5761),
// sent by the daily bank update. Read only.

const monthName = (m) => (m ? format(parseISO(`${m}-01`), 'MMMM yyyy') : '');
const shortDay = (d) => (d ? format(parseISO(d), 'MMM d') : '');
const signed = (n) => `${Number(n) < 0 ? '-' : '+'}${money(Math.abs(Number(n) || 0))}`;

function compactMoney(n) {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `$${Math.round(v / 1_000)}K`;
  return `$${Math.round(v)}`;
}

function Kpi({ title, value, note, tone }) {
  const toneClass = tone === 'bad' ? 'text-red-300' : tone === 'good' ? 'text-emerald-300' : 'text-white';
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{title}</p>
      <p className={`mt-2 text-2xl font-bold tabular-nums ${toneClass}`}>{value}</p>
      {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
    </div>
  );
}

function Section({ title, sub, children }) {
  return (
    <section className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
      <h3 className="text-base font-semibold text-white">{title}</h3>
      {sub && <p className="mb-3 mt-0.5 text-xs text-slate-500">{sub}</p>}
      {children}
    </section>
  );
}

function AmountList({ rows, empty }) {
  if (!rows?.length) return <p className="text-sm text-slate-500">{empty}</p>;
  return (
    <ul className="space-y-1.5 text-sm">
      {rows.map((r, i) => (
        <li key={`${r.name}-${i}`} className="flex justify-between gap-3">
          <span className="text-slate-300">{r.name}</span>
          <span className="tabular-nums text-white">{money(r.amount)}</span>
        </li>
      ))}
    </ul>
  );
}

const tooltipStyle = { background: '#0f172a', border: '1px solid #334155', borderRadius: 8 };

export default function BankDashboard() {
  const [snap, setSnap] = useState(undefined);
  const [error, setError] = useState('');
  const [month, setMonth] = useState('');

  useEffect(() => {
    payablesService.getBankSnapshot('5761')
      .then((s) => { setSnap(s || null); setMonth(s?.data?.months?.[0]?.month || ''); })
      .catch((err) => setError(err.message));
  }, []);

  const d = snap?.data;
  const m = useMemo(() => d?.months?.find((x) => x.month === month) || d?.months?.[0], [d, month]);
  const weekly = useMemo(() => (d?.weekly || []).map((w) => ({ ...w, label: shortDay(w.week_start) })), [d]);
  const cats = (d?.categories_30d || []).slice(0, 8);

  if (error) return <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">Could not load the bank snapshot: {error}</div>;
  if (snap === undefined) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-teal-400" /></div>;
  if (!snap) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-6 text-sm text-slate-300">
        No bank snapshot yet. The daily bank update adds one each day around 12:47 PM Central.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-3xl text-sm text-slate-400">
          The operating account (****5761) that pays BILL, Gusto and the loans. Updated once a day from the bank,
          last on {format(new Date(snap.taken_at), 'MMM d')} at {format(new Date(snap.taken_at), 'h:mm a')} ({formatDistanceToNow(new Date(snap.taken_at), { addSuffix: true })}).
        </p>
        <label className="text-sm text-slate-300" htmlFor="bank-month">Month
          <select id="bank-month" value={m?.month || ''} onChange={(e) => setMonth(e.target.value)}
            className="mt-1 block rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white focus:border-teal-500 focus:outline-none">
            {(d.months || []).map((x) => <option key={x.month} value={x.month}>{monthName(x.month)}{x.partial ? ' (so far)' : ''}</option>)}
          </select>
        </label>
      </div>

      {m && (
        <p className="text-base text-slate-200">
          In {monthName(m.month)}{m.partial ? ' so far' : ''}, ****5761 took in <b className="tabular-nums text-white">{money(m.income)}</b> and
          paid out <b className="tabular-nums text-white">{money(m.expenses)}</b>, for a net of{' '}
          <b className={`tabular-nums ${m.net < 0 ? 'text-red-300' : 'text-emerald-300'}`}>{signed(m.net)}</b>.
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi title="Balance now" value={money(d.balance)} note="Includes pending items" />
        <Kpi title={`Money in, ${m ? format(parseISO(`${m.month}-01`), 'MMMM') : ''}`} value={m ? money(m.income) : '·'} note="Deposits and transfers in" />
        <Kpi title={`Money out, ${m ? format(parseISO(`${m.month}-01`), 'MMMM') : ''}`} value={m ? money(m.expenses) : '·'} note="All posted payments" />
        <Kpi title="Net for the month" value={m ? signed(m.net) : '·'} tone={m ? (m.net < 0 ? 'bad' : 'good') : undefined} note={m?.partial ? 'Month still in progress' : 'Whole month'} />
      </div>

      <Section title="Money in and out each week" sub="Posted deposits (including transfers in) and posted payments, weeks Monday to Sunday. The current week is still filling in.">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weekly} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#334155" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 12 }} tickLine={false} axisLine={{ stroke: '#475569' }} minTickGap={12} />
              <YAxis tickFormatter={compactMoney} tick={{ fill: '#94a3b8', fontSize: 12 }} tickLine={false} axisLine={false} width={52} />
              <Tooltip formatter={(v, name) => [money(v), name]} labelFormatter={(l) => `Week of ${l}`} contentStyle={tooltipStyle} labelStyle={{ color: '#e2e8f0' }} cursor={{ fill: 'rgba(148,163,184,0.1)' }} />
              <Legend wrapperStyle={{ fontSize: 12, color: '#cbd5e1' }} />
              <Bar dataKey="deposits" name="Deposits in" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={24} isAnimationActive={false} />
              <Bar dataKey="total" name="Money out" fill="#f43f5e" radius={[3, 3, 0, 0]} maxBarSize={24} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Where the money went, last 30 days" sub='"Transfers out" is mostly BILL vendor payments and Gusto payroll.'>
          <div style={{ height: Math.max(160, cats.length * 34) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cats} layout="vertical" margin={{ top: 0, right: 56, bottom: 0, left: 0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="category" width={170} tick={{ fill: '#cbd5e1', fontSize: 12 }} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v) => [money(v), 'Paid']} contentStyle={tooltipStyle} labelStyle={{ color: '#e2e8f0' }} cursor={{ fill: 'rgba(148,163,184,0.1)' }} />
                <Bar dataKey="total" fill="#38bdf8" radius={[0, 3, 3, 0]} isAnimationActive={false}
                  label={{ position: 'right', fill: '#94a3b8', fontSize: 12, formatter: (v) => compactMoney(v) }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>

        <Section title={`Biggest items in ${m ? monthName(m.month) : ''}`}>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-400">Money in</p>
              <AmountList rows={m?.top_in} empty="None this month yet." />
            </div>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-400">Money out by type</p>
              <AmountList rows={m?.top_out} empty="None this month yet." />
            </div>
          </div>
        </Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Top payees, last 30 days" sub="BILL vendor payments are added together on one line. Gusto covers payroll, payroll taxes and fees.">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-slate-400">
                <tr><th className="py-1.5 pr-3">Payee</th><th className="py-1.5 pr-3 text-right">Paid</th><th className="py-1.5 text-right">Payments</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {(d.payees_30d || []).map((r) => (
                  <tr key={r.payee} className="text-slate-200">
                    <td className="py-1.5 pr-3">{r.payee}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{money(r.total)}</td>
                    <td className="py-1.5 text-right tabular-nums text-slate-400">{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Recurring charges" sub="Charges that repeat on a schedule, last 6 months.">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-slate-400">
                <tr><th className="py-1.5 pr-3">Merchant</th><th className="py-1.5 pr-3">How often</th><th className="py-1.5 pr-3 text-right">Typical</th><th className="py-1.5">Last</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {(d.recurring || []).map((r) => (
                  <tr key={r.merchant} className="text-slate-200">
                    <td className="py-1.5 pr-3">{r.merchant}</td>
                    <td className="py-1.5 pr-3 capitalize text-slate-400">{r.frequency}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{money(r.amount)}</td>
                    <td className="whitespace-nowrap py-1.5 text-slate-400">{shortDay(r.last_charge)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>

      <p className="text-xs text-slate-500">
        Money in counts every deposit and transfer into ****5761, which matches Cash Collected on the Cash Flow tab. Monthly and weekly totals leave out
        pending items; the balance includes them.
      </p>
    </div>
  );
}
