import React, { useState, useEffect } from 'react';
import { UserPlus, CreditCard as Edit2, Trash2, DollarSign, Mail, Phone, MapPin, X, Save, CircleAlert as AlertCircle } from 'lucide-react';
import { salesRepsService } from '../../services/commissionsService';

const EMPTY_REP = {
  name: '',
  email: '',
  employee_id: '',
  phone: '',
  territory: '',
  status: 'Active',
  default_commission_rate: 0.05,
  billcom_vendor_id: '',
  billcom_vendor_name: '',
  notes: ''
};

export default function SalesRepsTab() {
  const [reps, setReps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRep, setEditingRep] = useState(null);
  const [form, setForm] = useState(EMPTY_REP);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      setLoading(true);
      const data = await salesRepsService.getAll();
      setReps(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setForm(EMPTY_REP);
    setEditingRep(null);
    setShowModal(true);
  }

  function openEdit(rep) {
    setForm({
      name: rep.name || '',
      email: rep.email || '',
      employee_id: rep.employee_id || '',
      phone: rep.phone || '',
      territory: rep.territory || '',
      status: rep.status || 'Active',
      default_commission_rate: rep.default_commission_rate || 0.05,
      billcom_vendor_id: rep.billcom_vendor_id || '',
      billcom_vendor_name: rep.billcom_vendor_name || '',
      notes: rep.notes || ''
    });
    setEditingRep(rep);
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name || !form.email) {
      setError('Name and email are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editingRep) {
        await salesRepsService.update(editingRep.id, form);
      } else {
        await salesRepsService.create(form);
      }
      setShowModal(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    try {
      await salesRepsService.delete(id);
      setDeleteConfirm(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  const statusColor = s => s === 'Active' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-slate-500/20 text-slate-400 border-slate-500/30';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Sales Representatives</h2>
          <p className="text-sm text-slate-400">{reps.length} rep{reps.length !== 1 ? 's' : ''} configured</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Add Rep
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : reps.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <UserPlus className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-base font-medium">No sales reps yet</p>
          <p className="text-sm">Add your first sales representative to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {reps.map(rep => (
            <div key={rep.id} className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-5 hover:border-slate-600/60 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-teal-500/20 border border-teal-500/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-teal-400 font-semibold text-sm">{rep.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-white font-semibold">{rep.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusColor(rep.status)}`}>{rep.status}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                      <span className="flex items-center gap-1 text-sm text-slate-400">
                        <Mail className="w-3.5 h-3.5" />{rep.email}
                      </span>
                      {rep.phone && (
                        <span className="flex items-center gap-1 text-sm text-slate-400">
                          <Phone className="w-3.5 h-3.5" />{rep.phone}
                        </span>
                      )}
                      {rep.territory && (
                        <span className="flex items-center gap-1 text-sm text-slate-400">
                          <MapPin className="w-3.5 h-3.5" />{rep.territory}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3">
                      <div className="px-3 py-1 bg-slate-700/50 rounded-lg">
                        <span className="text-xs text-slate-500">Commission Rate</span>
                        <p className="text-sm font-semibold text-teal-400">{(rep.default_commission_rate * 100).toFixed(1)}%</p>
                      </div>
                      {rep.billcom_vendor_id && (
                        <div className="px-3 py-1 bg-slate-700/50 rounded-lg">
                          <span className="text-xs text-slate-500">Bill.com</span>
                          <p className="text-sm font-medium text-slate-300">{rep.billcom_vendor_name || rep.billcom_vendor_id}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => openEdit(rep)}
                    className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(rep.id)}
                    className="p-2 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-colors"
                  >
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
              <h3 className="text-lg font-semibold text-white">{editingRep ? 'Edit Sales Rep' : 'Add Sales Rep'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-300 mb-1">Full Name *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-teal-500 transition-colors" placeholder="Jane Smith" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-300 mb-1">Email *</label>
                  <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-teal-500 transition-colors" placeholder="jane@example.com" type="email" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Phone</label>
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-teal-500 transition-colors" placeholder="(555) 123-4567" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Employee ID</label>
                  <input value={form.employee_id} onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}
                    className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-teal-500 transition-colors" placeholder="EMP-001" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Territory</label>
                  <input value={form.territory} onChange={e => setForm(f => ({ ...f, territory: e.target.value }))}
                    className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-teal-500 transition-colors" placeholder="Northeast" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500 transition-colors">
                    <option>Active</option>
                    <option>Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Default Commission Rate</label>
                  <div className="relative">
                    <input
                      type="number" step="0.001" min="0" max="1"
                      value={form.default_commission_rate}
                      onChange={e => setForm(f => ({ ...f, default_commission_rate: parseFloat(e.target.value) || 0 }))}
                      className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-teal-500 transition-colors pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                      {(form.default_commission_rate * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="col-span-2 border-t border-slate-700 pt-4">
                  <p className="text-xs text-slate-500 uppercase font-semibold mb-3">Bill.com Integration</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Bill.com Vendor ID</label>
                  <input value={form.billcom_vendor_id} onChange={e => setForm(f => ({ ...f, billcom_vendor_id: e.target.value }))}
                    className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-teal-500 transition-colors" placeholder="00901234..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Bill.com Vendor Name</label>
                  <input value={form.billcom_vendor_name} onChange={e => setForm(f => ({ ...f, billcom_vendor_name: e.target.value }))}
                    className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-teal-500 transition-colors" placeholder="Jane Smith" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-300 mb-1">Notes</label>
                  <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    rows={3}
                    className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-teal-500 transition-colors resize-none" placeholder="Additional notes..." />
                </div>
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
                {saving ? 'Saving...' : 'Save Rep'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-white font-semibold text-lg mb-2">Delete Sales Rep?</h3>
            <p className="text-slate-400 text-sm mb-6">This will permanently remove this sales rep and all associated commission rules. This action cannot be undone.</p>
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
