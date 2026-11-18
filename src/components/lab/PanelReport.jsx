import React, { useMemo, useState } from 'react';
import { TrendingUp, ChevronDown, ChevronRight } from 'lucide-react';
import ResultRangeBar from './ResultRangeBar';
import { RESULT_STYLE, classify, findRange, numericValue, rangeLabel } from './labResults';

const FLAGGED = ['positive', 'high', 'low', 'abnormal'];

// An order's results grouped by panel. Flagged results are listed first in
// each panel; long negative lists (e.g. toxicology) can be collapsed.
export default function PanelReport({ observations, ranges, onTrend }) {
  const panels = useMemo(() => {
    const map = new Map();
    (observations || []).forEach((obs) => {
      const name = obs.panel_name || 'Other results';
      if (!map.has(name)) map.set(name, []);
      const range = findRange(ranges, obs.test_name, obs.panel_name);
      map.get(name).push({ obs, range, status: classify(obs, range), value: numericValue(obs) });
    });
    return [...map.entries()].map(([name, rows]) => ({
      name,
      rows: rows.sort((a, b) => (FLAGGED.includes(b.status) - FLAGGED.includes(a.status)) || (a.obs.sort_order - b.obs.sort_order)),
      flagged: rows.filter((r) => FLAGGED.includes(r.status)).length,
    }));
  }, [observations, ranges]);

  if (!panels.length) return <p className="text-sm text-slate-400">No results yet for this order.</p>;

  return (
    <div className="space-y-4">
      {panels.map((panel) => <Panel key={panel.name} panel={panel} onTrend={onTrend} />)}
    </div>
  );
}

function Panel({ panel, onTrend }) {
  const quiet = panel.rows.filter((r) => !FLAGGED.includes(r.status));
  const [showAll, setShowAll] = useState(quiet.length <= 8);
  const rows = showAll ? panel.rows : panel.rows.filter((r) => FLAGGED.includes(r.status));

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900/40">
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-700 px-4 py-3">
        <h4 className="font-semibold text-white">{panel.name}</h4>
        <span className="text-xs text-slate-400">{panel.rows.length} test{panel.rows.length === 1 ? '' : 's'}</span>
        {panel.flagged > 0 ? (
          <span className="rounded-full border border-red-500/30 bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-300">
            {panel.flagged} flagged
          </span>
        ) : (
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-300">
            Nothing flagged
          </span>
        )}
        {quiet.length > 8 && (
          <button type="button" onClick={() => setShowAll((v) => !v)} className="ml-auto flex items-center gap-1 text-xs text-teal-300 hover:text-teal-200">
            {showAll ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            {showAll ? 'Show flagged only' : `Show all ${panel.rows.length}`}
          </button>
        )}
      </header>
      {rows.length === 0 ? (
        <p className="px-4 py-3 text-sm text-slate-400">All {quiet.length} results are negative or in range.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="px-4 py-2">Test</th>
                <th className="px-4 py-2">Result</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2 w-48">Range / cut-off</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {rows.map(({ obs, range, status, value }) => {
                const style = RESULT_STYLE[status] || RESULT_STYLE.normal;
                const unit = obs.result_uom || obs.test_uom || range?.unit || '';
                return (
                  <tr key={obs.id}>
                    <td className="px-4 py-2 text-white">{obs.test_name || obs.test_code}</td>
                    <td className="px-4 py-2 font-semibold text-white whitespace-nowrap">
                      {obs.result_display || obs.result_value || '-'}
                      {unit && /\d/.test(obs.result_display || obs.result_value || '') ? <span className="ml-1 text-xs font-normal text-slate-400">{unit}</span> : null}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${style.pill}`}>{style.label}</span>
                    </td>
                    <td className="px-4 py-2">
                      <ResultRangeBar value={value} range={range} status={status} />
                      <p className="mt-0.5 text-[11px] text-slate-500">{rangeLabel(range) || 'No range set'}</p>
                    </td>
                    <td className="px-4 py-2 text-right">
                      {onTrend && value != null && (
                        <button type="button" onClick={() => onTrend(obs.test_name, obs.panel_name)} title="Show trend" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-700 hover:text-teal-300">
                          <TrendingUp className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
