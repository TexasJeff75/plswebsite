import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Search, X, Loader2, Ruler } from 'lucide-react';
import { referenceRangesService } from '../services/referenceRangesService';
import ResultRangeBar from './lab/ResultRangeBar';
import { rangeLabel } from './lab/labResults';

const EMPTY = { test_name: '', panel_name: '', kind: 'range', range_low: '', range_high: '', cutoff: '', unit: '', notes: '' };

// Settings > Reference Ranges: the normal range or cut-off for each test.
// StratusDX does not send these, so result reports and charts use this list.
export default function ReferenceRanges() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setRows(await referenceRangesService.list());
      setError('');
    } catch (err) {
      setError('Unable to load reference ranges: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const term = search.trim().toLowerCase();
  const shown = useMemo(() => rows.filter((r) => !term
    || r.test_name.toLowerCase().includes(term)
    || (r.panel_name || '').toLowerCase().includes(term)), [rows, term]);

  async function save(e) {
    e.preventDefault();
    if (!editing.test_name.trim()) return setError('Test name is required.');
    if (editing.kind === 'cutoff' && editing.cutoff === '') return setError('Enter the cut-off value.');
    if (editing.kind === 'range' && editing.range_low === '' && editing.range_high === '') return setError('Enter a low value, a high value, or both.');
    setSaving(true);
    setError('');
    try {
      await referenceRangesService.save(editing);
      setEditing(null);
      await load();
    } catch (err) {
      setError(/duplicate|unique/i.test(err.message)
        ? 'This test already has a range. Edit the existing one, or enter a panel name if this panel needs its own range.'
        : 'Unable to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(row) {
    if (!window.confirm(`Remove the ${row.kind === 'cutoff' ? 'cut-off' : 'range'} for ${row.test_name}?`)) return;
    try {
      await referenceRangesService.remove(row.id);
      await load();
    } catch (err) {
      setError('Unable to remove: ' + err.message);
    }
  }

  const field = 'w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-teal-500 focus:outline-none';

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-xl font-semibold text-white">Reference Ranges</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            The normal range or cut-off for each test. StratusDX sends results and flags but not ranges, so
            the Lab Orders reports and trend charts use this list. Test names must match the names on the results.
          </p>
        </div>
        <button type="button" onClick={() => { setEditing({ ...EMPTY }); setError(''); }} className="flex items-center gap-2 rounded-lg bg-teal-500 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-teal-400">
          <Plus className="h-4 w-4" /> Add range
        </button>
      </div>

      {error && !editing && <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}

      <div className="rounded-xl border border-slate-700 bg-slate-800/50">
        <div className="border-b border-slate-700 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search test or panel" className={`${field} pl-9`} />
          </div>
        </div>
        {loading ? (
          <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-teal-400" /></div>
        ) : shown.length === 0 ? (
          <div className="p-10 text-center">
            <Ruler className="mx-auto h-10 w-10 text-slate-600" />
            <p className="mt-3 text-slate-300">{rows.length ? 'No ranges match your search' : 'No reference ranges yet'}</p>
            <p className="mt-1 text-sm text-slate-500">Add a range (for example Glucose 70 to 99 mg/dL) or a cut-off (for example Fentanyl 1 ng/mL).</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="px-4 py-2">Test</th><th className="px-4 py-2">Panel</th><th className="px-4 py-2">Type</th><th className="px-4 py-2">Value</th><th className="px-4 py-2 w-40">Preview</th><th className="px-4 py-2" />
              </tr></thead>
              <tbody className="divide-y divide-slate-800">
                {shown.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2 font-medium text-white">{r.test_name}{r.notes && <p className="text-xs font-normal text-slate-500">{r.notes}</p>}</td>
                    <td className="px-4 py-2 text-slate-300">{r.panel_name || <span className="text-slate-500">Any panel</span>}</td>
                    <td className="px-4 py-2 text-slate-300">{r.kind === 'cutoff' ? 'Cut-off' : 'Normal range'}</td>
                    <td className="px-4 py-2 text-slate-200">{rangeLabel(r)}</td>
                    <td className="px-4 py-2">
                      <ResultRangeBar
                        value={r.kind === 'cutoff' ? Number(r.cutoff) * 0.5 : r.range_low != null && r.range_high != null ? (Number(r.range_low) + Number(r.range_high)) / 2 : Number(r.range_low ?? r.range_high)}
                        range={r}
                        status={r.kind === 'cutoff' ? 'negative' : 'normal'}
                      />
                    </td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <button type="button" onClick={() => { setEditing({ ...EMPTY, ...r, range_low: r.range_low ?? '', range_high: r.range_high ?? '', cutoff: r.cutoff ?? '', panel_name: r.panel_name || '', unit: r.unit || '', notes: r.notes || '' }); setError(''); }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white" title="Edit"><Pencil className="h-4 w-4" /></button>
                      <button type="button" onClick={() => remove(r)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-700 hover:text-red-300" title="Remove"><Trash2 className="h-4 w-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
          <form onSubmit={save} className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-800 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-700 px-6 py-4">
              <h3 className="text-lg font-semibold text-white">{editing.id ? 'Edit range' : 'Add range'}</h3>
              <button type="button" onClick={() => setEditing(null)} className="text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4 p-6">
              {error && <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
              <label className="block"><span className="mb-1 block text-sm text-slate-300">Test name *</span>
                <input value={editing.test_name} onChange={(e) => setEditing({ ...editing, test_name: e.target.value })} placeholder="Exactly as on the results, e.g. Fentanyl" className={field} /></label>
              <label className="block"><span className="mb-1 block text-sm text-slate-300">Panel (optional)</span>
                <input value={editing.panel_name} onChange={(e) => setEditing({ ...editing, panel_name: e.target.value })} placeholder="Only if this panel needs its own range" className={field} /></label>
              <div className="flex gap-2">
                {[['range', 'Normal range'], ['cutoff', 'Cut-off']].map(([k, label]) => (
                  <button key={k} type="button" onClick={() => setEditing({ ...editing, kind: k })} className={`flex-1 rounded-lg border px-3 py-2 text-sm ${editing.kind === k ? 'border-teal-500 bg-teal-500/10 text-teal-300' : 'border-slate-700 text-slate-300'}`}>{label}</button>
                ))}
              </div>
              {editing.kind === 'cutoff' ? (
                <label className="block"><span className="mb-1 block text-sm text-slate-300">Cut-off (positive at or above) *</span>
                  <input type="number" step="any" value={editing.cutoff} onChange={(e) => setEditing({ ...editing, cutoff: e.target.value })} className={field} /></label>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <label className="block"><span className="mb-1 block text-sm text-slate-300">Low</span>
                    <input type="number" step="any" value={editing.range_low} onChange={(e) => setEditing({ ...editing, range_low: e.target.value })} className={field} /></label>
                  <label className="block"><span className="mb-1 block text-sm text-slate-300">High</span>
                    <input type="number" step="any" value={editing.range_high} onChange={(e) => setEditing({ ...editing, range_high: e.target.value })} className={field} /></label>
                </div>
              )}
              <label className="block"><span className="mb-1 block text-sm text-slate-300">Unit</span>
                <input value={editing.unit} onChange={(e) => setEditing({ ...editing, unit: e.target.value })} placeholder="e.g. ng/mL" className={field} /></label>
              <label className="block"><span className="mb-1 block text-sm text-slate-300">Notes</span>
                <input value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} placeholder="Optional, e.g. source of the range" className={field} /></label>
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-700 px-6 py-4">
              <button type="button" onClick={() => setEditing(null)} className="rounded-lg px-4 py-2 text-sm text-slate-300 hover:bg-slate-700">Cancel</button>
              <button type="submit" disabled={saving} className="flex items-center gap-2 rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-teal-400 disabled:opacity-50">{saving && <Loader2 className="h-4 w-4 animate-spin" />}Save</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
