import React, { useState, useEffect } from 'react';
import { labOrdersService } from '../../services/labOrdersService';
import {
  FlaskConical, RefreshCw, CheckCircle2, XCircle, Clock,
  AlertTriangle, FileText, Download, ChevronDown, ChevronRight,
  Beaker, ClipboardCheck, Activity, User, Building2, Stethoscope,
  ZapOff, TrendingUp
} from 'lucide-react';
import { format } from 'date-fns';

const ORDER_STATUS_COLORS = {
  pending: { label: 'Pending', color: 'bg-slate-500/20 text-slate-400', icon: Clock },
  retrieved: { label: 'Retrieved', color: 'bg-blue-500/20 text-blue-400', icon: Download },
  acknowledged: { label: 'Acknowledged', color: 'bg-green-500/20 text-green-400', icon: CheckCircle2 },
  synced: { label: 'Synced', color: 'bg-teal-500/20 text-teal-400', icon: CheckCircle2 },
  error: { label: 'Error', color: 'bg-red-500/20 text-red-400', icon: XCircle },
};

const RESULT_STATUS_COLORS = {
  preliminary: { label: 'Preliminary', color: 'bg-amber-500/20 text-amber-400' },
  final: { label: 'Final', color: 'bg-green-500/20 text-green-400' },
  canceled: { label: 'Canceled', color: 'bg-red-500/20 text-red-400' },
  corrected: { label: 'Corrected', color: 'bg-blue-500/20 text-blue-400' },
};

function getSyncBadge(status) {
  return ORDER_STATUS_COLORS[status] || ORDER_STATUS_COLORS.pending;
}

function getTurnaroundHours(processedAt, resultedAt) {
  if (!processedAt || !resultedAt) return null;
  const diff = new Date(resultedAt) - new Date(processedAt);
  return Math.round(diff / (1000 * 60 * 60) * 10) / 10;
}

