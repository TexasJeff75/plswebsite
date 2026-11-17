import React, { useCallback, useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { AlertCircle, BarChart3, CalendarClock, Landmark, Wallet, Loader2, Lock, RefreshCw, TrendingDown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { payablesService } from '../services/payablesService';
import SpendDashboard from './payables/SpendDashboard';
import ForecastDashboard from './payables/ForecastDashboard';
import PayPlan from './payables/PayPlan';
import CashFlow from './payables/CashFlow';

const TABS = [
  { id: 'spend', label: 'Spend', icon: BarChart3 },
  { id: 'forecast', label: 'Forecast', icon: TrendingDown },
  { id: 'plan', label: 'Pay Plan', icon: CalendarClock },
  { id: 'cash', label: 'Cash Flow', icon: Wallet },
];

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
  const [tab, setTab] = useState('spend');
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

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

  async function handleClear() {
    setClearing(true);
    setSyncError('');
    try {
      await payablesService.clearBillData();
      setConfirmClear(false);
      await loadOptions();
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setSyncError(err.message);
    } finally {
      setClearing(false);
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
  const dataEnv = options?.data_source_env;
  const shownError = syncError || (!syncing && lastSync?.status === 'failed' ? lastSync.error : '');
  const sourceMismatch = !!shownError && shownError.startsWith('Data source mismatch');

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center flex-shrink-0">
            <Landmark className="w-5 h-5 text-teal-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Payables</h1>
            <p className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
              Accounts payable from BILL · read-only
              {dataEnv && (
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${dataEnv === 'production' ? 'bg-teal-500/15 text-teal-300' : 'bg-amber-500/15 text-amber-300'}`}>
                  {dataEnv === 'production' ? 'Production data' : 'Sandbox data'}
                </span>
              )}
            </p>
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

      {shownError && (
        <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" />
          <div className="min-w-0">
            <p className="font-medium text-red-100">The BILL sync did not finish.</p>
            <p className="mt-1">{shownError}</p>
            {sourceMismatch && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {!confirmClear ? (
                  <button type="button" onClick={() => setConfirmClear(true)}
                    className="rounded-lg border border-red-400/40 px-3 py-1.5 text-xs font-medium text-red-100 hover:bg-red-500/20">
                    Clear BILL data
                  </button>
                ) : (
                  <>
                    <span className="text-red-100">This removes all copied BILL data and every pay plan. Cash cushion settings are kept. Continue?</span>
                    <button type="button" onClick={handleClear} disabled={clearing}
                      className="inline-flex items-center gap-1 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-400 disabled:opacity-60">
                      {clearing && <Loader2 className="h-3 w-3 animate-spin" />}Clear data
                    </button>
                    <button type="button" onClick={() => setConfirmClear(false)} className="px-2 text-xs text-red-200 hover:text-white">Cancel</button>
                  </>
                )}
              </div>
            )}
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

      {options && hasData && (
        <>
          <div className="flex gap-1 border-b border-slate-700" role="tablist">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
                className={`-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium ${tab === id ? 'border-teal-400 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
                <Icon className="h-4 w-4" />{label}
              </button>
            ))}
          </div>
          {tab === 'spend' && <SpendDashboard key={`spend-${refreshKey}`} options={options} />}
          {tab === 'forecast' && <ForecastDashboard key={`forecast-${refreshKey}`} />}
          {tab === 'plan' && <PayPlan key={`plan-${refreshKey}`} />}
          {tab === 'cash' && <CashFlow key={`cash-${refreshKey}`} />}
        </>
      )}
    </div>
  );
}
