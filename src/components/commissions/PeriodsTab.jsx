import React, { useState, useEffect } from 'react';
import { Calendar, Plus, CreditCard as Edit2, CircleAlert as AlertCircle, X, Save } from 'lucide-react';
import { commissionPeriodsService } from '../../services/commissionsService';

const EMPTY_PERIOD = {
  name: '',
  period_type: 'monthly',
  start_date: '',
  end_date: '',
  status: 'Open'
};

const STATUS_COLORS = {
  'Open': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  'Processing': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'Review': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  'Approved': 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  'Paid': 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  'Closed': 'bg-slate-700/40 text-slate-500 border-slate-700/40',
};

function formatDate(d) {
  if (!d) return '—';
  const [y, m, day] = String(d).split('T')[0].split('-').map(Number);
  if (y && m && day) {
    return new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function PeriodsTab() {
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState(null);
  const [form, setForm] = useState(EMPTY_PERIOD);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await commissionPeriodsService.getAll();
      setPeriods(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setForm(EMPTY_PERIOD);
    setEditingPeriod(null);
    setShowModal(true);
  }

  function openEdit(period) {
    setForm({
      name: period.name || '',
      period_type: period.period_type || 'monthly',
      start_date: period.start_date || '',
      end_date: period.end_date || '',
      status: period.status || 'Open'
    });
    setEditingPeriod(period);
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name || !form.start_date || !form.end_date) {
      setError('Name, start date, and end date are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editingPeriod) {
        await commissionPeriodsService.update(editingPeriod.id, form);
      } else {
        await commissionPeriodsService.create(form);
      }
      setShowModal(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function autoName() {
    if (form.start_date && form.period_type) {
      const d = new Date(form.start_date);
      const month = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const types = { monthly: month, quarterly: `Q${Math.ceil((d.getMonth()+1)/3)} ${d.getFullYear()}`, weekly: `Week of ${formatDate(form.start_date)}`, biweekly: `Bi-Week of ${formatDate(form.start_date)}` };
      setForm(f => ({ ...f, name: types[form.period_type] || month }));
    }
  }

  function autoEndDate() {
    if (form.start_date && form.period_type) {
      const d = new Date(form.start_date);
      let end;
      if (form.period_type === 'monthly') { end = new Date(d.getFullYear(), d.getMonth()+1, 0); }
      else if (form.period_type === 'quarterly') { end = new Date(d.getFullYear(), d.getMonth()+3, 0); }
      else if (form.period_type === 'weekly') { end = new Date(d); end.setDate(end.getDate()+6); }
      else if (form.period_type === 'biweekly') { end = new Date(d); end.setDate(end.getDate()+13); }
      if (end) setForm(f => ({ ...f, end_date: end.toISOString().split('T')[0] }));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Commission Periods</h2>
          <p className="text-sm text-slate-400">{periods.length} period{periods.length !== 1 ? 's' : ''} defined</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" />
          Add Period
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : periods.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-base font-medium">No periods configured</p>
          <p className="text-sm">Create commission periods to organize your invoice cycles.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {periods.map(period => (
            <div key={period.id} className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 flex items-center justify-between gap-4 hover:border-slate-600/60 transition-colors">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-slate-700/50 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-4 h-4 text-teal-400" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-white font-medium">{period.name}</p>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[period.status] || STATUS_COLORS['Open']}`}>{period.status}</span>
                    <span className="px-2 py-0.5 rounded-full text-xs text-slate-500 bg-slate-700/30">{period.period_type}</span>
                  </div>
                  <p className="text-slate-500 text-sm mt-0.5">{formatDate(period.start_date)} — {formatDate(period.end_date)}</p>
                </div>
              </div>
              <button onClick={() => openEdit(period)} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors flex-shrink-0">
                <Edit2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <h3 className="text-lg font-semibold text-white">{editingPeriod ? 'Edit Period' : 'New Commission Period'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {error && <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Period Type</label>
                <select value={form.period_type} onChange={e => setForm(f => ({ ...f, period_type: e.target.value }))}
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors">
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="biweekly">Bi-Weekly</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Start Date *</label>
                  <input type="date" value={form.start_date}
                    onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                    onBlur={() => { autoName(); autoEndDate(); }}
                    className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">End Date *</label>
                  <input type="date" value={form.end_date}
                    onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                    className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Period Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-teal-500 transition-colors" placeholder="e.g., January 2026" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors">
                  {['Open', 'Processing', 'Review', 'Approved', 'Paid', 'Closed'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-700">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 text-sm transition-colors">Cancel</button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Period'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