export default function LabOrdersTab({ facility }) {
  const [activeView, setActiveView] = useState('orders');
  const [orders, setOrders] = useState([]);
  const [confirmations, setConfirmations] = useState([]);
  const [results, setResults] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [syncMessage, setSyncMessage] = useState(null);

  useEffect(() => {
    loadData();
  }, [facility.id]);

  async function loadData() {
    try {
      setLoading(true);
      const [ordersData, confirmationsData, resultsData, statsData] = await Promise.all([
        labOrdersService.getOrders({ facility_id: facility.id }),
        labOrdersService.getConfirmations({ facility_id: facility.id }),
        labOrdersService.getResults({ facility_id: facility.id }),
        labOrdersService.getOrderStats(facility.id)
      ]);

      setOrders(ordersData);
      setConfirmations(confirmationsData);
      setResults(resultsData);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading lab data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    try {
      setSyncing(true);
      setSyncMessage(null);
      const syncResult = await labOrdersService.syncAll();

      const summary = syncResult.summary || {};
      const parts = [];
      parts.push(`${summary.total_processed || 0} orders processed`);
      if (summary.errors > 0) parts.push(`${summary.errors} errors`);
      if (syncResult.errors?.length > 0) {
        parts.push(`Errors: ${syncResult.errors.slice(0, 3).map(e => e.accessionId || e.error).join(', ')}`);
      }
      setSyncMessage({ type: 'success', text: `Sync complete: ${parts.join(', ')}` });
      await loadData();
    } catch (error) {
      console.error('Error syncing:', error);
      setSyncMessage({ type: 'error', text: 'Sync failed: ' + error.message });
    } finally {
      setSyncing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-teal-500/10 rounded-lg flex items-center justify-center">
            <FlaskConical className="w-5 h-5 text-teal-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Lab Orders & Results</h3>
            <p className="text-slate-400 text-sm">StratusDX Integration</p>
          </div>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-slate-900 rounded-lg hover:bg-teal-400 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Sync Now'}
        </button>
      </div>

      {syncMessage && (
        <div className={`p-3 rounded-lg text-sm flex items-start gap-2 ${
          syncMessage.type === 'success'
            ? 'bg-teal-500/10 border border-teal-500/20 text-teal-300'
            : 'bg-red-500/10 border border-red-500/20 text-red-300'
        }`}>
          {syncMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
          <span>{syncMessage.text}</span>
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Beaker className="w-4 h-4 text-teal-400" />
              <span className="text-xs text-slate-400">Total Orders</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.total_orders}</p>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <span className="text-xs text-slate-400">Synced</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.synced || stats.acknowledged}</p>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-slate-400">Total Results</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.total_results}</p>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <span className="text-xs text-slate-400">Finalized</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.finalized_results || 0}</p>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span className="text-xs text-slate-400">Abnormal</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.abnormal_results || 0}</p>
          </div>
        </div>
      )}

      <div className="border-b border-slate-700">
        <nav className="flex gap-1">
          <button
            onClick={() => setActiveView('orders')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeView === 'orders'
                ? 'text-teal-400 border-teal-400'
                : 'text-slate-400 border-transparent hover:text-white hover:border-slate-600'
            }`}
          >
            <Beaker className="w-4 h-4" />
            Orders ({orders.length})
          </button>
          <button
            onClick={() => setActiveView('confirmations')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeView === 'confirmations'
                ? 'text-teal-400 border-teal-400'
                : 'text-slate-400 border-transparent hover:text-white hover:border-slate-600'
            }`}
          >
            <ClipboardCheck className="w-4 h-4" />
            Confirmations ({confirmations.length})
          </button>
          <button
            onClick={() => setActiveView('results')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeView === 'results'
                ? 'text-teal-400 border-teal-400'
                : 'text-slate-400 border-transparent hover:text-white hover:border-slate-600'
            }`}
          >
            <Activity className="w-4 h-4" />
            Results ({results.length})
          </button>
        </nav>
      </div>

      {activeView === 'orders' && (
        <div className="space-y-3">
          {orders.length === 0 ? (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-12 text-center">
              <Beaker className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 mb-4">No lab orders found</p>
              <button
                onClick={handleSync}
                className="inline-flex items-center gap-2 px-4 py-2 bg-teal-500 text-slate-900 rounded-lg hover:bg-teal-400 transition-colors font-medium text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                Sync Orders
              </button>
            </div>
          ) : (
            orders.map((order) => {
              const statusBadge = getSyncBadge(order.sync_status);
              const StatusIcon = statusBadge.icon;
              const isExpanded = expandedOrder === order.id;
              const panels = Array.isArray(order.panels) ? order.panels : [];
              const orderResults = results.filter(r => r.accession_id === order.accession_id || r.accession_number === order.accession_number);
              const turnaround = getTurnaroundHours(order.processed_at_utc, orderResults[0]?.resulted_at_utc);

              return (
                <div key={order.id} className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                  <div
                    onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                    className="p-4 cursor-pointer hover:bg-slate-700/30 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-slate-400" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-slate-400" />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-3 flex-wrap">
                            <p className="text-white font-medium">
                              {order.accession_id || order.accession_number || order.stratus_guid}
                            </p>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${statusBadge.color} flex items-center gap-1`}>
                              <StatusIcon className="w-3 h-3" />
                              {statusBadge.label}
                            </span>
                            {order.order_status && order.order_status !== order.sync_status && (
                              <span className="px-2 py-1 rounded text-xs font-medium bg-slate-600/20 text-slate-300">
                                {order.order_status}
                              </span>
                            )}
                            {order.abnormal_flag && order.abnormal_flag !== 'Normal' && (
                              <span className="px-2 py-1 rounded text-xs font-medium bg-amber-500/20 text-amber-400 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                Abnormal
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-sm text-slate-400 flex-wrap">
                            <span>{format(new Date(order.created_at), 'MMM d, yyyy h:mm a')}</span>
                            {order.patient_initials && (
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {order.patient_initials}
                              </span>
                            )}
                            {order.provider_name && (
                              <span className="flex items-center gap-1">
                                <Stethoscope className="w-3 h-3" />
                                {order.provider_name}
                              </span>
                            )}
                            {order.location_name && (
                              <span className="flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                {order.location_name}
                              </span>
                            )}
                            {panels.length > 0 && (
                              <span className="flex items-center gap-1">
                                <Beaker className="w-3 h-3" />
                                {panels.length} panel{panels.length > 1 ? 's' : ''}
                              </span>
                            )}
                            {turnaround !== null && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {turnaround}h turnaround
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-slate-700 p-4 bg-slate-900/30">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <div>
                            <p className="text-xs text-slate-400 mb-1">Accession ID</p>
                            <p className="text-white text-sm font-mono">{order.accession_id || order.stratus_guid}</p>
                          </div>
                          {order.organization_name && (
                            <div>
                              <p className="text-xs text-slate-400 mb-1">Organization</p>
                              <p className="text-white text-sm">{order.organization_name}</p>
                            </div>
                          )}
                          {order.location_name && (
                            <div>
                              <p className="text-xs text-slate-400 mb-1">Location</p>
                              <p className="text-white text-sm">{order.location_name}</p>
                            </div>
                          )}
                          {order.provider_name && (
                            <div>
                              <p className="text-xs text-slate-400 mb-1">Ordering Provider</p>
                              <p className="text-white text-sm">{order.provider_name}</p>
                            </div>
                          )}
                          {order.patient_initials && (
                            <div>
                              <p className="text-xs text-slate-400 mb-1">Patient Initials</p>
                              <p className="text-white text-sm">{order.patient_initials}</p>
                            </div>
                          )}
                          {order.processed_at_utc && (
                            <div>
                              <p className="text-xs text-slate-400 mb-1">Processed At</p>
                              <p className="text-white text-sm">{format(new Date(order.processed_at_utc), 'MMM d, yyyy h:mm a')}</p>
                            </div>
                          )}
                        </div>

                        <div className="space-y-3">
                          {panels.length > 0 && (
                            <div>
                              <p className="text-xs text-slate-400 mb-2">Panels Ordered</p>
                              <div className="space-y-1">
                                {panels.map((panel, idx) => (
                                  <div key={idx} className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-300">
                                    {typeof panel === 'string' ? panel : (panel.name || panel.panelName || panel.description || JSON.stringify(panel))}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {orderResults.length > 0 && (
                            <div>
                              <p className="text-xs text-slate-400 mb-2">Results ({orderResults.length})</p>
                              <div className="space-y-1">
                                {orderResults.map((result, idx) => {
                                  const resStatus = result.result_status?.toLowerCase();
                                  const resBadge = RESULT_STATUS_COLORS[resStatus];
                                  return (
                                    <div key={idx} className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm">
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-slate-300">
                                          {result.result_value || 'Result'}
                                          {result.units && <span className="text-slate-500 ml-1">{result.units}</span>}
                                        </span>
                                        {resBadge && (
                                          <span className={`px-2 py-0.5 rounded text-xs ${resBadge.color}`}>{resBadge.label}</span>
                                        )}
                                      </div>
                                      {result.reference_range && (
                                        <p className="text-xs text-slate-500 mt-1">Ref: {result.reference_range}</p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          {order.sync_error && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                              <p className="text-xs text-red-400 mb-1">Error Message</p>
                              <p className="text-red-300 text-sm">{order.sync_error}</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {order.order_data && Object.keys(order.order_data).length > 0 && (
                        <div className="mt-4">
                          <p className="text-xs text-slate-400 mb-2">Raw Order Data</p>
                          <pre className="bg-slate-900 border border-slate-700 rounded p-3 text-xs text-slate-300 overflow-x-auto max-h-64">
                            {JSON.stringify(order.order_data, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {activeView === 'confirmations' && (
        <div className="space-y-3">
          {confirmations.length === 0 ? (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-12 text-center">
              <ClipboardCheck className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No confirmations found</p>
            </div>
          ) : (
            confirmations.map((confirmation) => {
              const statusBadge = getSyncBadge(confirmation.sync_status);
              const StatusIcon = statusBadge.icon;
              const isExpanded = expandedOrder === confirmation.id;

              return (
                <div key={confirmation.id} className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                  <div
                    onClick={() => setExpandedOrder(isExpanded ? null : confirmation.id)}
                    className="p-4 cursor-pointer hover:bg-slate-700/30 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-slate-400" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-slate-400" />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <p className="text-white font-medium">
                              {confirmation.accession_number || 'Confirmation'}
                            </p>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${statusBadge.color} flex items-center gap-1`}>
                              <StatusIcon className="w-3 h-3" />
                              {statusBadge.label}
                            </span>
                          </div>
                          <p className="text-slate-400 text-sm mt-1">
                            Received: {confirmation.received_time || format(new Date(confirmation.created_at), 'MMM d, yyyy h:mm a')}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-slate-700 p-4 bg-slate-900/30">
                      <div className="space-y-3">
                        {confirmation.hl7_message && (
                          <div>
                            <p className="text-xs text-slate-400 mb-2">HL7 Message</p>
                            <pre className="bg-slate-900 border border-slate-700 rounded p-3 text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap">
                              {confirmation.hl7_message}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {activeView === 'results' && (
        <div className="space-y-3">
          {results.length === 0 ? (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-12 text-center">
              <Activity className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No results found</p>
            </div>
          ) : (
            results.map((result) => {
              const statusBadge = getSyncBadge(result.sync_status);
              const StatusIcon = statusBadge.icon;
              const isExpanded = expandedOrder === result.id;
              const resStatus = result.result_status?.toLowerCase();
              const resBadge = RESULT_STATUS_COLORS[resStatus];
              const isAbnormal = result.abnormal_flag && result.abnormal_flag !== 'Normal';

              return (
                <div key={result.id} className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                  <div
                    onClick={() => setExpandedOrder(isExpanded ? null : result.id)}
                    className="p-4 cursor-pointer hover:bg-slate-700/30 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-slate-400" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-slate-400" />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-3 flex-wrap">
                            <p className="text-white font-medium">
                              {result.accession_id || result.accession_number || result.stratus_guid}
                            </p>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${statusBadge.color} flex items-center gap-1`}>
                              <StatusIcon className="w-3 h-3" />
                              {statusBadge.label}
                            </span>
                            {resBadge && (
                              <span className={`px-2 py-1 rounded text-xs font-medium ${resBadge.color}`}>{resBadge.label}</span>
                            )}
                            {isAbnormal && (
                              <span className="px-2 py-1 rounded text-xs font-medium bg-amber-500/20 text-amber-400 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                Abnormal
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-sm text-slate-400 flex-wrap">
                            <span>{result.result_date ? format(new Date(result.result_date), 'MMM d, yyyy h:mm a') : format(new Date(result.created_at), 'MMM d, yyyy h:mm a')}</span>
                            {result.result_value && (
                              <span className="text-slate-300">
                                {result.result_value}{result.units && <span className="text-slate-500 ml-1">{result.units}</span>}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-slate-700 p-4 bg-slate-900/30">
                      <div className="space-y-3">
                        {result.result_value && (
                          <div>
                            <p className="text-xs text-slate-400 mb-1">Result Value</p>
                            <p className="text-white text-sm">{result.result_value} {result.units && <span className="text-slate-400">{result.units}</span>}</p>
                          </div>
                        )}
                        {result.reference_range && (
                          <div>
                            <p className="text-xs text-slate-400 mb-1">Reference Range</p>
                            <p className="text-white text-sm">{result.reference_range}</p>
                          </div>
                        )}
                        {result.abnormal_flag && (
                          <div>
                            <p className="text-xs text-slate-400 mb-1">Abnormal Flag</p>
                            <p className="text-white text-sm">{result.abnormal_flag}</p>
                          </div>
                        )}
                        {result.resulted_at_utc && (
                          <div>
                            <p className="text-xs text-slate-400 mb-1">Resulted At (UTC)</p>
                            <p className="text-white text-sm">{format(new Date(result.resulted_at_utc), 'MMM d, yyyy h:mm a')}</p>
                          </div>
                        )}
                        {result.hl7_result && (
                          <div>
                            <p className="text-xs text-slate-400 mb-2">HL7 Result</p>
                            <pre className="bg-slate-900 border border-slate-700 rounded p-3 text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap">
                              {result.hl7_result}
                            </pre>
                          </div>
                        )}
                        {result.result_data && Object.keys(result.result_data).length > 0 && (
                          <div>
                            <p className="text-xs text-slate-400 mb-2">Result Data</p>
                            <pre className="bg-slate-900 border border-slate-700 rounded p-3 text-xs text-slate-300 overflow-x-auto max-h-64">
                              {JSON.stringify(result.result_data, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
