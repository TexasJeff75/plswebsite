import React, { useCallback, useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { AlertCircle, Landmark, Loader2, Lock, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { payablesService } from '../services/payablesService';
import SpendDashboard from './payables/SpendDashboard';

const SYNC_LABELS = {
  succeeded: 'Up to date',
  partial: 'Partly synced',
  failed: 'Last sync failed',
  running: 'Syncing',
};

export default function Payables() {
  const { profile } = useAuth();
  const [options, setOptions] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(null);
  const [syncError, setSyncError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const isAllowed = profile?.role === 'Super Admin';

  const loadOptions = useCallback(async () => {
    try {
      setLoadError('');
      setOptions(await payablesService.getFilterOptions());
    } catch (err) {
      setLoadError(err.message);
    }
  }, []);

  useEffect(() => {
    if (isAllowed) loadOptions();
  }, [isAllowed, loadOptions]);

  async function handleSync() {
    setSyncing(true);
    setSyncError('');
    setSyncProgress(null);
    try {
      await payablesService.runSync(setSyncProgress);
    } catch (err) {
      setSyncError(err.message);
    } finally {
      setSyncing(false);
      await loadOptions();
      setRefreshKey((k) => k + 1);
    }
  }

  if (!isAllowed) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-slate-700/50 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-slate-500" />
          </div>
          <h2 className="text-white font-semibold text-xl mb-2">Access Restricted</h2>
          <p className="text-slate-400 text-sm">Payables data is restricted to Super Admin.</p>
        </div>
      </div>
    );
  }

  const lastSync = options?.last_sync;
  const lastSuccess = options?.last_success;
  const hasData = (options?.vendors?.length || 0) > 0;
  const syncedRecords = syncProgress ? Object.values(syncProgress.totals).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center flex-shrink-0">
            <Landmark className="w-5 h-5 text-teal-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Payables</h1>
            <p className="text-slate-400 text-sm">Accounts payable from BILL · read-only</p>
          </div>
        </div>
        <div className="flex flex-col items-start gap-1 md:items-end">
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-teal-400 disabled:opacity-60"
          >
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {syncing ? 'Syncing from BILL…' : 'Sync now'}
          </button>
          <p className="text-xs text-slate-400">
            {syncing && syncProgress
              ? `${syncedRecords.toLocaleString()} records copied${syncProgress.more ? ', continuing…' : ''}`
              : lastSuccess
                ? `Last synced ${formatDistanceToNow(new Date(lastSuccess), { addSuffix: true })}`
                : 'Not synced yet'}
            {!syncing && lastSync && lastSync.status !== 'succeeded' && (
              <span className={lastSync.status === 'failed' ? 'text-red-400' : 'text-amber-400'}> · {SYNC_LABELS[lastSync.status]}</span>
            )}
          </p>
        </div>
      </div>

      {(syncError || (!syncing && lastSync?.status === 'failed' && lastSync.error)) && (
        <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" />
          <div>
            <p className="font-medium text-red-100">The BILL sync did not finish.</p>
            <p className="mt-1">{syncError || lastSync.error}</p>
          </div>
        </div>
      )}

      {loadError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          Could not load payables data: {loadError}
        </div>
      )}

      {options && !hasData && !syncing && (
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-8 text-center">
          <Landmark className="mx-auto h-10 w-10 text-teal-400" />
          <h2 className="mt-4 text-lg font-semibold text-white">No BILL data yet</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-slate-400">
            Click <span className="text-slate-200">Sync now</span> to copy vendors, bills and payments from BILL.
            The first sync can take a few minutes. After that, it runs automatically every night.
          </p>
        </div>
      )}

      {options && hasData && <SpendDashboard key={refreshKey} options={options} />}
    </div>
  );
}
