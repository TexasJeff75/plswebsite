import React, { useEffect, useMemo, useState } from 'react';
import { addDays, format, parseISO, startOfWeek } from 'date-fns';
import { AlertTriangle, CalendarCheck, CalendarClock, ChevronLeft, ChevronRight, ExternalLink, Flag, Link2, Loader2, PauseCircle, Search, Send, Trash2, Unlink, XCircle } from 'lucide-react';
import { payablesService } from '../../services/payablesService';
import { billUrl, money } from './format';
import { daysLate, fridayOnOrAfter, iso } from './installments';
import PlanEditor from './PlanEditor';
import ReleaseDialog from './ReleaseDialog';

const STATUS_STYLES = {
  planned: 'bg-sky-500/15 text-sky-300',
  scheduled: 'bg-teal-500/15 text-teal-300',
  paid: 'bg-emerald-500/15 text-emerald-300',
  missed: 'bg-red-500/15 text-red-300',
};
const STATUS_LABELS = { planned: 'Planned', scheduled: 'Scheduled', paid: 'Paid', missed: 'Missed' };

const FILTERS = [
  { id: 'open', label: 'All open' },
  { id: 'none', label: 'Not planned' },
  { id: 'planned', label: 'Planned' },
  { id: 'hold', label: 'On hold' },
  { id: 'review', label: 'Needs review' },
];

function BillLink({ bill, children }) {
  return (
    <a href={billUrl(bill.id)} target="_blank" rel="noopener noreferrer" title="Open this bill in BILL"
      className="inline-flex items-center gap-1 hover:text-teal-300 hover:underline">
      {children}<ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
    </a>
  );
}

const day = (d) => (d ? format(parseISO(d), 'MMM d, yyyy') : '');
const shortDay = (d) => (d ? format(parseISO(d), 'EEE MMM d') : '');

