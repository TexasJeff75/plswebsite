import React, { useState, useEffect } from 'react';
import { labOrdersService } from '../../services/labOrdersService';
import {
  FlaskConical, RefreshCw, CheckCircle2, XCircle, Clock,
  AlertTriangle, FileText, Download, ChevronDown, ChevronRight,
  Beaker, ClipboardCheck, Activity
} from 'lucide-react';
import { format } from 'date-fns';

export default function LabOrdersTab({ facility }) {
  const [activeView, setActiveView] = useState('orders');
  const [orders, setOrders] = useState([]);
  const [confirmations, setConfirmations] = useState([]);
  const [results, setResults] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState(null);

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
      const syncResult = await labOrdersService.syncAll();
      console.log('Sync completed:', syncResult);
      await loadData();
    } catch (error) {
      console.error('Error syncing:', error);
      alert('Failed to sync data: ' + error.message);
    } finally {
      setSyncing(false);
    }
  }

  const getSyncStatusBadge = (status) => {
    const badges = {
      pending: { label: 'Pending', color: 'bg-slate-500/20 text-slate-400', icon: Clock },
      retrieved: { label: 'Retrieved', color: 'bg-blue-500/20 text-blue-400', icon: Download },
      acknowledged: { label: 'Acknowledged', color: 'bg-green-500/20 text-green-400', icon: CheckCircle2 },
      error: { label: 'Error', color: 'bg-red-500/20 text-red-400', icon: XCircle }
    };
    return badges[status] || badges.pending;
  };

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

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
              <span className="text-xs text-slate-400">Acknowledged</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.acknowledged}</p>
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
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="text-xs text-slate-400">Errors</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.errors}</p>
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
              const statusBadge = getSyncStatusBadge(order.sync_status);
              const StatusIcon = statusBadge.icon;
              const isExpanded = expandedOrder === order.id;

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
                          <div className="flex items-center gap-3">
                            <p className="text-white font-medium">
                              {order.accession_number || order.stratus_guid}
                            </p>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${statusBadge.color} flex items-center gap-1`}>
                              <StatusIcon className="w-3 h-3" />
                              {statusBadge.label}
                            </span>
                          </div>
                          <p className="text-slate-400 text-sm mt-1">
                            {format(new Date(order.created_at), 'MMM d, yyyy h:mm a')}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-slate-700 p-4 bg-slate-900/30">
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs text-slate-400 mb-1">StratusDX GUID</p>
                          <p className="text-white text-sm font-mono">{order.stratus_guid}</p>
                        </div>
                        {order.accession_number && (
                          <div>
                            <p className="text-xs text-slate-400 mb-1">Accession Number</p>
                            <p className="text-white text-sm">{order.accession_number}</p>
                          </div>
                        )}
                        {order.retrieved_at && (
                          <div>
                            <p className="text-xs text-slate-400 mb-1">Retrieved At</p>
                            <p className="text-white text-sm">{format(new Date(order.retrieved_at), 'MMM d, yyyy h:mm a')}</p>
                          </div>
                        )}
                        {order.acknowledged_at && (
                          <div>
                            <p className="text-xs text-slate-400 mb-1">Acknowledged At</p>
                            <p className="text-white text-sm">{format(new Date(order.acknowledged_at), 'MMM d, yyyy h:mm a')}</p>
                          </div>
                        )}
                        {order.sync_error && (
                          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                            <p className="text-xs text-red-400 mb-1">Error Message</p>
                            <p className="text-red-300 text-sm">{order.sync_error}</p>
                          </div>
                        )}
                        {order.order_data && Object.keys(order.order_data).length > 0 && (
                          <div>
                            <p className="text-xs text-slate-400 mb-2">Order Data</p>
                            <pre className="bg-slate-900 border border-slate-700 rounded p-3 text-xs text-slate-300 overflow-x-auto">
                              {JSON.stringify(order.order_data, null, 2)}
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

      {activeView === 'confirmations' && (
        <div className="space-y-3">
          {confirmations.length === 0 ? (
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-12 text-center">
              <ClipboardCheck className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No confirmations found</p>
            </div>
          ) : (
            confirmations.map((confirmation) => {
              const statusBadge = getSyncStatusBadge(confirmation.sync_status);
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
              const statusBadge = getSyncStatusBadge(result.sync_status);
              const StatusIcon = statusBadge.icon;
              const isExpanded = expandedOrder === result.id;

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
                          <div className="flex items-center gap-3">
                            <p className="text-white font-medium">
                              {result.accession_number || result.stratus_guid}
                            </p>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${statusBadge.color} flex items-center gap-1`}>
                              <StatusIcon className="w-3 h-3" />
                              {statusBadge.label}
                            </span>
                          </div>
                          <p className="text-slate-400 text-sm mt-1">
                            {result.result_date ? format(new Date(result.result_date), 'MMM d, yyyy h:mm a') : format(new Date(result.created_at), 'MMM d, yyyy h:mm a')}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-slate-700 p-4 bg-slate-900/30">
                      <div className="space-y-3">
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
                            <pre className="bg-slate-900 border border-slate-700 rounded p-3 text-xs text-slate-300 overflow-x-auto">
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
