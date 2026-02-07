import React, { useState, useEffect } from 'react';
import { RefreshCw, Eye, Database, AlertCircle, CheckCircle2, Key, Download, Settings2, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function StratusAPIViewer() {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [ordersData, setOrdersData] = useState(null);
  const [confirmationsData, setConfirmationsData] = useState(null);
  const [resultsData, setResultsData] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedConfirmation, setSelectedConfirmation] = useState(null);
  const [selectedResult, setSelectedResult] = useState(null);
  const [error, setError] = useState(null);
  const [jwtDebug, setJwtDebug] = useState(null);
  const [debugLogs, setDebugLogs] = useState([]);
  const [limit, setLimit] = useState(50);
  const [showSettings, setShowSettings] = useState(false);
  const [showExplorer, setShowExplorer] = useState(false);
  const [explorerResults, setExplorerResults] = useState(null);
  const [exploring, setExploring] = useState(false);

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

  function addDebugLog(log) {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLogs(prev => [...prev, { ...log, timestamp }].slice(-20));
  }

  async function callStratusAPI(endpoint, options = {}) {
    const startTime = Date.now();
    const { useLimit = true } = options;

    addDebugLog({
      type: 'request',
      endpoint,
      message: `Starting request to ${endpoint}`,
    });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const error = 'Not authenticated - no session found';
        addDebugLog({
          type: 'error',
          endpoint,
          message: error,
        });
        throw new Error(error);
      }

      addDebugLog({
        type: 'info',
        endpoint,
        message: `Session valid, user: ${session.user.email}`,
      });

      let proxyUrl = `/.netlify/functions/stratus-api-proxy?endpoint=${encodeURIComponent(endpoint)}`;
      if (useLimit && limit) {
        proxyUrl += `&limit=${limit}`;
      }

      addDebugLog({
        type: 'info',
        endpoint,
        message: `Proxy URL: ${proxyUrl}`,
      });

      addDebugLog({
        type: 'info',
        endpoint,
        message: `Using Netlify function proxy (limit: ${useLimit ? limit : 'none'})`,
      });

      const response = await fetch(proxyUrl, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const duration = Date.now() - startTime;

      addDebugLog({
        type: 'info',
        endpoint,
        message: `Response received: ${response.status} ${response.statusText} (${duration}ms)`,
        details: {
          status: response.status,
          statusText: response.statusText,
          contentType: response.headers.get('content-type'),
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        addDebugLog({
          type: 'error',
          endpoint,
          message: `Request failed: ${response.status} ${response.statusText}`,
          details: errorText,
        });
        throw new Error(`${response.status}: ${errorText || response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      let data;

      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
        addDebugLog({
          type: 'success',
          endpoint,
          message: `JSON response parsed successfully`,
          details: typeof data === 'object' ? JSON.stringify(data).substring(0, 200) + '...' : data,
        });
      } else {
        data = await response.text();
        addDebugLog({
          type: 'success',
          endpoint,
          message: `Text response received (${data.length} characters)`,
          details: data.substring(0, 200) + '...',
        });
      }

      return data;
    } catch (error) {
      addDebugLog({
        type: 'error',
        endpoint,
        message: `Exception: ${error.message}`,
        details: error.stack,
      });
      throw error;
    }
  }

  async function fetchOrders() {
    setLoading(true);
    setError(null);
    try {
      console.group('%c Fetching Orders', 'color: #14b8a6; font-weight: bold;');
      console.log('Endpoint: /orders');
      console.log('Limit: ', limit);
      console.log('Target: https://novagen.stratusdx.net/interface/orders');
      const data = await callStratusAPI('/orders');
      console.log('Orders response:', data);
      if (data.total_count && data.result_count) {
        console.log(`Pagination: ${data.result_count} of ${data.total_count} total records`);
      }
      console.groupEnd();
      setOrdersData(data);
    } catch (err) {
      console.group('%c Orders Error', 'color: #ef4444; font-weight: bold;');
      console.error('Error message:', err.message);
      console.error('Full error:', err);
      console.groupEnd();
      setError(`Orders: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function fetchConfirmations() {
    setLoading(true);
    setError(null);
    try {
      console.group('%c✅ Fetching Confirmations', 'color: #3b82f6; font-weight: bold;');
      console.log('Endpoint: /order/received');
      const data = await callStratusAPI('/order/received');
      console.log('✅ Confirmations response:', data);
      console.groupEnd();
      setConfirmationsData(data);
    } catch (err) {
      console.group('%c❌ Confirmations Error', 'color: #ef4444; font-weight: bold;');
      console.error('Error message:', err.message);
      console.error('Full error:', err);
      console.groupEnd();
      setError(`Confirmations: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function fetchResults() {
    setLoading(true);
    setError(null);
    try {
      console.group('%c🧪 Fetching Results', 'color: #10b981; font-weight: bold;');
      console.log('Endpoint: /results');
      const data = await callStratusAPI('/results');
      console.log('✅ Results response:', data);
      console.groupEnd();
      setResultsData(data);
    } catch (err) {
      console.group('%c❌ Results Error', 'color: #ef4444; font-weight: bold;');
      console.error('Error message:', err.message);
      console.error('Full error:', err);
      console.groupEnd();
      setError(`Results: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function fetchOrderDetail(guid) {
    setLoading(true);
    setError(null);
    try {
      console.group('%c Fetching Order Detail', 'color: #14b8a6; font-weight: bold;');
      console.log('GUID:', guid);
      const data = await callStratusAPI(`/order/${guid}`, { useLimit: false });
      console.log('Order detail:', data);
      console.groupEnd();
      setSelectedOrder(data);
    } catch (err) {
      console.group('%c Order Detail Error', 'color: #ef4444; font-weight: bold;');
      console.error('Error message:', err.message);
      console.error('Full error:', err);
      console.groupEnd();
      setError(`Order Detail: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function fetchConfirmationDetail(guid) {
    setLoading(true);
    setError(null);
    try {
      console.group('%c Fetching Confirmation Detail', 'color: #3b82f6; font-weight: bold;');
      console.log('GUID:', guid);
      const data = await callStratusAPI(`/order/received/${guid}`, { useLimit: false });
      console.log('Confirmation detail:', data);
      console.groupEnd();
      setSelectedConfirmation(data);
    } catch (err) {
      console.group('%c Confirmation Detail Error', 'color: #ef4444; font-weight: bold;');
      console.error('Error message:', err.message);
      console.error('Full error:', err);
      console.groupEnd();
      setError(`Confirmation Detail: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function fetchResultDetail(guid) {
    setLoading(true);
    setError(null);
    try {
      console.group('%c Fetching Result Detail', 'color: #10b981; font-weight: bold;');
      console.log('GUID:', guid);
      const data = await callStratusAPI(`/result/${guid}`, { useLimit: false });
      console.log('Result detail:', data);
      console.groupEnd();
      setSelectedResult(data);
    } catch (err) {
      console.group('%c Result Detail Error', 'color: #ef4444; font-weight: bold;');
      console.error('Error message:', err.message);
      console.error('Full error:', err);
      console.groupEnd();
      setError(`Result Detail: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function exploreAPIEndpoint(endpoint) {
    setExploring(true);
    setError(null);
    setExplorerResults(null);

    const testConfigs = [
      { name: 'Base Request', params: {} },
      { name: 'Pagination: limit', params: { limit: 100 } },
      { name: 'Pagination: limit', params: { limit: 50 } },
      { name: 'Pagination: per_page', params: { per_page: 100 } },
      { name: 'Pagination: count', params: { count: 100 } },
      { name: 'Pagination: max', params: { max: 100 } },
      { name: 'Pagination: page_size', params: { page_size: 100 } },
      { name: 'Pagination: offset&limit', params: { offset: 0, limit: 100 } },
      { name: 'Pagination: page&per_page', params: { page: 1, per_page: 100 } },
      { name: 'Pagination: start&end', params: { start: 0, end: 100 } },
    ];

    const results = [];

    for (const config of testConfigs) {
      try {
        addDebugLog({
          type: 'info',
          endpoint: 'explorer',
          message: `Testing ${config.name}...`,
        });

        const queryParams = new URLSearchParams();
        queryParams.append('endpoint', endpoint);

        Object.entries(config.params).forEach(([key, value]) => {
          queryParams.append(key, value);
        });

        const url = `/.netlify/functions/stratus-api-proxy?${queryParams.toString()}`;

        const response = await fetch(url);

        if (response.ok) {
          const data = await response.json();
          results.push({
            test: config.name,
            params: config.params,
            success: true,
            result_count: data.result_count,
            total_count: data.total_count,
            url: url,
          });

          addDebugLog({
            type: 'success',
            endpoint: 'explorer',
            message: `${config.name} succeeded: ${data.result_count} results`,
          });
        } else {
          const errorText = await response.text();
          results.push({
            test: config.name,
            params: config.params,
            success: false,
            error: `${response.status}: ${errorText}`,
            url: url,
          });

          addDebugLog({
            type: 'error',
            endpoint: 'explorer',
            message: `${config.name} failed: ${response.status}`,
          });
        }
      } catch (err) {
        results.push({
          test: config.name,
          params: config.params,
          success: false,
          error: err.message,
        });

        addDebugLog({
          type: 'error',
          endpoint: 'explorer',
          message: `${config.name} exception: ${err.message}`,
        });
      }
    }

    const recommendations = [];
    const successfulTests = results.filter(r => r.success);

    if (successfulTests.length === 0) {
      recommendations.push('No pagination parameters worked - API likely uses queue-based system (ACK required)');
    } else {
      const varyingResults = successfulTests.filter(r =>
        r.result_count !== successfulTests[0].result_count
      );
      if (varyingResults.length > 0) {
        recommendations.push('Found working pagination parameters with varying results');
      }
    }

    setExplorerResults({
      total_tests: results.length,
      successful: successfulTests.length,
      failed: results.length - successfulTests.length,
      results,
      recommendations,
    });

    addDebugLog({
      type: 'success',
      endpoint: 'explorer',
      message: `Exploration complete: ${results.length} tests, ${successfulTests.length} successful`,
    });

    setExploring(false);
  }

  async function syncOrdersToDatabase() {
    setSyncing(true);
    setError(null);
    try {
      if (!ordersData?.results?.length) {
        throw new Error('No orders to sync. Fetch orders first.');
      }

      addDebugLog({
        type: 'request',
        endpoint: 'sync',
        message: `Starting sync of ${ordersData.results.length} orders to database`,
      });

      const processedOrders = [];
      const errors = [];

      for (const guid of ordersData.results) {
        try {
          const { data: existing } = await supabase
            .from('lab_orders')
            .select('id, sync_status')
            .eq('stratus_guid', guid)
            .maybeSingle();

          if (existing && existing.sync_status === 'acknowledged') {
            addDebugLog({
              type: 'info',
              endpoint: 'sync',
              message: `Order ${guid} already exists, skipping`,
            });
            continue;
          }

          addDebugLog({
            type: 'info',
            endpoint: 'sync',
            message: `Fetching details for ${guid}...`,
          });

          const orderData = await callStratusAPI(`/order/${guid}`, { useLimit: false });

          if (existing) {
            await supabase
              .from('lab_orders')
              .update({
                order_data: orderData,
                sync_status: 'retrieved',
                retrieved_at: new Date().toISOString(),
              })
              .eq('id', existing.id);
          } else {
            await supabase
              .from('lab_orders')
              .insert({
                stratus_guid: guid,
                order_data: orderData,
                sync_status: 'retrieved',
                retrieved_at: new Date().toISOString(),
              });
          }

          processedOrders.push(guid);
          addDebugLog({
            type: 'success',
            endpoint: 'sync',
            message: `Synced order ${guid}`,
          });
        } catch (err) {
          errors.push({ guid, error: err.message });
          addDebugLog({
            type: 'error',
            endpoint: 'sync',
            message: `Failed to sync ${guid}: ${err.message}`,
          });
        }
      }

      addDebugLog({
        type: 'success',
        endpoint: 'sync',
        message: `Sync complete: ${processedOrders.length} synced, ${errors.length} errors`,
      });

    } catch (err) {
      setError(`Sync failed: ${err.message}`);
    } finally {
      setSyncing(false);
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
        <p className="text-blue-400 text-sm mb-2">
          <strong>Data Flow:</strong> Orders are submitted to StratusDX. Confirmations indicate the order was received.
          Results contain the final test data. Use accession numbers to link confirmations and results back to orders.
        </p>
        <p className="text-blue-300 text-xs">
          <strong>Connection:</strong> Using Netlify function proxy for secure API access with automatic retry handling.
        </p>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
        >
          <Settings2 className="w-4 h-4" />
          Settings
        </button>

        <button
          onClick={() => setShowExplorer(!showExplorer)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
        >
          <Search className="w-4 h-4" />
          API Explorer
        </button>

        {ordersData?.results?.length > 0 && (
          <button
            onClick={syncOrdersToDatabase}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <Download className={`w-4 h-4 ${syncing ? 'animate-bounce' : ''}`} />
            {syncing ? 'Syncing...' : `Sync ${ordersData.results.length} Orders to Database`}
          </button>
        )}
      </div>

      {showSettings && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <h4 className="text-white font-medium mb-4">API Settings</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Records Limit</label>
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-teal-500 focus:outline-none"
              >
                <option value={5}>5 records</option>
                <option value={10}>10 records</option>
                <option value={25}>25 records</option>
                <option value={50}>50 records</option>
                <option value={100}>100 records</option>
                <option value={250}>250 records</option>
                <option value={500}>500 records</option>
              </select>
              <p className="text-xs text-slate-500 mt-1">
                Number of records to fetch per request
              </p>
            </div>
          </div>
        </div>
      )}

      {showExplorer && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <h4 className="text-white font-medium mb-4">API Explorer</h4>
          <p className="text-slate-400 text-sm mb-4">
            Test the API endpoints with various pagination parameters to discover what works. All tests use the Netlify proxy.
          </p>

          <div className="flex gap-2 mb-4 flex-wrap">
            <button
              onClick={() => exploreAPIEndpoint('/orders')}
              disabled={exploring}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg transition-colors disabled:opacity-50 text-sm"
            >
              Explore /orders
            </button>
            <button
              onClick={() => exploreAPIEndpoint('/order/received')}
              disabled={exploring}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50 text-sm"
            >
              Explore /confirmations
            </button>
            <button
              onClick={() => exploreAPIEndpoint('/results')}
              disabled={exploring}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors disabled:opacity-50 text-sm"
            >
              Explore /results
            </button>
          </div>

          {exploring && (
            <div className="flex items-center gap-2 text-blue-400 text-sm">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Running exploration tests...
            </div>
          )}

          {explorerResults && (
            <div className="space-y-4 mt-4">
              <div className="bg-slate-900/50 border border-slate-600 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h5 className="text-white font-medium">Exploration Results</h5>
                  <div className="flex gap-3 text-sm">
                    <span className="text-green-400">{explorerResults.successful} passed</span>
                    <span className="text-red-400">{explorerResults.failed} failed</span>
                  </div>
                </div>

                {explorerResults.recommendations && explorerResults.recommendations.length > 0 && (
                  <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                    <p className="text-blue-400 font-medium text-sm mb-2">Recommendations:</p>
                    <ul className="text-sm text-blue-300 space-y-1">
                      {explorerResults.recommendations.map((rec, idx) => (
                        <li key={idx} className="flex gap-2">
                          <span>•</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {explorerResults.results?.map((result, idx) => (
                    <div key={idx} className="bg-slate-800/50 border border-slate-600 rounded p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-white">{result.test}</span>
                        {result.success ? (
                          <CheckCircle2 className="w-4 h-4 text-green-400" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-400" />
                        )}
                      </div>

                      {Object.keys(result.params).length > 0 && (
                        <div className="text-xs text-slate-400 mb-1">
                          Params: {JSON.stringify(result.params)}
                        </div>
                      )}

                      {result.result_count !== undefined && (
                        <div className="text-xs text-teal-400">
                          Result Count: {result.result_count}
                        </div>
                      )}

                      {result.total_count !== undefined && (
                        <div className="text-xs text-blue-400">
                          Total Count: {result.total_count}
                        </div>
                      )}

                      {result.error && (
                        <div className="text-xs text-red-400 mt-1">
                          Error: {result.error}
                        </div>
                      )}

                      {result.url && (
                        <details className="mt-2">
                          <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-400">
                            Show URL
                          </summary>
                          <code className="text-xs text-slate-400 block mt-1 break-all">
                            {result.url}
                          </code>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

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
          <div className="flex-1">
            <p className="text-red-400 font-medium">Error</p>
            <p className="text-red-300 text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      {debugLogs.length > 0 && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
          <details className="group">
            <summary className="px-4 py-3 cursor-pointer hover:bg-slate-700/30 transition-colors flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-yellow-400" />
                <h4 className="text-white font-medium">API Debug Logs ({debugLogs.length})</h4>
              </div>
              <span className="text-slate-400 text-sm group-open:rotate-180 transition-transform">▼</span>
            </summary>
            <div className="p-4 bg-slate-900/50 max-h-96 overflow-y-auto">
              <div className="space-y-2">
                {debugLogs.map((log, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border ${
                      log.type === 'error'
                        ? 'bg-red-500/5 border-red-500/30'
                        : log.type === 'success'
                        ? 'bg-green-500/5 border-green-500/30'
                        : log.type === 'request'
                        ? 'bg-blue-500/5 border-blue-500/30'
                        : 'bg-slate-700/30 border-slate-600/30'
                    }`}
                  >
                    <div className="flex items-start gap-2 mb-1">
                      <span className="text-xs text-slate-400 font-mono">{log.timestamp}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          log.type === 'error'
                            ? 'bg-red-500/20 text-red-300'
                            : log.type === 'success'
                            ? 'bg-green-500/20 text-green-300'
                            : log.type === 'request'
                            ? 'bg-blue-500/20 text-blue-300'
                            : 'bg-slate-500/20 text-slate-300'
                        }`}
                      >
                        {log.type.toUpperCase()}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">{log.endpoint}</span>
                    </div>
                    <p className="text-sm text-slate-300 mb-2">{log.message}</p>
                    {log.details && (
                      <details className="mt-2">
                        <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-300">
                          View Details
                        </summary>
                        <pre className="mt-2 bg-slate-900 rounded p-2 text-xs text-slate-300 overflow-auto">
                          {typeof log.details === 'string' ? log.details : JSON.stringify(log.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={() => setDebugLogs([])}
                className="mt-4 w-full px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
              >
                Clear Logs
              </button>
            </div>
          </details>
        </div>
      )}

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
        <h4 className="text-white font-medium mb-3">Environment Check</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-slate-400">Supabase URL:</span>
            <p className="text-slate-300 font-mono text-xs mt-1">
              {import.meta.env.VITE_SUPABASE_URL ?
                import.meta.env.VITE_SUPABASE_URL.substring(0, 30) + '...' :
                <span className="text-red-400">Not configured</span>
              }
            </p>
          </div>
          <div>
            <span className="text-slate-400">Anon Key:</span>
            <p className="text-slate-300 font-mono text-xs mt-1">
              {import.meta.env.VITE_SUPABASE_ANON_KEY ?
                import.meta.env.VITE_SUPABASE_ANON_KEY.substring(0, 20) + '...' :
                <span className="text-red-400">Not configured</span>
              }
            </p>
          </div>
          <div>
            <span className="text-slate-400">Function Endpoint:</span>
            <p className="text-slate-300 font-mono text-xs mt-1 break-all">
              /.netlify/functions/stratus-api-proxy
            </p>
          </div>
          <div>
            <span className="text-slate-400">Auth Status:</span>
            <p className="text-slate-300 text-xs mt-1">
              {jwtDebug?.hasToken ? (
                jwtDebug.isExpired ?
                  <span className="text-red-400">Token Expired</span> :
                  <span className="text-green-400">Authenticated</span>
              ) : (
                <span className="text-red-400">Not Authenticated</span>
              )}
            </p>
          </div>
        </div>
      </div>

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
                <div className="text-xs mt-1">
                  <p className="text-teal-400 font-medium">
                    {ordersData.result_count} returned
                  </p>
                  {ordersData.total_count && ordersData.total_count > ordersData.result_count && (
                    <p className="text-amber-400">
                      {ordersData.total_count} total available
                    </p>
                  )}
                </div>
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
                <div className="text-xs mt-1">
                  <p className="text-blue-400 font-medium">
                    {confirmationsData.result_count} returned
                  </p>
                  {confirmationsData.total_count && confirmationsData.total_count > confirmationsData.result_count && (
                    <p className="text-amber-400">
                      {confirmationsData.total_count} total available
                    </p>
                  )}
                </div>
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
                <div className="text-xs mt-1">
                  <p className="text-green-400 font-medium">
                    {resultsData.result_count} returned
                  </p>
                  {resultsData.total_count && resultsData.total_count > resultsData.result_count && (
                    <p className="text-amber-400">
                      {resultsData.total_count} total available
                    </p>
                  )}
                </div>
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