function StatusChip({ status, paymentStatus }) {
  if (status === 'scheduled' && paymentStatus === 'WAITING_ON_APPROVAL') {
    return <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-xs font-medium text-violet-300">Waiting on approval in BILL</span>;
  }
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status] || 'bg-slate-700 text-slate-300'}`}>{STATUS_LABELS[status] || status}</span>;
}

function planSummary(bill) {
  const plan = bill.plan;
  if (!plan && Number(bill.due_amount) <= 0 && Number(bill.scheduled_amount) > 0) return <span className="text-teal-300">Scheduled in BILL</span>;
  if (!plan) return <span className="text-amber-300">Not planned</span>;
  if (plan.plan_type === 'hold') return <span className="text-slate-300">On hold</span>;
  const list = plan.installments;
  if (!list.length) return <span className="text-slate-400">No dates</span>;
  if (plan.plan_type === 'full' && list.length === 1) return <span>In full on {day(list[0].planned_date)}</span>;
  const first = list[0];
  const same = list.every((i) => Number(i.amount) === Number(first.amount));
  return (
    <span>
      {list.length} {plan.plan_type === 'weekly' ? 'weekly' : ''} payments{same ? ` of ${money(first.amount, { cents: true })}` : ''} from {day(first.planned_date)}
    </span>
  );
}

function nextOpenInstallment(bill) {
  return bill.plan?.installments?.find((i) => i.status === 'planned' || i.status === 'missed' || i.status === 'scheduled');
}

export default function PayPlan() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('open');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [linking, setLinking] = useState(null); // { bill, payment }
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [releasing, setReleasing] = useState(null); // week being released
  const [cancelling, setCancelling] = useState(null); // installment id awaiting confirmation
  const [removing, setRemoving] = useState(null); // installment id awaiting "remove from plan" confirmation
  const [selected, setSelected] = useState(() => new Set());
  const [bulkStep, setBulkStep] = useState(null); // 'hold' | 'review' while confirming
  const [reviewNote, setReviewNote] = useState('');
  const [planDate, setPlanDate] = useState('');
  const [bulkResult, setBulkResult] = useState(null);
  const [picked, setPicked] = useState(() => new Set()); // pay-list installments picked for release
  const [paidWeeksBack, setPaidWeeksBack] = useState(1); // 1 = last week
  const [paid, setPaid] = useState(null); // { start, end, payments } or { error }

  async function load() {
    try {
      setError('');
      await payablesService.refreshPayPlans();
      setData(await payablesService.getPayPlanView());
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { load(); }, []);

  // What went out: BILL payments processed in an earlier pay-list week (Monday to Sunday).
  useEffect(() => {
    if (!data?.today) return;
    const monday = startOfWeek(parseISO(data.today), { weekStartsOn: 1 });
    const start = iso(addDays(monday, -7 * paidWeeksBack));
    const end = iso(addDays(monday, -7 * paidWeeksBack + 6));
    let live = true;
    setPaid(null);
    payablesService.getPaymentsBetween(start, end)
      .then((payments) => { if (live) setPaid({ start, end, payments }); })
      .catch((err) => { if (live) setPaid({ start, end, error: err.message }); });
    return () => { live = false; };
  }, [data?.today, paidWeeksBack]);

  async function link(installmentId, paymentId) {
    setBusy(true);
    setActionError('');
    try {
      await payablesService.linkInstallment(installmentId, paymentId);
      setLinking(null);
      await load();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function runBulk(action) {
    setBusy(true);
    setActionError('');
    setBulkResult(null);
    try {
      const ids = [...selected];
      const result = action === 'plan'
        ? await payablesService.bulkPlanBills(ids, planDate)
        : await payablesService.bulkUpdateBills(ids, action, action === 'review' ? reviewNote : null);
      const names = Object.fromEntries(bills.map((b) => [b.id, `${b.vendor_name} · ${b.invoice_number || 'No invoice #'}`]));
      setBulkResult({ action, date: planDate, total: result.total, updated: result.updated, skipped: (result.skipped || []).map((x) => ({ ...x, name: names[x.bill_id] || x.bill_id })) });
      setSelected(new Set());
      setBulkStep(null);
      setReviewNote('');
      await load();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function toggleOne(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function removeFromPlan(installmentId) {
    setBusy(true);
    setActionError('');
    try {
      await payablesService.removeInstallment(installmentId);
      setRemoving(null);
      await load();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function cancelRelease(installmentId) {
    setBusy(true);
    setActionError('');
    try {
      await payablesService.cancelReleasedPayment(installmentId);
      setCancelling(null);
      await load();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const bills = data?.bills || [];
  const today = data?.today;

  const attention = useMemo(() => {
    const items = [];
    for (const b of bills) {
      for (const reason of b.plan?.review_reasons || []) items.push({ kind: 'review', bill: b, text: reason });
      for (const i of b.plan?.installments || []) {
        if (i.status === 'missed') items.push({ kind: 'missed', bill: b, installment: i });
      }
      if (b.plan) {
        for (const p of b.payments) if (!p.linked && !p.before_plan) items.push({ kind: 'unlinked', bill: b, payment: p });
      }
    }
    return items;
  }, [bills]);

  useEffect(() => { setSelected(new Set()); setBulkStep(null); }, [filter, search]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bills.filter((b) => {
      if (Number(b.still_owed) <= 0 && filter !== 'planned' && !(filter === 'review' && b.review_flag)) return false;
      if (q && !`${b.vendor_name} ${b.invoice_number}`.toLowerCase().includes(q)) return false;
      if (filter === 'none') return !b.plan && Number(b.due_amount) > 0;
      if (filter === 'planned') return b.plan && b.plan.plan_type !== 'hold';
      if (filter === 'hold') return b.plan?.plan_type === 'hold';
      if (filter === 'review') return (b.plan?.review_reasons?.length || 0) > 0 || !!b.review_flag;
      return true;
    });
  }, [bills, filter, search]);

  // Weekly pay list: open and scheduled installments from this week through the next 12.
  const payWeeks = useMemo(() => {
    if (!today) return [];
    const start = startOfWeek(parseISO(today), { weekStartsOn: 1 });
    const weeks = Array.from({ length: 13 }, (_, n) => ({
      start: iso(addDays(start, 7 * n)), end: iso(addDays(start, 7 * n + 6)), rows: [],
    }));
    for (const b of bills) {
      const list = b.plan?.installments || [];
      for (const i of list) {
        if (i.status === 'paid') continue;
        const date = i.status === 'missed' ? today : (i.bill_process_date || i.planned_date);
        const w = weeks.find((x) => date >= x.start && date <= x.end);
        if (w) w.rows.push({ ...i, date, bill: b, total: list.length });
      }
    }
    for (const w of weeks) w.rows.sort((a, b) => a.date.localeCompare(b.date));
    return weeks.filter((w) => w.rows.length);
  }, [bills, today]);

  // Planned (or missed) payments not yet in BILL can be picked and released on their own.
  const releasable = (r) => (r.status === 'planned' || r.status === 'missed') && !r.matched_payment_id;
  const allPayRows = payWeeks.flatMap((w) => w.rows);
  const pickedRows = allPayRows.filter((r) => picked.has(r.id) && releasable(r));

  function togglePicked(id) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function releasePicked() {
    const rows = [...pickedRows].sort((a, b) => a.date.localeCompare(b.date));
    const weeksTouched = new Set(rows.map((r) => payWeeks.find((w) => w.rows.includes(r))?.start));
    const start = [...weeksTouched].sort()[0];
    setReleasing({
      start,
      rows,
      mixed: weeksTouched.size > 1,
      title: `${rows.length} selected ${rows.length === 1 ? 'payment' : 'payments'}`,
    });
  }

  if (error) return <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">Could not load pay plans: {error}</div>;
  if (!data) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-teal-400" /></div>;

  const notPlanned = bills.filter((b) => !b.plan && Number(b.due_amount) > 0);
  const allShownSelected = filtered.length > 0 && filtered.every((b) => selected.has(b.id));
  const selectedBills = bills.filter((b) => selected.has(b.id));
  const withDates = selectedBills.filter((b) => b.plan && b.plan.plan_type !== 'hold' && b.plan.installments.some((i) => i.status === 'planned' || i.status === 'missed')).length;
  const bulkButton = 'inline-flex items-center gap-1 rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 disabled:opacity-50';
  const selectedTotal = selectedBills.reduce((sum, b) => sum + (Number(b.still_owed) || 0), 0);
  const selectedOwed = selectedBills.reduce((sum, b) => sum + Math.max(Number(b.due_amount) || 0, 0), 0);
  const replacing = selectedBills.filter((b) => b.plan && b.plan.installments.some((i) => i.status === 'planned' || i.status === 'missed')).length;
  const BULK_DONE = { plan: 'planned', hold: 'put on hold', unhold: 'taken off hold', review: 'marked for review', clear_review: 'cleared from review' };

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-400">
        Plan when each bill will be paid, then release each week to BILL when you are ready to pay it. Payments you schedule in BILL
        yourself are matched to the plan after the next sync when the bill and amount match and the date is within 3 days.
      </p>

      {actionError && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{actionError}</div>}

      {attention.length > 0 && (
        <section className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
          <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-amber-200"><AlertTriangle className="h-4 w-4" />Needs attention</h3>
          <ul className="space-y-2 text-sm">
            {attention.map((a, idx) => (
              <li key={idx} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-700 bg-slate-900/40 px-3 py-2">
                <span className="text-slate-200">
                  <span className="font-medium">{a.bill.vendor_name}</span> <span className="text-slate-400">· <BillLink bill={a.bill}>{a.bill.invoice_number || 'No invoice #'}</BillLink></span>
                  <span className="block text-slate-300">
                    {a.kind === 'review' && a.text}
                    {a.kind === 'missed' && `Payment ${a.installment.seq} of ${money(a.installment.amount, { cents: true })} was planned for ${day(a.installment.planned_date)} and is not in BILL.`}
                    {a.kind === 'unlinked' && `BILL payment of ${money(a.payment.amount, { cents: true })} on ${day(a.payment.process_date)} is not in the plan.`}
                  </span>
                </span>
                <span className="flex gap-2">
                  {a.kind === 'unlinked' && (
                    <button type="button" onClick={() => setLinking({ bill: a.bill, payment: a.payment })}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800">
                      <Link2 className="h-3.5 w-3.5" />Link to a payment in the plan
                    </button>
                  )}
                  <button type="button" onClick={() => setEditing(a.bill)}
                    className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800">Edit plan</button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-white">Open bills</h3>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex flex-wrap rounded-lg border border-slate-600 bg-slate-900 p-0.5">
              {FILTERS.map((f) => (
                <button key={f.id} type="button" onClick={() => setFilter(f.id)}
                  className={`rounded-md px-3 py-1 text-xs font-medium ${filter === f.id ? 'bg-teal-500 text-slate-950' : 'text-slate-300 hover:text-white'}`}>
                  {f.label}{f.id === 'none' && notPlanned.length ? ` (${notPlanned.length})` : ''}
                </button>
              ))}
            </div>
            <label htmlFor="plan-search" className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
              <input id="plan-search" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Vendor or invoice"
                className="w-52 rounded-lg border border-slate-600 bg-slate-900 py-2 pl-8 pr-3 text-sm text-white focus:border-teal-500 focus:outline-none" />
            </label>
          </div>
        </div>
        {bulkResult && (
          <div className="mb-3 rounded-lg border border-slate-600 bg-slate-900/60 p-3 text-sm text-slate-200">
            <div className="flex items-start justify-between gap-2">
              <span>{bulkResult.updated} {bulkResult.updated === 1 ? 'bill' : 'bills'} {BULK_DONE[bulkResult.action]}{bulkResult.action === 'plan' && bulkResult.updated ? ` for ${day(bulkResult.date)}, ${money(bulkResult.total, { cents: true })} total` : ''}.{bulkResult.skipped.length ? ` ${bulkResult.skipped.length} skipped:` : ''}</span>
              <button type="button" onClick={() => setBulkResult(null)} className="text-xs text-slate-400 hover:text-white">Dismiss</button>
            </div>
            {bulkResult.skipped.length > 0 && (
              <ul className="mt-1 list-disc pl-5 text-xs text-amber-200">
                {bulkResult.skipped.map((x) => <li key={x.bill_id}>{x.name}: {x.reason}</li>)}
              </ul>
            )}
          </div>
        )}
        {selected.size > 0 && (
          <div className="mb-3 rounded-lg border border-teal-500/40 bg-teal-500/5 p-3">
            {!bulkStep && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 text-sm font-medium text-teal-200">
                  {selected.size} selected · <span className="tabular-nums">{money(selectedTotal, { cents: true })}</span> still owed
                </span>
                <button type="button" disabled={busy} onClick={() => { setPlanDate(today ? iso(fridayOnOrAfter(parseISO(today))) : ''); setBulkStep('plan'); }} className={bulkButton}><CalendarCheck className="h-3.5 w-3.5" />Plan for one day</button>
                <button type="button" disabled={busy} onClick={() => setBulkStep('hold')} className={bulkButton}><PauseCircle className="h-3.5 w-3.5" />Put on hold</button>
                <button type="button" disabled={busy} onClick={() => runBulk('unhold')} className={bulkButton}>Remove hold</button>
                <button type="button" disabled={busy} onClick={() => setBulkStep('review')} className={bulkButton}><Flag className="h-3.5 w-3.5" />Mark needs review</button>
                <button type="button" disabled={busy} onClick={() => runBulk('clear_review')} className={bulkButton}>Clear review</button>
                <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-xs text-slate-400 hover:text-white">Clear selection</button>
              </div>
            )}
            {bulkStep === 'plan' && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <label htmlFor="plan-one-day" className="text-slate-200">Pay {selected.size} {selected.size === 1 ? 'bill' : 'bills'} in full on</label>
                <input id="plan-one-day" type="date" value={planDate} min={today || undefined} onChange={(e) => setPlanDate(e.target.value)}
                  className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-white focus:border-teal-500 focus:outline-none [color-scheme:dark]" />
                <span className="text-slate-300">
                  About {money(selectedOwed, { cents: true })}.
                  {replacing > 0 && ` Planned dates on ${replacing} ${replacing === 1 ? 'bill' : 'bills'} will be replaced.`}
                  {' '}Release that week to BILL when you are ready.
                </span>
                <button type="button" disabled={busy || !planDate || (today && planDate < today)} onClick={() => runBulk('plan')}
                  className="rounded-lg bg-teal-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-teal-400 disabled:opacity-50">{busy ? 'Saving…' : 'Plan payments'}</button>
                <button type="button" onClick={() => setBulkStep(null)} className="px-2 text-xs text-slate-400 hover:text-white">Back</button>
              </div>
            )}
            {bulkStep === 'hold' && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-slate-200">
                  Put {selected.size} {selected.size === 1 ? 'bill' : 'bills'} on hold?
                  {withDates > 0 && ` ${withDates} ${withDates === 1 ? 'has' : 'have'} planned dates that will be removed.`}
                  {' '}Payments already scheduled in BILL are not changed, so those bills are skipped.
                </span>
                <button type="button" disabled={busy} onClick={() => runBulk('hold')}
                  className="rounded-lg bg-teal-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-teal-400 disabled:opacity-50">{busy ? 'Saving…' : 'Put on hold'}</button>
                <button type="button" onClick={() => setBulkStep(null)} className="px-2 text-xs text-slate-400 hover:text-white">Back</button>
              </div>
            )}
            {bulkStep === 'review' && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <label htmlFor="review-note" className="text-slate-200">Mark {selected.size} for review. Note (optional):</label>
                <input id="review-note" value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} maxLength={300} placeholder="e.g. check amount with vendor"
                  className="min-w-0 flex-1 rounded-lg border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-white focus:border-teal-500 focus:outline-none" />
                <button type="button" disabled={busy} onClick={() => runBulk('review')}
                  className="rounded-lg bg-teal-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-teal-400 disabled:opacity-50">{busy ? 'Saving…' : 'Mark needs review'}</button>
                <button type="button" onClick={() => setBulkStep(null)} className="px-2 text-xs text-slate-400 hover:text-white">Back</button>
              </div>
            )}
          </div>
        )}
        <div className="overflow-x-auto rounded-lg border border-slate-700">
          <table className="w-full text-sm">
            <thead className="bg-slate-800 text-left text-xs uppercase tracking-wider text-slate-400">
              <tr>
                <th className="w-8 px-3 py-2">
                  <input type="checkbox" aria-label="Select all shown bills" checked={allShownSelected} disabled={!filtered.length}
                    onChange={() => setSelected(allShownSelected ? new Set() : new Set(filtered.map((b) => b.id)))}
                    className="h-4 w-4 rounded border-slate-500 bg-slate-900 accent-teal-500" />
                </th>
                <th className="px-3 py-2">Vendor</th><th className="px-3 py-2">Invoice</th><th className="px-3 py-2">Due</th><th className="px-3 py-2 text-right">Still owed</th><th className="px-3 py-2">Plan</th><th className="px-3 py-2">Next payment</th><th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtered.map((b) => {
                const next = nextOpenInstallment(b);
                const pastDue = b.due_date && today && b.due_date < today;
                return (
                  <tr key={b.id} className={`text-slate-200 ${selected.has(b.id) ? 'bg-teal-500/5' : ''}`}>
                    <td className="px-3 py-2">
                      <input type="checkbox" aria-label={`Select ${b.vendor_name} ${b.invoice_number || ''}`} checked={selected.has(b.id)} onChange={() => toggleOne(b.id)}
                        className="h-4 w-4 rounded border-slate-500 bg-slate-900 accent-teal-500" />
                    </td>
                    <td className="px-3 py-2">{b.vendor_name}</td>
                    <td className="px-3 py-2 text-slate-400"><BillLink bill={b}>{b.invoice_number || 'Open'}</BillLink></td>
                    <td className={`whitespace-nowrap px-3 py-2 ${pastDue ? 'text-red-300' : ''}`}>{day(b.due_date)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(b.still_owed, { cents: true })}</td>
                    <td className="px-3 py-2">
                      {planSummary(b)}
                      {((b.plan?.review_reasons?.length || 0) > 0 || b.review_flag) && (
                        <span className="ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-300"
                          title={[...(b.plan?.review_reasons || []), b.review_flag ? `Marked for review${b.review_flag.note ? `: ${b.review_flag.note}` : ''}` : null].filter(Boolean).join('\n')}>Review</span>
                      )}
                      {b.review_flag?.note && <span className="block text-xs text-amber-200/80">{b.review_flag.note}</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {next ? (
                        <span className="flex items-center gap-2">
                          <span className="tabular-nums">{money(next.amount, { cents: true })} · {shortDay(next.bill_process_date || next.planned_date)}</span>
                          <StatusChip status={next.status} />
                        </span>
                      ) : <span className="text-slate-500">·</span>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button type="button" onClick={() => setEditing(b)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700">
                        <CalendarClock className="h-3.5 w-3.5" />{b.plan ? 'Edit' : 'Plan'}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!filtered.length && <tr><td colSpan={8} className="px-3 py-6 text-center text-slate-500">No bills match.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <PaidWeek paid={paid} weeksBack={paidWeeksBack} setWeeksBack={setPaidWeeksBack} bills={bills} />

      <section className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
        <h3 className="mb-1 text-base font-semibold text-white">Weekly pay list</h3>
        <p className="mb-3 text-xs text-slate-500">Planned payments by week. Release a whole week, or tick the payments you want and release only those, to create them in BILL; the rest stay planned. Released and scheduled ones show BILL's date and can be canceled until BILL starts processing.</p>
        {pickedRows.length > 0 && (
          <div className="sticky top-0 z-10 mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-teal-500/40 bg-slate-900 p-3">
            <span className="text-sm font-medium text-teal-200">
              {pickedRows.length} selected · <span className="tabular-nums">{money(pickedRows.reduce((t, r) => t + Number(r.amount), 0), { cents: true })}</span>
            </span>
            <button type="button" onClick={releasePicked}
              className="inline-flex items-center gap-1 rounded-lg bg-teal-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-teal-400">
              <Send className="h-3.5 w-3.5" />Release selected to BILL
            </button>
            <button type="button" onClick={() => setPicked(new Set())} className="ml-auto text-xs text-slate-400 hover:text-white">Clear selection</button>
          </div>
        )}
        {payWeeks.length ? (
          <div className="space-y-4">
            {payWeeks.map((w) => {
              const toSchedule = w.rows.filter((r) => r.status !== 'scheduled').reduce((s, r) => s + Number(r.amount), 0);
              const total = w.rows.reduce((s, r) => s + Number(r.amount), 0);
              return (
                <div key={w.start}>
                  <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-700 pb-1">
                    <span className="text-sm font-semibold text-slate-200">Week of {format(parseISO(w.start), 'MMM d')}</span>
                    <span className="flex flex-wrap items-center gap-3">
                      <span className="text-xs text-slate-400 tabular-nums">
                        {money(total, { cents: true })} total{toSchedule ? ` · ${money(toSchedule, { cents: true })} still to schedule in BILL` : ''}
                      </span>
                      {toSchedule > 0 && (
                        <button type="button" onClick={() => setReleasing(w)}
                          className="inline-flex items-center gap-1 rounded-lg bg-teal-500 px-3 py-1 text-xs font-semibold text-slate-950 hover:bg-teal-400">
                          <Send className="h-3.5 w-3.5" />Release to BILL
                        </button>
                      )}
                    </span>
                  </div>
                  <ul className="divide-y divide-slate-800 text-sm">
                    {w.rows.map((r) => {
                      const late = daysLate(r.planned_date, r.bill.due_date);
                      return (
                        <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                          <span className="text-slate-200">
                            {releasable(r) ? (
                              <input type="checkbox" checked={picked.has(r.id)} onChange={() => togglePicked(r.id)}
                                aria-label={`Select ${r.bill.vendor_name} ${money(r.amount, { cents: true })} to release`}
                                className="mr-2 h-4 w-4 align-middle accent-teal-500" />
                            ) : <span className="mr-2 inline-block w-4" />}
                            <span className="tabular-nums text-slate-400">{shortDay(r.date)}</span> · {r.bill.vendor_name}
                            <span className="text-slate-400"> · <BillLink bill={r.bill}>{r.bill.invoice_number || 'No invoice #'}</BillLink> · {r.seq} of {r.total}</span>
                            {late > 0 && <span className="ml-2 text-xs text-amber-300">{late} {late === 1 ? 'day' : 'days'} late</span>}
                            {r.release_problem && !r.matched_payment_id && (
                              <span className="block text-xs text-amber-300">Last release did not go through: {r.release_problem}</span>
                            )}
                          </span>
                          <span className="flex items-center gap-2">
                            <span className="tabular-nums text-white">{money(r.amount, { cents: true })}</span>
                            <StatusChip status={r.status} paymentStatus={r.payment_status} />
                            {r.status === 'scheduled' && r.matched_payment_id && cancelling !== r.id && (
                              <button type="button" disabled={busy} onClick={() => { setRemoving(null); setCancelling(r.id); }} title="Cancel this payment in BILL"
                                className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-red-300" aria-label="Cancel payment in BILL">
                                <XCircle className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {(r.status === 'planned' || r.status === 'missed') && !r.matched_payment_id && removing !== r.id && (
                              <button type="button" disabled={busy} onClick={() => { setCancelling(null); setRemoving(r.id); }} title="Remove this payment from the plan"
                                className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-red-300" aria-label={`Remove ${r.bill.vendor_name} payment from the plan`}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {removing === r.id && (
                              <span className="flex items-center gap-1 text-xs">
                                <span className="text-slate-300">Remove from plan?</span>
                                <button type="button" disabled={busy} onClick={() => removeFromPlan(r.id)}
                                  className="rounded bg-red-500/20 px-2 py-0.5 text-red-200 hover:bg-red-500/30">{busy ? 'Removing…' : 'Yes, remove'}</button>
                                <button type="button" onClick={() => setRemoving(null)} className="px-1 text-slate-400 hover:text-white">Keep</button>
                              </span>
                            )}
                            {cancelling === r.id && (
                              <span className="flex items-center gap-1 text-xs">
                                <span className="text-slate-300">Cancel in BILL?</span>
                                <button type="button" disabled={busy} onClick={() => cancelRelease(r.id)}
                                  className="rounded bg-red-500/20 px-2 py-0.5 text-red-200 hover:bg-red-500/30">{busy ? 'Canceling…' : 'Yes, cancel'}</button>
                                <button type="button" onClick={() => setCancelling(null)} className="px-1 text-slate-400 hover:text-white">Keep</button>
                              </span>
                            )}
                            {r.matched_by === 'manual' && (
                              <button type="button" disabled={busy} onClick={() => link(r.id, null)} title="Unlink this BILL payment"
                                className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-white" aria-label="Unlink payment">
                                <Unlink className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        ) : <p className="text-sm text-slate-500">No planned payments yet. Use Plan on a bill above to add one.</p>}
      </section>

      {releasing && (
        <ReleaseDialog week={releasing} onClose={() => setReleasing(null)} onDone={async () => { setReleasing(null); setPicked(new Set()); await load(); }} />
      )}

      {editing && (
        <PlanEditor bill={editing} today={today} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await load(); }} />
      )}

      {linking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4" onClick={() => setLinking(null)}>
          <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Link payment">
            <h3 className="text-base font-semibold text-white">Link a BILL payment</h3>
            <p className="mt-1 text-sm text-slate-400">
              {money(linking.payment.amount, { cents: true })} on {day(linking.payment.process_date)} for {linking.bill.vendor_name}. Choose the planned payment it covers.
            </p>
            <ul className="mt-4 space-y-2">
              {(linking.bill.plan?.installments || []).filter((i) => !i.matched_payment_id).map((i) => (
                <li key={i.id}>
                  <button type="button" disabled={busy} onClick={() => link(i.id, linking.payment.id)}
                    className="flex w-full items-center justify-between rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200 hover:border-teal-500 hover:bg-slate-800">
                    <span>Payment {i.seq} · {day(i.planned_date)}</span>
                    <span className="tabular-nums">{money(i.amount, { cents: true })}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-500">If one payment covers several planned payments, edit the plan so a single payment matches it, or link it here and adjust the rest.</p>
            <div className="mt-4 text-right">
              <button type="button" onClick={() => setLinking(null)} className="rounded-lg px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// BILL payments that went out in an earlier week, with the bills they paid and
// whether each one was part of a pay plan.
function PaidWeek({ paid, weeksBack, setWeeksBack, bills }) {
  const planned = useMemo(() => {
    const ids = new Set();
    for (const b of bills) for (const i of b.plan?.installments || []) if (i.matched_payment_id) ids.add(i.matched_payment_id);
    return ids;
  }, [bills]);
  const PENDING = ['SCHEDULED', 'WAITING_ON_APPROVAL', 'READY_TO_FUND'];
  const payments = paid?.payments || [];
  const total = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const title = weeksBack === 1 ? 'Paid last week' : `Paid the week of ${paid ? format(parseISO(paid.start), 'MMM d') : ''}`;

  return (
    <section className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-700 pb-2">
        <div>
          <h3 className="text-base font-semibold text-white">{title}</h3>
          {paid && <p className="text-xs text-slate-500">BILL payments processed {format(parseISO(paid.start), 'EEE MMM d')} to {format(parseISO(paid.end), 'EEE MMM d')}</p>}
        </div>
        <div className="flex items-center gap-3">
          {paid && !paid.error && (
            <span className="text-sm text-slate-300 tabular-nums">
              {payments.length} {payments.length === 1 ? 'payment' : 'payments'} · <span className="font-semibold text-white">{money(total, { cents: true })}</span>
            </span>
          )}
          <span className="inline-flex rounded-lg border border-slate-600">
            <button type="button" onClick={() => setWeeksBack(weeksBack + 1)} title="Earlier week" aria-label="Earlier week"
              className="rounded-l-lg p-1.5 text-slate-300 hover:bg-slate-700 hover:text-white"><ChevronLeft className="h-4 w-4" /></button>
            <button type="button" disabled={weeksBack <= 1} onClick={() => setWeeksBack(weeksBack - 1)} title="Later week" aria-label="Later week"
              className="rounded-r-lg border-l border-slate-600 p-1.5 text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
          </span>
        </div>
      </div>
      {!paid ? (
        <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-teal-400" /></div>
      ) : paid.error ? (
        <p className="text-sm text-red-300">Could not load payments: {paid.error}</p>
      ) : payments.length === 0 ? (
        <p className="text-sm text-slate-500">No BILL payments went out this week.</p>
      ) : (
        <ul className="divide-y divide-slate-800 text-sm">
          {payments.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
              <span className="text-slate-200">
                <span className="tabular-nums text-slate-400">{shortDay(p.process_date)}</span> · {p.vendor_name || 'Unknown vendor'}
                <span className="text-slate-400">
                  {p.bills.map((b) => (
                    <span key={b.bill_id}> · <BillLink bill={{ id: b.bill_id }}>{b.invoice_number || 'No invoice #'}</BillLink>
                      {p.bills.length > 1 ? ` (${money(b.amount, { cents: true })})` : ''}</span>
                  ))}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <span className="tabular-nums text-white">{money(p.amount, { cents: true })}</span>
                {PENDING.includes(p.single_status || '')
                  ? <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-xs font-medium text-violet-300">Not processed yet</span>
                  : <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300">Paid</span>}
                {!planned.has(p.id) && <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-300" title="This payment was made in BILL, not from a pay plan">Not in a plan</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
