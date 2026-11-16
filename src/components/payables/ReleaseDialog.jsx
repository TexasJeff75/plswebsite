import React, { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { AlertTriangle, CheckCircle2, Landmark, Loader2, Send, X } from 'lucide-react';
import { payablesService } from '../../services/payablesService';
import { money } from './format';

const LARGE_BATCH = 25000;
const day = (d) => (d ? format(parseISO(d), 'EEE, MMM d') : '');
const statusText = (s) => {
  if (s === 'WAITING_ON_APPROVAL') return 'Waiting on approval in BILL';
  if (s === 'SCHEDULED') return 'Scheduled in BILL';
  return s ? s.toLowerCase().replace(/_/g, ' ') : '';
};

// Release one week of planned installments to BILL as scheduled payments.
export default function ReleaseDialog({ week, onClose, onDone }) {
  const [check, setCheck] = useState(null);
  const [forecastWeek, setForecastWeek] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState({});
  const [bankId, setBankId] = useState('');
  const [confirmLarge, setConfirmLarge] = useState(false);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState(null);

  const ids = useMemo(() => week.rows.filter((r) => !r.matched_payment_id).map((r) => r.id), [week]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([payablesService.releaseCheck(ids), payablesService.getForecast()])
      .then(([c, f]) => {
        if (cancelled) return;
        setCheck(c);
        setForecastWeek((f.weeks || []).find((w) => w.week_start === week.start) || null);
        setSelected(Object.fromEntries(c.rows.map((r) => [r.installment.id, r.ok])));
        // Prefer an account BILL says the tracker's user can pay from, then the default payables account.
        const offered = c.rows.flatMap((r) => r.banks).filter((b) => b.available);
        const accounts = c.funding?.accounts || [];
        const rank = (b) => {
          const a = accounts.find((x) => x.id === b.id);
          return (a?.usable === 'yes' ? 0 : a?.usable === 'maybe' ? 2 : 4) + (a?.defaultPayables ? 0 : 1);
        };
        const best = [...offered].sort((x, y) => rank(x) - rank(y))[0];
        if (best) setBankId(best.id);
      })
      .catch((err) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [ids, week.start]);

  // Bank accounts BILL offers, with whether each can pay every selected row.
  const banks = useMemo(() => {
    const map = new Map();
    for (const r of check?.rows || []) for (const b of r.banks) if (!map.has(b.id)) map.set(b.id, b);
    return [...map.values()];
  }, [check]);

  const rows = (check?.rows || []).map((r) => {
    const bank = r.banks.find((b) => b.id === bankId);
    const dates = [r.installment.planned_date, check.today, bank?.processDate].filter(Boolean).sort();
    const processDate = dates[dates.length - 1];
    const problem = r.problem || (bank && !bank.available ? bank.reason || 'This bank account cannot pay this vendor.' : null) || (!bank && r.ok ? 'BILL did not offer this bank account for this vendor.' : null);
    return { ...r, processDate, problem, ok: !problem, laterThanPlanned: processDate > r.installment.planned_date && r.installment.planned_date >= check.today };
  });
  const funding = check?.funding;
  const accountFor = (id) => (funding?.accounts || []).find((a) => a.id === id);
  const chosenAccount = accountFor(bankId);
  const bankBlocked = chosenAccount?.usable === 'no' || funding?.payOnline === false;
  const chosen = rows.filter((r) => r.ok && selected[r.installment.id]);
  const total = chosen.reduce((s, r) => s + Number(r.installment.amount), 0);
  const large = total > LARGE_BATCH;

  async function release() {
    setSending(true);
    setError('');
    try {
      const res = await payablesService.releasePayments({
        installmentIds: chosen.map((r) => r.installment.id), fundingAccountId: bankId, confirmLarge,
      });
      setResults(res.results);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  const byId = Object.fromEntries((check?.rows || []).map((r) => [r.installment.id, r.installment]));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/80 p-4" onClick={results ? onDone : onClose}>
      <div className="my-8 w-full max-w-3xl rounded-xl border border-slate-700 bg-slate-900 shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Release payments">
        <div className="flex items-start justify-between gap-4 border-b border-slate-700 p-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-teal-400">Release to BILL</p>
            <h2 className="text-lg font-bold text-white">Week of {format(parseISO(week.start), 'MMM d, yyyy')}</h2>
            <p className="text-sm text-slate-400">Creates these payments in BILL on their planned dates. Nothing else in the plan is sent.</p>
          </div>
          <button type="button" onClick={results ? onDone : onClose} className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-5 p-5">
          {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}
          {!check && !error && (
            <div className="flex items-center gap-3 text-sm text-slate-300"><Loader2 className="h-5 w-5 animate-spin text-teal-400" />Checking each bill with BILL…</div>
          )}

          {check && !results && (
            <>
              {forecastWeek && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                    <p className="text-xs uppercase tracking-wider text-slate-400">Already scheduled in BILL this week</p>
                    <p className="mt-1 text-lg font-semibold text-white tabular-nums">{money(forecastWeek.scheduled, { cents: true })}</p>
                  </div>
                  <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                    <p className="text-xs uppercase tracking-wider text-slate-400">This release</p>
                    <p className="mt-1 text-lg font-semibold text-white tabular-nums">{money(total, { cents: true })}</p>
                  </div>
                  <div className={`rounded-lg border p-3 ${forecastWeek.below_minimum ? 'border-red-500/40 bg-red-500/10' : 'border-slate-700 bg-slate-800/50'}`}>
                    <p className="text-xs uppercase tracking-wider text-slate-400">Cash after this week</p>
                    <p className={`mt-1 text-lg font-semibold tabular-nums ${forecastWeek.below_minimum ? 'text-red-300' : 'text-white'}`}>
                      {forecastWeek.cash_after === null ? 'Set a starting balance' : money(forecastWeek.cash_after)}
                    </p>
                    {forecastWeek.below_minimum && <p className="text-xs text-red-300">Below your minimum</p>}
                  </div>
                </div>
              )}

              <label htmlFor="release-bank" className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-400">Pay from</span>
                <select id="release-bank" value={bankId} onChange={(e) => setBankId(e.target.value)}
                  className="w-full max-w-sm rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white focus:border-teal-500 focus:outline-none">
                  {banks.map((b) => {
                    const acct = accountFor(b.id);
                    const note = !b.available ? b.reason || 'not available' : acct?.usable === 'no' ? 'not usable by the tracker' : acct?.usable === 'maybe' ? 'check access' : '';
                    return <option key={b.id} value={b.id} disabled={!b.available}>{acct?.label || b.name || b.id}{note ? ` (${note})` : ''}</option>;
                  })}
                  {!banks.length && <option value="">No bank account available</option>}
                </select>
              </label>

              {(bankBlocked || chosenAccount?.usable === 'maybe' || funding?.problems?.length > 0) && (
                <div className={`rounded-lg border p-3 text-sm ${bankBlocked ? 'border-red-500/40 bg-red-500/10 text-red-100' : 'border-amber-500/40 bg-amber-500/10 text-amber-100'}`}>
                  {chosenAccount?.reason && <p className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />{chosenAccount.reason}</p>}
                  {(funding?.problems || []).map((p) => <p key={p} className="mt-1 flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />{p}</p>)}
                </div>
              )}

              {funding?.accounts?.length > 0 && (
                <details className="rounded-lg border border-slate-700 bg-slate-800/40 p-3 text-sm" open={bankBlocked}>
                  <summary className="flex cursor-pointer items-center gap-2 text-slate-300"><Landmark className="h-4 w-4" />Bank accounts in BILL</summary>
                  <ul className="mt-2 space-y-1">
                    {funding.accounts.map((a) => (
                      <li key={a.id} className="flex flex-wrap justify-between gap-2 border-t border-slate-700/60 pt-1">
                        <span className="text-slate-200">{a.label}{a.defaultPayables ? <span className="ml-2 text-xs text-slate-400">default for payables</span> : null}</span>
                        <span className="text-xs">
                          <span className={a.status === 'VERIFIED' ? 'text-teal-300' : 'text-red-300'}>Account {String(a.status || 'unknown').toLowerCase().replace(/_/g, ' ')}</span>
                          <span className="text-slate-500"> · </span>
                          <span className={a.userStatus === 'VERIFIED' ? 'text-teal-300' : a.usable === 'maybe' ? 'text-amber-300' : 'text-red-300'}>
                            Tracker's BILL user {a.userStatus ? String(a.userStatus).toLowerCase() : 'not listed'}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-slate-500">The tracker pays as the BILL user who created the developer app. That user must be authorized on the bank account in BILL.</p>
                </details>
              )}

              <div className="overflow-x-auto rounded-lg border border-slate-700">
                <table className="w-full text-sm">
                  <thead className="bg-slate-800 text-left text-xs uppercase tracking-wider text-slate-400">
                    <tr><th className="px-3 py-2" /><th className="px-3 py-2">Vendor</th><th className="px-3 py-2">Pays on</th><th className="px-3 py-2 text-right">Amount</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {rows.map((r) => (
                      <tr key={r.installment.id} className={r.ok ? 'text-slate-200' : 'text-slate-500'}>
                        <td className="px-3 py-2 align-top">
                          <input id={`release-${r.installment.id}`} type="checkbox" disabled={!r.ok}
                            checked={!!selected[r.installment.id] && r.ok}
                            onChange={(e) => setSelected((s) => ({ ...s, [r.installment.id]: e.target.checked }))}
                            aria-label={`Release ${r.installment.vendor_name}`} />
                        </td>
                        <td className="px-3 py-2">
                          <label htmlFor={`release-${r.installment.id}`}>{r.installment.vendor_name}</label>
                          <span className="block text-xs text-slate-400">{r.installment.invoice_number || 'No invoice #'} · payment {r.installment.seq}</span>
                          {r.problem && <span className="mt-1 flex items-start gap-1 text-xs text-amber-300"><AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" />{r.problem}</span>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 align-top">
                          {day(r.processDate)}
                          {r.ok && r.processDate !== r.installment.planned_date && (
                            <span className="block text-xs text-slate-400">
                              {r.laterThanPlanned ? `Earliest BILL allows (planned ${day(r.installment.planned_date)})` : `Planned ${day(r.installment.planned_date)}`}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right align-top tabular-nums">{money(r.installment.amount, { cents: true })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {large && (
                <label htmlFor="release-confirm-large" className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
                  <input id="release-confirm-large" type="checkbox" checked={confirmLarge} onChange={(e) => setConfirmLarge(e.target.checked)} className="mt-0.5" />
                  This release is {money(total, { cents: true })}, over $25,000. I confirm this amount.
                </label>
              )}

              <p className="text-xs text-slate-500">
                Each payment is checked against the bill in BILL first and can be canceled from the tracker until BILL starts processing it.
                If your BILL account requires payment approval, the payments wait for approval in BILL before they go out.
              </p>
            </>
          )}

          {results && (
            <ul className="space-y-2 text-sm">
              {results.map((r) => {
                const inst = byId[r.installmentId] || {};
                const good = r.status === 'sent';
                return (
                  <li key={r.installmentId} className={`rounded-lg border p-3 ${good ? 'border-teal-500/30 bg-teal-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-slate-200">
                        {good ? <CheckCircle2 className="h-4 w-4 text-teal-400" /> : <AlertTriangle className="h-4 w-4 text-amber-400" />}
                        {inst.vendor_name} · {money(inst.amount, { cents: true })}
                      </span>
                      <span className={good ? 'text-teal-300' : 'text-amber-300'}>
                        {good ? `${statusText(r.billStatus)} · ${day(r.processDate)}` : r.status === 'unknown' ? 'Not confirmed' : 'Not sent'}
                      </span>
                    </div>
                    {r.message && <p className="mt-1 text-xs text-slate-300">{r.message}</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-700 p-5">
          {results ? (
            <button type="button" onClick={onDone} className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-teal-400">Done</button>
          ) : (
            <>
              <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">Cancel</button>
              <button type="button" onClick={release} disabled={sending || !check || !chosen.length || !bankId || bankBlocked || (large && !confirmLarge)}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-teal-400 disabled:opacity-50">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Release {chosen.length} {chosen.length === 1 ? 'payment' : 'payments'} to BILL
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
