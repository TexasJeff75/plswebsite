import React, { useState, useEffect } from 'react';
import { Plus, CreditCard as Edit2, Trash2, Settings, CircleAlert as AlertCircle, X, Save, ToggleLeft, ToggleRight } from 'lucide-react';
import { commissionRulesService, salesRepsService } from '../../services/commissionsService';

const EMPTY_RULE = {
  name: '',
  description: '',
  sales_rep_id: '',
  rule_type: 'flat_rate',
  commission_rate: 0.05,
  min_amount: '',
  max_amount: '',
  applies_to_product_code: '',
  applies_to_customer_name: '',
  priority: 0,
  is_active: true,
  effective_from: '',
  effective_to: ''
};

const RULE_TYPE_LABELS = {
  flat_rate: 'Flat Rate',
  tiered: 'Tiered',
  product_specific: 'Product Specific',
  customer_specific: 'Customer Specific'
};

function formatDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function RulesTab() {
  const [rules, setRules] = useState([]);
  const [reps, setReps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [form, setForm] = useState(EMPTY_RULE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [filterRep, setFilterRep] = useState('');

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [r, rp] = await Promise.all([
        commissionRulesService.getAll(),
        salesRepsService.getAll()
      ]);
      setRules(r);
      setReps(rp);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setForm(EMPTY_RULE);
    setEditingRule(null);
    setShowModal(true);
    setError(null);
  }

  function openEdit(rule) {
    setForm({
      name: rule.name || '',
      description: rule.description || '',
      sales_rep_id: rule.sales_rep_id || '',
      rule_type: rule.rule_type || 'flat_rate',
      commission_rate: rule.commission_rate || 0.05,
      min_amount: rule.min_amount ?? '',
      max_amount: rule.max_amount ?? '',
      applies_to_product_code: rule.applies_to_product_code || '',
      applies_to_customer_name: rule.applies_to_customer_name || '',
      priority: rule.priority || 0,
      is_active: rule.is_active ?? true,
      effective_from: rule.effective_from || '',
      effective_to: rule.effective_to || ''
    });
    setEditingRule(rule);
    setShowModal(true);
    setError(null);
  }

  async function handleSave() {
    if (!form.name || !form.commission_rate) {
      setError('Name and commission rate are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        sales_rep_id: form.sales_rep_id || null,
        min_amount: form.min_amount === '' ? null : parseFloat(form.min_amount),
        max_amount: form.max_amount === '' ? null : parseFloat(form.max_amount),
        effective_from: form.effective_from || null,
        effective_to: form.effective_to || null
      };
      if (editingRule) {
        await commissionRulesService.update(editingRule.id, payload);
      } else {
        await commissionRulesService.create(payload);
      }
      setShowModal(false);
      await loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    try {
      await commissionRulesService.delete(id);
      setDeleteConfirm(null);
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  const filtered = filterRep ? rules.filter(r => r.sales_rep_id === filterRep || !r.sales_rep_id) : rules;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-white">Commission Rules</h2>
          <p className="text-sm text-slate-400">{filtered.length} rule{filtered.length !== 1 ? 's' : ''} · Higher priority rules take precedence</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={filterRep} onChange={e => setFilterRep(e.target.value)}
            className="bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors">
            <option value="">All Reps</option>
            {reps.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" />
            Add Rule
          </button>
        </div>
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
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <Settings className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-base font-medium">No commission rules</p>
          <p className="text-sm">Default rates from each rep profile are used when no rules apply.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.sort((a, b) => b.priority - a.priority).map(rule => (
            <div key={rule.id} className={`bg-slate-800/60 border rounded-xl p-4 transition-colors ${rule.is_active ? 'border-slate-700/60 hover:border-slate-600/60' : 'border-slate-700/30 opacity-60'}`}>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="mt-0.5 flex-shrink-0">
                    {rule.is_active
                      ? <ToggleRight className="w-5 h-5 text-teal-400" />
                      : <ToggleLeft className="w-5 h-5 text-slate-600" />
                    }
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-white font-medium">{rule.name}</p>
                      <span className="px-2 py-0.5 rounded text-xs bg-slate-700/60 text-slate-400">{RULE_TYPE_LABELS[rule.rule_type]}</span>
                      <span className="px-2 py-0.5 rounded text-xs bg-teal-500/20 text-teal-400 font-semibold">{(rule.commission_rate * 100).toFixed(1)}%</span>
                      {rule.priority > 0 && <span className="px-2 py-0.5 rounded text-xs bg-amber-500/20 text-amber-400">Priority {rule.priority}</span>}
                    </div>
                    {rule.description && <p className="text-slate-500 text-sm mt-0.5">{rule.description}</p>}
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {rule.sales_reps && <span className="text-xs text-slate-400 bg-slate-700/30 px-2 py-0.5 rounded">Rep: {rule.sales_reps.name}</span>}
                      {!rule.sales_rep_id && <span className="text-xs text-slate-500 bg-slate-700/20 px-2 py-0.5 rounded">All Reps (fallback)</span>}
                      {rule.applies_to_product_code && <span className="text-xs text-slate-400 bg-slate-700/30 px-2 py-0.5 rounded">Product: {rule.applies_to_product_code}</span>}
                      {rule.applies_to_customer_name && <span className="text-xs text-slate-400 bg-slate-700/30 px-2 py-0.5 rounded">Customer: {rule.applies_to_customer_name}</span>}
                      {rule.min_amount && <span className="text-xs text-slate-400 bg-slate-700/30 px-2 py-0.5 rounded">Min: ${rule.min_amount}</span>}
                      {rule.max_amount && <span className="text-xs text-slate-400 bg-slate-700/30 px-2 py-0.5 rounded">Max: ${rule.max_amount}</span>}
                      {rule.effective_from && <span className="text-xs text-slate-400">From {formatDate(rule.effective_from)}</span>}
                      {rule.effective_to && <span className="text-xs text-slate-400">To {formatDate(rule.effective_to)}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => openEdit(rule)} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => setDeleteConfirm(rule.id)} className="p-2 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <h3 className="text-lg font-semibold text-white">{editingRule ? 'Edit Rule' : 'New Commission Rule'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {error && <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm"><AlertCircle className="w-4 h-4" />{error}</div>}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Rule Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors" placeholder="e.g., Standard Commission" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Rule Type</label>
                  <select value={form.rule_type} onChange={e => setForm(f => ({ ...f, rule_type: e.target.value }))}
                    className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors">
                    {Object.entries(RULE_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Commission Rate *</label>
                  <div className="relative">
                    <input type="number" step="0.001" min="0" max="1" value={form.commission_rate}
                      onChange={e => setForm(f => ({ ...f, commission_rate: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors pr-12" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">{(form.commission_rate * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Apply to Rep (optional — leave blank for all)</label>
                <select value={form.sales_rep_id} onChange={e => setForm(f => ({ ...f, sales_rep_id: e.target.value }))}
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors">
                  <option value="">All Reps</option>
                  {reps.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Min Invoice Amount</label>
                  <input type="number" value={form.min_amount} onChange={e => setForm(f => ({ ...f, min_amount: e.target.value }))}
                    className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors" placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Max Invoice Amount</label>
                  <input type="number" value={form.max_amount} onChange={e => setForm(f => ({ ...f, max_amount: e.target.value }))}
                    className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors" placeholder="No limit" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Product Code Filter</label>
                  <input value={form.applies_to_product_code} onChange={e => setForm(f => ({ ...f, applies_to_product_code: e.target.value }))}
                    className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors" placeholder="e.g., LAB-001" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Customer Name Filter</label>
                  <input value={form.applies_to_customer_name} onChange={e => setForm(f => ({ ...f, applies_to_customer_name: e.target.value }))}
                    className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors" placeholder="Customer name..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Effective From</label>
                  <input type="date" value={form.effective_from} onChange={e => setForm(f => ({ ...f, effective_from: e.target.value }))}
                    className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Effective To</label>
                  <input type="date" value={form.effective_to} onChange={e => setForm(f => ({ ...f, effective_to: e.target.value }))}
                    className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Priority (higher = applied first)</label>
                <input type="number" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: parseInt(e.target.value) || 0 }))}
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2} className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors resize-none" placeholder="Optional description..." />
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors ${form.is_active ? 'bg-teal-500/20 border-teal-500/40 text-teal-400' : 'bg-slate-700/40 border-slate-600 text-slate-400'}`}>
                  {form.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                  {form.is_active ? 'Active' : 'Inactive'}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-700">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 text-sm transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Rule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-white font-semibold text-lg mb-2">Delete Rule?</h3>
            <p className="text-slate-400 text-sm mb-6">This commission rule will be permanently removed.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700 text-sm transition-colors">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
