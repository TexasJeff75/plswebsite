import React, { useEffect, useMemo, useState } from 'react';
import { FlaskConical, RefreshCw, Search, User, Users, Beaker, CheckCircle2, Clock, AlertTriangle, X, ChevronRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { labOrdersService } from '../../services/labOrdersService';
import { listFacilityOrders, getObservationsForOrders } from '../../services/labDataService';
import { referenceRangesService } from '../../services/referenceRangesService';
import PanelReport from '../lab/PanelReport';
import TrendChart from '../lab/TrendChart';
import { classify, findRange, formatDob, numericValue, parseLabDate, patientKey, patientName, rangeLabel } from '../lab/labResults';

const STATUS_STYLE = {
  Final: 'bg-emerald-500/15 text-emerald-300',
  'Pending Received': 'bg-blue-500/15 text-blue-300',
  Pending: 'bg-slate-700 text-slate-300',
  Canceled: 'bg-red-500/15 text-red-300',
  Rejected: 'bg-red-500/15 text-red-300',
};

function shortDate(value) {
  const d = parseLabDate(value);
  return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-';
}

// Lab orders for one facility: patients and their history, and each order's
// results grouped by panel with ranges, cut-offs and trend charts.
export default function LabOrdersTab({ facility }) {
  const { isStaff } = useAuth();
  const [orders, setOrders] = useState([]);
  const [ranges, setRanges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState('patients');
  const [search, setSearch] = useState('');
  const [patientId, setPatientId] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [orderRows, rangeRows] = await Promise.all([
        listFacilityOrders(facility.id),
        referenceRangesService.list().catch(() => []),
      ]);
      setOrders(orderRows);
      setRanges(rangeRows);
    } catch (err) {
      console.error('Error loading lab orders:', err);
      setError('Unable to load lab orders: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [facility.id]);

  const patients = useMemo(() => {
    const map = new Map();
    orders.forEach((o) => {
      const key = patientKey(o);
      if (!map.has(key)) map.set(key, { key, name: patientName(o), dob: o.patient_dob, orders: [] });
      map.get(key).orders.push(o);
    });
    return [...map.values()];
  }, [orders]);

  const stats = useMemo(() => ({
    orders: orders.length,
    patients: patients.length,
    final: orders.filter((o) => o.lab_status === 'Final').length,
    pending: orders.filter((o) => o.lab_status === 'Pending' || o.lab_status === 'Pending Received').length,
    canceled: orders.filter((o) => o.lab_status === 'Canceled' || o.lab_status === 'Rejected').length,
  }), [orders, patients]);

  const term = search.trim().toLowerCase();
  const filteredPatients = useMemo(() => patients.filter((p) => !term
    || p.name.toLowerCase().includes(term)
    || formatDob(p.dob).toLowerCase().includes(term)
    || p.orders.some((o) => String(o.accession_number || o.stratus_guid).includes(term))), [patients, term]);
  const filteredOrders = useMemo(() => orders.filter((o) => !term
    || patientName(o).toLowerCase().includes(term)
    || String(o.accession_number || o.stratus_guid).includes(term)), [orders, term]);

  const patient = patients.find((p) => p.key === patientId) || null;

  async function handleSync() {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const result = await labOrdersService.syncAll();
      const s = result.summary || {};
      setSyncMessage({ type: 'success', text: `Sync complete: ${s.total_processed || 0} orders processed${s.more ? ', more to import (the sync runs every 5 minutes)' : ''}.` });
      await loadData();
    } catch (err) {
      setSyncMessage({ type: 'error', text: 'Sync failed: ' + err.message });
    } finally {
      setSyncing(false);
    }
  }

  if (loading) {
    return <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500/10"><FlaskConical className="h-5 w-5 text-teal-400" /></div>
          <div>
            <h3 className="text-lg font-semibold text-white">Lab Orders & Results</h3>
            <p className="text-sm text-slate-400">History by patient, with results grouped by panel</p>
          </div>
        </div>
        {isStaff && (
          <button type="button" onClick={handleSync} disabled={syncing} className="flex items-center gap-2 rounded-lg bg-teal-500 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-teal-400 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />{syncing ? 'Syncing...' : 'Sync Now'}
          </button>
        )}
      </div>

      {syncMessage && <div className={`rounded-lg border p-3 text-sm ${syncMessage.type === 'success' ? 'border-teal-500/20 bg-teal-500/10 text-teal-300' : 'border-red-500/20 bg-red-500/10 text-red-300'}`}>{syncMessage.text}</div>}
      {error && <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Stat icon={Beaker} color="text-teal-400" label="Orders" value={stats.orders} />
        <Stat icon={Users} color="text-blue-400" label="Patients" value={stats.patients} />
        <Stat icon={CheckCircle2} color="text-emerald-400" label="Final" value={stats.final} />
        <Stat icon={Clock} color="text-slate-300" label="Pending" value={stats.pending} />
        <Stat icon={AlertTriangle} color="text-red-400" label="Canceled / rejected" value={stats.canceled} />
      </div>

      {patient ? (
        <PatientHistory patient={patient} ranges={ranges} onBack={() => setPatientId(null)} />
      ) : (
        <div className="rounded-xl border border-slate-700 bg-slate-800/50">
          <div className="flex flex-col gap-3 border-b border-slate-700 p-4 sm:flex-row sm:items-center">
            <div className="flex gap-1 rounded-lg bg-slate-900 p-1">
              {[['patients', 'Patients'], ['orders', 'All orders']].map(([id, label]) => (
                <button key={id} type="button" onClick={() => setView(id)} className={`rounded-md px-3 py-1.5 text-sm font-medium ${view === id ? 'bg-teal-500/15 text-teal-300' : 'text-slate-400 hover:text-white'}`}>{label}</button>
              ))}
            </div>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search patient name, date of birth or accession" className="w-full rounded-lg border border-slate-700 bg-slate-900 py-2 pl-9 pr-3 text-sm text-white placeholder-slate-500 focus:border-teal-500 focus:outline-none" />
            </div>
          </div>

          {orders.length === 0 ? (
            <p className="p-10 text-center text-slate-400">No lab orders for this facility yet.</p>
          ) : view === 'patients' ? (
            <div className="divide-y divide-slate-700">
              {filteredPatients.slice(0, 300).map((p) => {
                const last = p.orders[0];
                const finals = p.orders.filter((o) => o.lab_status === 'Final').length;
                return (
                  <button key={p.key} type="button" onClick={() => setPatientId(p.key)} className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-slate-700/30">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-700"><User className="h-4 w-4 text-slate-300" /></div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-white">{p.name}</p>
                      <p className="text-sm text-slate-400">DOB {formatDob(p.dob) || 'unknown'}</p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="text-white">{p.orders.length} order{p.orders.length === 1 ? '' : 's'}</p>
                      <p className="text-slate-400">{finals} final · last {shortDate(last.requisition_datetime)}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-500" />
                  </button>
                );
              })}
              {filteredPatients.length > 300 && <p className="px-4 py-3 text-sm text-slate-400">Showing 300 of {filteredPatients.length} patients. Search to narrow the list.</p>}
              {filteredPatients.length === 0 && <p className="px-4 py-6 text-center text-sm text-slate-400">No patients match your search.</p>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead><tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-2">Accession</th><th className="px-4 py-2">Patient</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Ordered</th><th className="px-4 py-2">Finalized</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredOrders.slice(0, 300).map((o) => (
                    <tr key={o.id} onClick={() => setPatientId(patientKey(o))} className="cursor-pointer hover:bg-slate-700/30">
                      <td className="px-4 py-2 font-medium text-white">{o.accession_number || o.stratus_guid}</td>
                      <td className="px-4 py-2 text-slate-200">{patientName(o)}</td>
                      <td className="px-4 py-2"><span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[o.lab_status] || STATUS_STYLE.Pending}`}>{o.lab_status || 'Pending'}</span></td>
                      <td className="px-4 py-2 text-slate-300">{shortDate(o.requisition_datetime)}</td>
                      <td className="px-4 py-2 text-slate-300">{shortDate(o.finalized_datetime)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredOrders.length > 300 && <p className="px-4 py-3 text-sm text-slate-400">Showing 300 of {filteredOrders.length} orders. Search to narrow the list.</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, color, label, value }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
      <div className="mb-2 flex items-center gap-2"><Icon className={`h-4 w-4 ${color}`} /><span className="text-xs text-slate-400">{label}</span></div>
      <p className="text-2xl font-bold text-white">{Number(value).toLocaleString()}</p>
    </div>
  );
}

// One patient's orders over time; pick an order to see its report, or a test to see its trend.
function PatientHistory({ patient, ranges, onBack }) {
  const [observations, setObservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [orderId, setOrderId] = useState(() => (patient.orders.find((o) => o.lab_status === 'Final') || patient.orders[0])?.id);
  const [trend, setTrend] = useState(null); // { test, panel }

  useEffect(() => {
    let live = true;
    setLoading(true);
    getObservationsForOrders(patient.orders.map((o) => o.id))
      .then((rows) => { if (live) setObservations(rows); })
      .catch((err) => { if (live) setError('Unable to load results: ' + err.message); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [patient]);

  const byOrder = useMemo(() => {
    const map = new Map();
    observations.forEach((o) => {
      if (!map.has(o.lab_order_id)) map.set(o.lab_order_id, []);
      map.get(o.lab_order_id).push(o);
    });
    return map;
  }, [observations]);

  const order = patient.orders.find((o) => o.id === orderId) || null;

  const trendData = useMemo(() => {
    if (!trend) return null;
    const t = trend.test.trim().toLowerCase();
    const range = findRange(ranges, trend.test, trend.panel);
    const points = [...patient.orders].reverse().flatMap((o) => (byOrder.get(o.id) || [])
      .filter((obs) => (obs.test_name || '').trim().toLowerCase() === t)
      .map((obs) => ({ obs, o, value: numericValue(obs) }))
      .filter((p) => p.value != null)
      .map(({ obs, o, value }) => ({ label: shortDate(o.requisition_datetime), value, display: obs.result_display || obs.result_value })));
    const unit = (observations.find((obs) => (obs.test_name || '').trim().toLowerCase() === t) || {}).result_uom || range?.unit || '';
    return { range, points, unit };
  }, [trend, patient, byOrder, ranges, observations]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/50 p-4">
        <button type="button" onClick={onBack} className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700">Back to list</button>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-500/10"><User className="h-5 w-5 text-teal-300" /></div>
        <div>
          <p className="text-lg font-semibold text-white">{patient.name}</p>
          <p className="text-sm text-slate-400">DOB {formatDob(patient.dob) || 'unknown'} · {patient.orders.length} order{patient.orders.length === 1 ? '' : 's'}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="rounded-xl border border-slate-700 bg-slate-800/50">
          <p className="border-b border-slate-700 px-4 py-3 text-sm font-semibold text-white">Order history</p>
          <div className="max-h-[640px] divide-y divide-slate-800 overflow-y-auto">
            {patient.orders.map((o) => {
              const obs = byOrder.get(o.id) || [];
              const flagged = obs.filter((x) => ['positive', 'high', 'low', 'abnormal'].includes(classify(x, findRange(ranges, x.test_name, x.panel_name)))).length;
              return (
                <button key={o.id} type="button" onClick={() => { setOrderId(o.id); setTrend(null); }} className={`block w-full px-4 py-3 text-left ${o.id === orderId ? 'bg-teal-500/10' : 'hover:bg-slate-700/30'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-white">{shortDate(o.requisition_datetime)}</span>
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[o.lab_status] || STATUS_STYLE.Pending}`}>{o.lab_status || 'Pending'}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">#{o.accession_number || o.stratus_guid}{Array.isArray(o.panels) && o.panels.length ? ` · ${o.panels.join(', ')}` : ''}</p>
                  {!loading && obs.length > 0 && (
                    <p className={`mt-1 text-xs ${flagged ? 'text-red-300' : 'text-emerald-300'}`}>{flagged ? `${flagged} flagged result${flagged === 1 ? '' : 's'}` : 'Nothing flagged'}</p>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          {error && <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}
          {trend && trendData && (
            <div className="rounded-xl border border-teal-500/30 bg-slate-800/50 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-white">{trend.test} over time</p>
                  <p className="text-xs text-slate-400">{rangeLabel(trendData.range) || 'No range or cut-off set for this test (Settings > Reference Ranges)'}</p>
                </div>
                <button type="button" onClick={() => setTrend(null)} className="text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
              </div>
              <TrendChart points={trendData.points} range={trendData.range} unit={trendData.unit} />
            </div>
          )}
          {order && (
            <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
              <div className="mb-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <p className="text-lg font-semibold text-white">Order #{order.accession_number || order.stratus_guid}</p>
                <p className="text-sm text-slate-400">Ordered {shortDate(order.requisition_datetime)} · Received {shortDate(order.received_datetime)} · Finalized {shortDate(order.finalized_datetime)}</p>
                {order.provider_name && <p className="text-sm text-slate-400">Provider: {order.provider_name}</p>}
              </div>
              {loading ? (
                <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" /></div>
              ) : (
                <PanelReport observations={byOrder.get(order.id) || []} ranges={ranges} onTrend={(test, panel) => setTrend({ test, panel })} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
