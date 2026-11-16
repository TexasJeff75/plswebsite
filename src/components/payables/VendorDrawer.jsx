import React, { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Loader2, X } from 'lucide-react';
import { payablesService } from '../../services/payablesService';
import { money } from './format';

const ACRONYMS = { ACH: 'ACH', RPPS: 'RPPS', VCARD: 'Virtual card' };
const label = (s) => (s ? ACRONYMS[s] ?? s.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : '');
const day = (d) => (d ? format(parseISO(d), 'MMM d, yyyy') : '');

export default function VendorDrawer({ vendorId, onClose }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    setError('');
    payablesService.getVendorDetail(vendorId)
      .then((d) => { if (!cancelled) setDetail(d); })
      .catch((err) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [vendorId]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const vendor = detail?.vendor;
  const monthly = (detail?.monthly || []).map((m) => ({
    label: format(parseISO(m.month), "MMM ''yy"),
    Billed: Number(m.billed),
    Paid: Number(m.paid),
  }));

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70" onClick={onClose}>
      <aside
        className="h-full w-full max-w-2xl overflow-y-auto border-l border-slate-700 bg-slate-900 p-6"
        onClick={(e) => e.stopPropagation()}
        aria-label="Vendor details"
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-teal-400">Vendor</p>
            <h2 className="truncate text-xl font-bold text-white">{vendor?.name || (error ? 'Vendor' : 'Loading…')}</h2>
            {vendor && (
              <p className="mt-1 text-sm text-slate-400">
                {[vendor.city, vendor.state].filter(Boolean).join(', ') || 'No address on file'}
                {vendor.email ? ` · ${vendor.email}` : ''}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}
        {!detail && !error && <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-teal-400" /></div>}

        {detail && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                <p className="text-xs uppercase tracking-wider text-slate-400">Open balance</p>
                <p className="mt-1 text-lg font-semibold text-white tabular-nums">{money(detail.open_balance, { cents: true })}</p>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                <p className="text-xs uppercase tracking-wider text-slate-400">Average days to pay</p>
                <p className="mt-1 text-lg font-semibold text-white tabular-nums">{detail.average_days_to_pay ?? 'n/a'}</p>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3">
                <p className="text-xs uppercase tracking-wider text-slate-400">Pays by</p>
                <p className="mt-1 text-lg font-semibold text-white">{label(vendor?.pay_by_type) || 'n/a'}</p>
                {vendor?.autopay_enabled && <p className="text-xs text-amber-300">Autopay is on</p>}
              </div>
            </div>

            <section>
              <h3 className="mb-2 text-sm font-semibold text-white">Billed and paid by month</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthly} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={{ stroke: '#334155' }} minTickGap={10} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={{ stroke: '#334155' }} width={52}
                      tickFormatter={(v) => (v >= 1000 ? `$${Math.round(v / 1000)}K` : `$${v}`)} />
                    <Tooltip formatter={(v) => money(v, { cents: true })}
                      contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0' }} />
                    <Legend wrapperStyle={{ fontSize: 12, color: '#cbd5e1' }} />
                    <Bar dataKey="Billed" fill="#14b8a6" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Paid" fill="#38bdf8" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold text-white">Bills</h3>
              <div className="overflow-x-auto rounded-lg border border-slate-700">
                <table className="w-full text-sm">
                  <thead className="bg-slate-800 text-left text-xs uppercase tracking-wider text-slate-400">
                    <tr><th className="px-3 py-2">Invoice</th><th className="px-3 py-2">Date</th><th className="px-3 py-2">Due</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2 text-right">Still owed</th><th className="px-3 py-2">Status</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {detail.bills.map((b) => (
                      <tr key={b.id} className="text-slate-200">
                        <td className="px-3 py-2">{b.invoice_number || '—'}</td>
                        <td className="whitespace-nowrap px-3 py-2">{day(b.invoice_date)}</td>
                        <td className="whitespace-nowrap px-3 py-2">{day(b.due_date)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{money(b.amount, { cents: true })}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{money(b.due_amount, { cents: true })}</td>
                        <td className="px-3 py-2 text-slate-400">{label(b.payment_status)}</td>
                      </tr>
                    ))}
                    {!detail.bills.length && <tr><td colSpan={6} className="px-3 py-4 text-center text-slate-500">No bills.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold text-white">Payments</h3>
              <div className="overflow-x-auto rounded-lg border border-slate-700">
                <table className="w-full text-sm">
                  <thead className="bg-slate-800 text-left text-xs uppercase tracking-wider text-slate-400">
                    <tr><th className="px-3 py-2">Process date</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2">Method</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Confirmation</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {detail.payments.map((p) => (
                      <tr key={p.id} className="text-slate-200">
                        <td className="whitespace-nowrap px-3 py-2">{day(p.process_date)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{money(p.amount, { cents: true })}</td>
                        <td className="px-3 py-2 text-slate-400">{label(p.disbursement_type)}</td>
                        <td className="px-3 py-2 text-slate-400">{label(p.status)}</td>
                        <td className="px-3 py-2 text-slate-400">{p.confirmation_number || ''}</td>
                      </tr>
                    ))}
                    {!detail.payments.length && <tr><td colSpan={5} className="px-3 py-4 text-center text-slate-500">No payments.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}
