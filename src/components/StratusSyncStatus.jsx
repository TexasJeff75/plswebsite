import React, { useCallback, useEffect, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { labOrdersService } from '../services/labOrdersService';

// StratusDX Sync: shows how far the LIS Integration API import has got and
// lets a Super Admin run it now. The import also runs every 5 minutes.


function when(ts) {
  if (!ts) return 'Never';
  const d = new Date(ts);
  return `${format(d, 'MMM d, yyyy h:mm a')} (${formatDistanceToNow(d, { addSuffix: true })})`;
}

function Stat({ label, value }) {
  return (
    <div className="bg-slate-900/50 rounded-lg p-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-lg font-semibold text-white tabular-nums">{value}</p>
    </div>
  );
}

export default function StratusSyncStatus() {
  const [checkpoint, setCheckpoint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(null);
  const [runError, setRunError] = useState(null);
  const [checking, setChecking] = useState(false);
  const [counts, setCounts] = useState(null);
  const [countsError, setCountsError] = useState(null);

  async function compareCounts() {
    setChecking(true);
    setCountsError(null);
    try {
      setCounts(await labOrdersService.checkStratusCounts());
    } catch (err) {
      setCountsError(err.message);
    } finally {
      setChecking(false);
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('stratus_sync_checkpoint')
      .select('last_processed_at_utc, status_updated_from, last_sync_run_at, last_sync_summary')
      .eq('id', 1)
      .maybeSingle();
    setLoadError(error ? error.message : null);
    setCheckpoint(data || null);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // While an import still has work to do, refresh the status every 30 seconds.
  const notCaughtUp = Boolean(checkpoint?.last_sync_summary?.more);
  useEffect(() => {
    if (!notCaughtUp) return undefined;
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [notCaughtUp, load]);

  async function runNow() {
    setRunning(true);
    setRunError(null);
    setProgress(null);
    try {
      const result = await labOrdersService.syncAll();
      const r = result.summary || {};
      let text;
      if (result.busy) {
        text = 'An import is already running, most likely the background catch-up. This page refreshes on its own every 30 seconds.';
      } else {
        text = `Saved ${r.total_processed || 0} orders, ${r.unchanged || 0} unchanged, ${r.errors || 0} failed.`;
        if (result.background_started) text += ' The rest is now importing in the background (up to 15 minutes at a time). This page refreshes on its own every 30 seconds.';
        else if (r.more) text += ' There is more to import; the schedule will carry on.';
        else text += ' Caught up.';
      }
      setProgress({ text });
    } catch (err) {
      setRunError(err.message);
    } finally {
      setRunning(false);
      await load();
    }
  }

  const s = checkpoint?.last_sync_summary || {};
  const hasRun = Boolean(s.trigger);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">StratusDX Sync</h2>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Orders and results come from the StratusDX LIS Integration API. The import runs every 5 minutes
            and carries on where it stopped. Use Run now to catch up straight away.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={runNow}
          disabled={running}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:opacity-60 text-white text-sm font-medium"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {running ? 'Running...' : 'Run now'}
        </button>
        <button
          type="button"
          onClick={compareCounts}
          disabled={checking}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-600 text-slate-200 hover:text-white hover:border-slate-500 disabled:opacity-60 text-sm font-medium"
        >
          {checking && <Loader2 className="w-4 h-4 animate-spin" />}
          {checking ? 'Comparing...' : 'Compare counts'}
        </button>
        </div>
      </div>

      {countsError && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-300">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{countsError}</span>
        </div>
      )}

      {counts && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-sm">
          <h3 className="font-medium text-white">Orders per month: StratusDX compared with saved here</h3>
          <p className="text-slate-400 text-xs mt-1 mb-3">
            By the date StratusDX received each order. Months not fully read yet are still importing, so their counts will rise.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full max-w-2xl">
              <thead>
                <tr className="text-left text-xs text-slate-400 border-b border-slate-700">
                  <th className="py-2 pr-4 font-medium">Month</th>
                  <th className="py-2 pr-4 font-medium text-right">In StratusDX</th>
                  <th className="py-2 pr-4 font-medium text-right">Saved here</th>
                  <th className="py-2 pr-4 font-medium text-right">Difference</th>
                  <th className="py-2 font-medium">Import</th>
                </tr>
              </thead>
              <tbody>
                {counts.months.map((m) => {
                  const diff = m.saved - m.api;
                  return (
                    <tr key={m.month} className="border-b border-slate-800">
                      <td className="py-1.5 pr-4 text-slate-200">{m.month}</td>
                      <td className="py-1.5 pr-4 text-right tabular-nums text-white">{m.api.toLocaleString()}</td>
                      <td className="py-1.5 pr-4 text-right tabular-nums text-white">{m.saved.toLocaleString()}</td>
                      <td className={`py-1.5 pr-4 text-right tabular-nums ${diff === 0 ? 'text-slate-400' : m.fully_read ? 'text-amber-300' : 'text-slate-400'}`}>
                        {diff === 0 ? '0' : diff.toLocaleString()}
                      </td>
                      <td className="py-1.5 text-slate-400">{m.fully_read ? 'Done' : 'In progress'}</td>
                    </tr>
                  );
                })}
                <tr className="font-medium">
                  <td className="py-2 pr-4 text-white">Total</td>
                  <td className="py-2 pr-4 text-right tabular-nums text-white">{counts.api_total.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-right tabular-nums text-white">{counts.saved_total.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-right tabular-nums text-slate-300">{(counts.saved_total - counts.api_total).toLocaleString()}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {progress && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-sm text-slate-300">{progress.text}</div>
      )}

      {runError && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-300">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{runError}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-slate-400"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>
      ) : loadError ? (
        <div className="text-sm text-red-300">Could not load the sync status: {loadError}</div>
      ) : (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-2 text-sm">
            {hasRun && !s.errors ? <CheckCircle2 className="w-4 h-4 text-teal-400" /> : <AlertCircle className="w-4 h-4 text-amber-400" />}
            <span className="text-slate-300">
              {hasRun
                ? `Last run: ${when(checkpoint?.last_sync_run_at)}, ${{ schedule: 'by the schedule', background: 'by the background catch-up' }[s.trigger] || 'started by hand'}.`
                : 'The new import has not run yet.'}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Orders saved" value={s.total_processed ?? 0} />
            <Stat label="Unchanged" value={s.unchanged ?? 0} />
            <Stat label="Failed" value={s.errors ?? 0} />
            <Stat label="Caught up" value={hasRun ? (s.more ? 'Not yet' : 'Yes') : '·'} />
          </div>

          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div><dt className="text-slate-400">New orders read up to</dt><dd className="text-white">{when(checkpoint?.last_processed_at_utc)}</dd></div>
            <div><dt className="text-slate-400">Changed orders checked from</dt><dd className="text-white">{checkpoint?.status_updated_from || '·'}</dd></div>
            {s.window && <div><dt className="text-slate-400">Last date window</dt><dd className="text-white">{s.window}</dd></div>}
            {s.api_rows_listed !== undefined && (
              <div>
                <dt className="text-slate-400">Orders StratusDX listed in the last run</dt>
                <dd className="text-white">
                  {s.api_rows_listed}
                  {s.api_rows_filtered ? ` (${s.api_rows_filtered} older than the saved point or without a date)` : ''}
                </dd>
              </div>
            )}
            {s.recheck && (
              <div>
                <dt className="text-slate-400">Weekly re-check of orders pending after 14 days, and finalized orders with no results (last run)</dt>
                <dd className="text-white">
                  {s.recheck.error ? `Not run: ${s.recheck.error}` : (
                    <>
                      {s.recheck.checked} re-checked, {s.recheck.gained_dates} now have dates, {s.recheck.gained_results || 0} now have results
                    </>
                  )}
                  {s.recheck.failed ? `, ${s.recheck.failed} failed` : ''}
                  {s.recheck.waiting != null ? ` · ${Number(s.recheck.waiting).toLocaleString()} waiting` : ''}
                </dd>
              </div>
            )}
            {s.repeated_accessions !== undefined && (
              <div>
                <dt className="text-slate-400">Accession numbers listed more than once (last run)</dt>
                <dd className="text-white">{s.repeated_accessions}</dd>
              </div>
            )}
            {s.finalized_without_results !== undefined && (
              <div>
                <dt className="text-slate-400">Finalized orders with no results in StratusDX (last run)</dt>
                <dd className="text-white">{s.finalized_without_results}</dd>
              </div>
            )}
            {s.base_url && <div><dt className="text-slate-400">API address</dt><dd className="text-white break-all">{s.base_url}</dd></div>}
          </dl>

          {s.api_check && (
            <div className="bg-slate-900/50 rounded-lg p-4 text-sm space-y-1">
              <h3 className="font-medium text-white">Connection check (last Run now)</h3>
              {s.api_check.error ? (
                <p className="text-red-300">{s.api_check.error}</p>
              ) : (
                <>
                  <p className="text-slate-300">Orders the API holds in total: <span className="text-white">{s.api_check.total_orders ?? 'not reported'}</span></p>
                  <p className="text-slate-300">Newest order received by StratusDX: <span className="text-white">{s.api_check.newest_processed_at ? when(s.api_check.newest_processed_at) : 'none'}</span></p>
                  {s.api_check.range_check && (
                    <p className="text-slate-300">
                      Orders on {s.api_check.range_check.day}: <span className="text-white">{s.api_check.range_check.same_day ?? '?'}</span> asked as that day only,{' '}
                      <span className="text-white">{s.api_check.range_check.to_next_day ?? '?'}</span> asked up to the next day
                    </p>
                  )}
                  <p className="text-slate-300">Response parts: <span className="text-white font-mono text-xs">{(s.api_check.response_keys || []).join(', ') || 'none'}</span></p>
                  <p className="text-slate-300">Order fields: <span className="text-white font-mono text-xs break-all">{(s.api_check.fields || []).join(', ') || 'none'}</span></p>
                </>
              )}
            </div>
          )}

          {Array.isArray(s.error_list) && s.error_list.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-white mb-2">Orders that failed in the last run</h3>
              <ul className="space-y-1 text-sm">
                {s.error_list.map((e) => (
                  <li key={e.accessionId} className="text-slate-300">
                    <span className="font-mono text-slate-200">{e.accessionId}</span>: {e.error}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-slate-500 mt-2">Failed orders are tried again on every run.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
