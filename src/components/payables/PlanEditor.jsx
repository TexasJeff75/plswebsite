import React, { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Loader2, Lock, Plus, Trash2, X } from 'lucide-react';
import { payablesService } from '../../services/payablesService';
import { money } from './format';
import { daysLate, fridayOnOrAfter, fridayOnOrBefore, iso, sumAmounts, weeklyInstallments } from './installments';

const PLAN_TYPES = [
  { id: 'full', label: 'Pay in full' },
  { id: 'weekly', label: 'Weekly installments' },
  { id: 'custom', label: 'Custom schedule' },
  { id: 'hold', label: 'Hold' },
];

const day = (d) => (d ? format(parseISO(d), 'EEE, MMM d, yyyy') : '');
const cents = (n) => Math.round(Number(n || 0) * 100);

function LateLabel({ date, dueDate }) {
  const late = daysLate(date, dueDate);
  if (!date || !dueDate) return null;
  if (late > 0) return <span className="text-amber-300">{late} {late === 1 ? 'day' : 'days'} late</span>;
  return <span className="text-slate-500">On time</span>;
}

const inputClass = 'rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white focus:border-teal-500 focus:outline-none';

export default function PlanEditor({ bill, today, onClose, onSaved }) {
  const plan = bill.plan;
  const locked = (plan?.installments || []).filter((i) => i.matched_payment_id);
  const existingOpen = (plan?.installments || []).filter((i) => !i.matched_payment_id);
  const paidLocked = locked.filter((i) => i.status === 'paid').reduce((s, i) => s + Number(i.amount), 0);
  const lockedTotal = locked.reduce((s, i) => s + Number(i.amount), 0);
  // What the new installments must add up to.
  const toPlan = (cents(bill.due_amount) + cents(bill.scheduled_amount) + cents(paidLocked) - cents(lockedTotal)) / 100;

  const todayDate = parseISO(today);
  const dueDate = bill.due_date ? parseISO(bill.due_date) : todayDate;
  const defaultDate = iso(bill.due_date && dueDate >= todayDate ? dueDate : fridayOnOrAfter(todayDate));
  // Default to the last Friday on or before the due date, so a new plan does not start late.
  const fridayBeforeDue = fridayOnOrBefore(dueDate);
  const defaultFriday = iso(fridayBeforeDue >= todayDate ? fridayBeforeDue : fridayOnOrAfter(todayDate));

  const [planType, setPlanType] = useState(plan?.plan_type || 'full');
  const [fullDate, setFullDate] = useState(plan?.plan_type === 'full' && existingOpen[0] ? existingOpen[0].planned_date : defaultDate);
  const [weeklyStart, setWeeklyStart] = useState(plan?.plan_type === 'weekly' && existingOpen[0] ? existingOpen[0].planned_date : defaultFriday);
  const [weeklyMode, setWeeklyMode] = useState('weeks');
  const [weeks, setWeeks] = useState(plan?.plan_type === 'weekly' && existingOpen.length ? String(existingOpen.length) : '4');
  const [perWeek, setPerWeek] = useState('');
  const [customRows, setCustomRows] = useState(
    existingOpen.length
      ? existingOpen.map((i) => ({ planned_date: i.planned_date, amount: String(i.amount) }))
      : [{ planned_date: defaultDate, amount: toPlan > 0 ? String(toPlan) : '' }],
  );
  const [notes, setNotes] = useState(plan?.notes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const rows = useMemo(() => {
    if (planType === 'hold') return [];
    if (planType === 'full') return toPlan > 0 && fullDate ? [{ planned_date: fullDate, amount: toPlan }] : [];
    if (planType === 'weekly') {
      return weeklyInstallments(toPlan, weeklyStart, weeklyMode === 'weeks' ? { weeks: Number(weeks) } : { perWeek: Number(perWeek) });
    }
    return customRows
      .filter((r) => r.planned_date && Number(r.amount) > 0)
      .map((r) => ({ planned_date: r.planned_date, amount: Number(r.amount) }))
      .sort((a, b) => a.planned_date.localeCompare(b.planned_date));
  }, [planType, toPlan, fullDate, weeklyStart, weeklyMode, weeks, perWeek, customRows]);

  const rowsTotal = sumAmounts(rows);
  const difference = (cents(toPlan) - cents(rowsTotal)) / 100;
  const balanced = planType === 'hold' || (rows.length > 0 && Math.abs(difference) < 0.005) || (toPlan <= 0 && rows.length === 0 && locked.length > 0);

  async function save() {
    setSaving(true);
    setError('');
    try {
      await payablesService.savePayPlan({
        billId: bill.id,
        planType,
        installments: rows.map((r) => ({ planned_date: r.planned_date, amount: r.amount })),
        notes,
      });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setSaving(true);
    setError('');
    try {
      await payablesService.deletePayPlan(bill.id);
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  function updateCustom(index, field, value) {
    setCustomRows((list) => list.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/80 p-4" onClick={onClose}>
      <div className="my-8 w-full max-w-2xl rounded-xl border border-slate-700 bg-slate-900 shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Pay plan">
        <div className="flex items-start justify-between gap-4 border-b border-slate-700 p-5">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-teal-400">Pay plan</p>
            <h2 className="truncate text-lg font-bold text-white">{bill.vendor_name}</h2>
            <p className="text-sm text-slate-400">{bill.invoice_number || 'No invoice #'} · due {day(bill.due_date) || 'no due date'}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-5 p-5">
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div><p className="text-xs text-slate-400">Bill amount</p><p className="tabular-nums text-white">{money(bill.amount, { cents: true })}</p></div>
            <div><p className="text-xs text-slate-400">Paid</p><p className="tabular-nums text-white">{money(bill.paid_amount, { cents: true })}</p></div>
            <div><p className="text-xs text-slate-400">Scheduled in BILL</p><p className="tabular-nums text-white">{money(bill.scheduled_amount, { cents: true })}</p></div>
            <div><p className="text-xs text-slate-400">Left to plan</p><p className="font-semibold tabular-nums text-teal-300">{money(toPlan, { cents: true })}</p></div>
          </div>

          {locked.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-300"><Lock className="h-3.5 w-3.5" />Already in BILL (kept as is)</p>
              <ul className="space-y-1 text-sm">
                {locked.map((i) => (
                  <li key={i.id} className="flex flex-wrap justify-between gap-2 rounded border border-slate-700 px-3 py-2 text-slate-300">
                    <span>{day(i.bill_process_date || i.planned_date)} · <span className="capitalize">{i.status}</span>{i.matched_by === 'manual' ? ' · linked by hand' : ''}</span>
                    <span className="tabular-nums">{money(i.amount, { cents: true })}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-slate-300">How will this bill be paid?</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PLAN_TYPES.map((t) => (
                <label key={t.id} htmlFor={`plan-type-${t.id}`}
                  className={`cursor-pointer rounded-lg border px-3 py-2 text-center text-sm ${planType === t.id ? 'border-teal-500 bg-teal-500/10 text-white' : 'border-slate-600 text-slate-300 hover:border-slate-500'}`}>
                  <input id={`plan-type-${t.id}`} type="radio" name="plan-type" value={t.id} checked={planType === t.id}
                    onChange={() => setPlanType(t.id)} className="sr-only" />
                  {t.label}
                </label>
              ))}
            </div>
          </fieldset>

          {planType === 'full' && (
            <label htmlFor="plan-full-date" className="flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-400">Pay on</span>
              <input id="plan-full-date" type="date" value={fullDate} onChange={(e) => setFullDate(e.target.value)} className={`${inputClass} w-48`} />
            </label>
          )}

          {planType === 'weekly' && (
            <div className="flex flex-wrap items-end gap-3">
              <label htmlFor="plan-weekly-start" className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-400">First payment</span>
                <input id="plan-weekly-start" type="date" value={weeklyStart} onChange={(e) => setWeeklyStart(e.target.value)} className={`${inputClass} w-44`} />
              </label>
              <label htmlFor="plan-weekly-mode" className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-400">Split by</span>
                <select id="plan-weekly-mode" value={weeklyMode} onChange={(e) => setWeeklyMode(e.target.value)} className={inputClass}>
                  <option value="weeks">Number of weeks</option>
                  <option value="perWeek">Amount per week</option>
                </select>
              </label>
              {weeklyMode === 'weeks' ? (
                <label htmlFor="plan-weeks" className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-slate-400">Weeks</span>
                  <input id="plan-weeks" type="number" min="1" max="52" value={weeks} onChange={(e) => setWeeks(e.target.value)} className={`${inputClass} w-24`} />
                </label>
              ) : (
                <label htmlFor="plan-per-week" className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-slate-400">Per week</span>
                  <input id="plan-per-week" type="number" min="0.01" step="0.01" value={perWeek} onChange={(e) => setPerWeek(e.target.value)} className={`${inputClass} w-36`} placeholder="3000.00" />
                </label>
              )}
            </div>
          )}

          {planType === 'custom' && (
            <div className="space-y-2">
              {customRows.map((r, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <input id={`plan-custom-date-${i}`} aria-label={`Payment ${i + 1} date`} type="date" value={r.planned_date}
                    onChange={(e) => updateCustom(i, 'planned_date', e.target.value)} className={`${inputClass} w-44`} />
                  <input id={`plan-custom-amount-${i}`} aria-label={`Payment ${i + 1} amount`} type="number" min="0.01" step="0.01" value={r.amount}
                    onChange={(e) => updateCustom(i, 'amount', e.target.value)} className={`${inputClass} w-36`} placeholder="Amount" />
                  <button type="button" onClick={() => setCustomRows((list) => list.filter((_, j) => j !== i))}
                    className="rounded p-2 text-slate-400 hover:bg-slate-800 hover:text-red-300" aria-label={`Remove payment ${i + 1}`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => setCustomRows((list) => [...list, { planned_date: defaultFriday, amount: difference > 0 ? String(difference) : '' }])}
                className="inline-flex items-center gap-1 text-sm text-teal-400 hover:text-teal-300">
                <Plus className="h-4 w-4" />Add a payment
              </button>
            </div>
          )}

          {planType === 'hold' && (
            <p className="text-sm text-slate-400">No payment dates. The bill stays out of the cash-out forecast and is counted under On hold.</p>
          )}

          {planType !== 'hold' && rows.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-slate-700">
              <table className="w-full text-sm">
                <thead className="bg-slate-800 text-left text-xs uppercase tracking-wider text-slate-400">
                  <tr><th className="px-3 py-2">Payment</th><th className="px-3 py-2">Date</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2">Timing</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {rows.map((r, i) => (
                    <tr key={`${r.planned_date}-${i}`} className="text-slate-200">
                      <td className="px-3 py-2">{i + 1} of {rows.length}</td>
                      <td className="whitespace-nowrap px-3 py-2">{day(r.planned_date)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{money(r.amount, { cents: true })}</td>
                      <td className="px-3 py-2"><LateLabel date={r.planned_date} dueDate={bill.due_date} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {planType !== 'hold' && (
            <p className={`text-sm ${balanced ? 'text-teal-300' : 'text-amber-300'}`}>
              {balanced
                ? `Plan covers ${money(toPlan, { cents: true })}.`
                : difference > 0
                  ? `${money(difference, { cents: true })} still needs a date.`
                  : `Payments are ${money(-difference, { cents: true })} more than what is left to plan.`}
            </p>
          )}

          <label htmlFor="plan-notes" className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-400">Notes</span>
            <textarea id="plan-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} placeholder="Why this plan (optional)" />
          </label>

          {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-700 p-5">
          <div>
            {plan && !confirmDelete && (
              <button type="button" onClick={() => setConfirmDelete(true)} className="text-sm text-slate-400 hover:text-red-300">Remove plan</button>
            )}
            {plan && confirmDelete && (
              <span className="flex flex-wrap items-center gap-2 text-sm text-slate-300">
                Remove this plan?
                <button type="button" onClick={remove} disabled={saving} className="rounded bg-red-500/20 px-2 py-1 text-red-200 hover:bg-red-500/30">Remove</button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="text-slate-400 hover:text-white">Keep</button>
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-300 hover:bg-slate-800">Cancel</button>
            <button type="button" onClick={save} disabled={saving || !balanced}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-teal-400 disabled:opacity-50">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}Save plan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
