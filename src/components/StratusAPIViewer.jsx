import React, { useState, useEffect } from 'react';
import { RefreshCw, Eye, Database, AlertCircle, CheckCircle2, Key } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function StratusAPIViewer() {
  const [loading, setLoading] = useState(false);
  const [ordersData, setOrdersData] = useState(null);
  const [confirmationsData, setConfirmationsData] = useState(null);
  const [resultsData, setResultsData] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedConfirmation, setSelectedConfirmation] = useState(null);
  const [selectedResult, setSelectedResult] = useState(null);
  const [error, setError] = useState(null);
  const [jwtDebug, setJwtDebug] = useState(null);

  useEffect(() => {
    async function debugJWT() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        try {
          const parts = session.access_token.split('.');
          const payload = JSON.parse(atob(parts[1]));
          setJwtDebug({
            hasToken: true,
            expiresAt: new Date(payload.exp * 1000).toISOString(),
            isExpired: Date.now() > payload.exp * 1000,
            userId: payload.sub,
            email: payload.email,
            payload
          });
        } catch (e) {
          setJwtDebug({ error: 'Failed to decode JWT', details: e.message });
        }
      } else {
        setJwtDebug({ hasToken: false });
      }
    }
    debugJWT();
  }, []);

  async function callStratusAPI(endpoint) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Not authenticated');
    }

    const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stratus-api-proxy?endpoint=${encodeURIComponent(endpoint)}`;
    const response = await fetch(proxyUrl, {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || response.statusText);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }
    return await response.text();
  }

  async function fetchOrders() {
    setLoading(true);
    setError(null);
    try {
      console.log('Fetching orders from StratusDX...');
      const data = await callStratusAPI('/orders');
      console.log('Orders response:', data);
      setOrdersData(data);
    } catch (err) {
      setError(`Orders: ${err.message}`);
      console.error('Orders error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchConfirmations() {
    setLoading(true);
    setError(null);
    try {
      const data = await callStratusAPI('/order/received');
      setConfirmationsData(data);
    } catch (err) {
      setError(`Confirmations: ${err.message}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchResults() {
    setLoading(true);
    setError(null);
    try {
      const data = await callStratusAPI('/results');
      setResultsData(data);
    } catch (err) {
      setError(`Results: ${err.message}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchOrderDetail(guid) {
    setLoading(true);
    setError(null);
    try {
      const data = await callStratusAPI(`/order/${guid}`);
      setSelectedOrder(data);
    } catch (err) {
      setError(`Order Detail: ${err.message}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchConfirmationDetail(guid) {
    setLoading(true);
    setError(null);
    try {
      const data = await callStratusAPI(`/order/received/${guid}`);
      setSelectedConfirmation(data);
    } catch (err) {
      setError(`Confirmation Detail: ${err.message}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchResultDetail(guid) {
    setLoading(true);
    setError(null);
    try {
      const data = await callStratusAPI(`/result/${guid}`);
      setSelectedResult(data);
    } catch (err) {
      setError(`Result Detail: ${err.message}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-white mb-2">StratusDX API Viewer</h3>
        <p className="text-slate-400 text-sm">
          View live data from the StratusDX API to help configure facility mappings
        </p>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <p className="text-blue-400 text-sm">
          <strong>Data Flow:</strong> Orders are submitted to StratusDX. Confirmations indicate the order was received.
          Results contain the final test data. Use accession numbers to link confirmations and results back to orders.
        </p>
      </div>

      {jwtDebug && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Key className="w-4 h-4 text-teal-400" />
            <h4 className="text-white font-medium">JWT Debug Info</h4>
          </div>
          {jwtDebug.hasToken ? (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">Status:</span>
                {jwtDebug.isExpired ? (
                  <span className="text-red-400">Expired</span>
                ) : (
                  <span className="text-green-400">Valid</span>
                )}
              </div>
              <div>
                <span className="text-slate-400">User ID:</span>
                <span className="text-slate-300 ml-2 font-mono text-xs">{jwtDebug.userId}</span>
              </div>
              <div>
                <span className="text-slate-400">Email:</span>
                <span className="text-slate-300 ml-2">{jwtDebug.email}</span>
              </div>
              <div>
                <span className="text-slate-400">Expires:</span>
                <span className="text-slate-300 ml-2">{jwtDebug.expiresAt}</span>
              </div>
              <details className="mt-3">
                <summary className="text-slate-400 cursor-pointer hover:text-slate-300">
                  View Full Payload
                </summary>
                <pre className="mt-2 bg-slate-900 rounded p-3 text-xs text-slate-300 overflow-auto max-h-48">
                  {JSON.stringify(jwtDebug.payload, null, 2)}
                </pre>
              </details>
            </div>
          ) : (
            <p className="text-red-400 text-sm">No JWT token found</p>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-400 font-medium">Error</p>
            <p className="text-red-300 text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={fetchOrders}
          disabled={loading}
          className="flex items-center justify-between p-4 bg-slate-800 border border-slate-700 rounded-lg hover:border-teal-500 transition-colors disabled:opacity-50"
        >
          <div className="flex items-center gap-3">
            <Database className="w-5 h-5 text-teal-400" />
            <div className="text-left">
              <p className="text-white font-medium">Orders</p>
              <p className="text-slate-400 text-xs">GET /interface/orders</p>
              {ordersData && (
                <p className="text-slate-400 text-sm mt-1">{ordersData.result_count} pending</p>
              )}
            </div>
          </div>
          <RefreshCw className={`w-5 h-5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
        </button>

        <button
          onClick={fetchConfirmations}
          disabled={loading}
          className="flex items-center justify-between p-4 bg-slate-800 border border-slate-700 rounded-lg hover:border-teal-500 transition-colors disabled:opacity-50"
        >
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-blue-400" />
            <div className="text-left">
              <p className="text-white font-medium">Confirmations</p>
              <p className="text-slate-400 text-xs">GET /interface/order/received</p>
              {confirmationsData && (
                <p className="text-slate-400 text-sm mt-1">{confirmationsData.result_count} pending</p>
              )}
            </div>
          </div>
          <RefreshCw className={`w-5 h-5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
        </button>

        <button
          onClick={fetchResults}
          disabled={loading}
          className="flex items-center justify-between p-4 bg-slate-800 border border-slate-700 rounded-lg hover:border-teal-500 transition-colors disabled:opacity-50"
        >
          <div className="flex items-center gap-3">
            <Database className="w-5 h-5 text-green-400" />
            <div className="text-left">
              <p className="text-white font-medium">Results</p>
              <p className="text-slate-400 text-xs">GET /interface/results</p>
              {resultsData && (
                <p className="text-slate-400 text-sm mt-1">{resultsData.result_count} pending</p>
              )}
            </div>
          </div>
          <RefreshCw className={`w-5 h-5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {ordersData && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700 bg-slate-900/50">
              <h4 className="text-white font-semibold">Orders ({ordersData.result_count})</h4>
            </div>
            <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
              {ordersData.results && ordersData.results.length > 0 ? (
                ordersData.results.map((guid, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg hover:bg-slate-700/50 transition-colors"
                  >
                    <span className="text-slate-300 text-sm font-mono">{guid}</span>
                    <button
                      onClick={() => fetchOrderDetail(guid)}
                      className="p-2 text-teal-400 hover:bg-teal-500/10 rounded-lg transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-slate-400 text-center py-8">No pending orders</p>
              )}
            </div>
          </div>
        )}

        {confirmationsData && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700 bg-slate-900/50">
              <h4 className="text-white font-semibold">Confirmations ({confirmationsData.result_count})</h4>
            </div>
            <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
              {confirmationsData.results && confirmationsData.results.length > 0 ? (
                confirmationsData.results.map((guid, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg hover:bg-slate-700/50 transition-colors"
                  >
                    <span className="text-slate-300 text-sm font-mono">{guid}</span>
                    <button
                      onClick={() => fetchConfirmationDetail(guid)}
                      className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-slate-400 text-center py-8">No pending confirmations</p>
              )}
            </div>
          </div>
        )}

        {resultsData && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700 bg-slate-900/50">
              <h4 className="text-white font-semibold">Results ({resultsData.result_count})</h4>
            </div>
            <div className="p-4 space-y-2 max-h-96 overflow-y-auto">
              {resultsData.results && resultsData.results.length > 0 ? (
                resultsData.results.map((guid, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg hover:bg-slate-700/50 transition-colors"
                  >
                    <span className="text-slate-300 text-sm font-mono">{guid}</span>
                    <button
                      onClick={() => fetchResultDetail(guid)}
                      className="p-2 text-green-400 hover:bg-green-500/10 rounded-lg transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-slate-400 text-center py-8">No pending results</p>
              )}
            </div>
          </div>
        )}
      </div>

      {selectedOrder && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700 bg-slate-900/50 flex items-center justify-between">
            <h4 className="text-white font-semibold">Order Detail</h4>
            <button
              onClick={() => setSelectedOrder(null)}
              className="text-slate-400 hover:text-white text-sm"
            >
              Close
            </button>
          </div>
          <div className="p-4">
            <pre className="bg-slate-900 rounded-lg p-4 overflow-auto text-sm text-slate-300 max-h-96">
              {JSON.stringify(selectedOrder, null, 2)}
            </pre>
            {(selectedOrder.facility_name || selectedOrder.facility_id || selectedOrder.accession_number) && (
              <div className="mt-4 p-4 bg-teal-500/10 border border-teal-500/30 rounded-lg">
                <p className="text-teal-400 font-medium mb-2">Key Identifiers:</p>
                {selectedOrder.accession_number && (
                  <p className="text-slate-300 text-sm">
                    <span className="text-slate-400">Accession Number:</span> {selectedOrder.accession_number}
                  </p>
                )}
                {selectedOrder.facility_name && (
                  <p className="text-slate-300 text-sm">
                    <span className="text-slate-400">Facility Name:</span> {selectedOrder.facility_name}
                  </p>
                )}
                {selectedOrder.facility_id && (
                  <p className="text-slate-300 text-sm">
                    <span className="text-slate-400">Facility ID:</span> {selectedOrder.facility_id}
                  </p>
                )}
                {selectedOrder.organization_name && (
                  <p className="text-slate-300 text-sm">
                    <span className="text-slate-400">Organization Name:</span> {selectedOrder.organization_name}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {selectedConfirmation && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700 bg-slate-900/50 flex items-center justify-between">
            <h4 className="text-white font-semibold">Confirmation Detail</h4>
            <button
              onClick={() => setSelectedConfirmation(null)}
              className="text-slate-400 hover:text-white text-sm"
            >
              Close
            </button>
          </div>
          <div className="p-4">
            <pre className="bg-slate-900 rounded-lg p-4 overflow-auto text-sm text-slate-300 max-h-96 whitespace-pre-wrap">
              {selectedConfirmation}
            </pre>
          </div>
        </div>
      )}

      {selectedResult && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700 bg-slate-900/50 flex items-center justify-between">
            <h4 className="text-white font-semibold">Result Detail</h4>
            <button
              onClick={() => setSelectedResult(null)}
              className="text-slate-400 hover:text-white text-sm"
            >
              Close
            </button>
          </div>
          <div className="p-4">
            <pre className="bg-slate-900 rounded-lg p-4 overflow-auto text-sm text-slate-300 max-h-96 whitespace-pre-wrap">
              {selectedResult}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
