import React from 'react';
import { RESULT_STYLE } from './labResults';

// A small bar showing where a value sits against its normal range or cut-off.
// range: { kind: 'range', range_low, range_high } or { kind: 'cutoff', cutoff }
export default function ResultRangeBar({ value, range, status }) {
  if (value == null || !range) return null;
  const low = range.range_low != null ? Number(range.range_low) : null;
  const high = range.range_high != null ? Number(range.range_high) : null;
  const cutoff = range.cutoff != null ? Number(range.cutoff) : null;

  let min;
  let max;
  if (range.kind === 'cutoff' && cutoff != null) {
    min = 0;
    max = cutoff * 3 || 1;
  } else if (low != null && high != null && high > low) {
    const pad = (high - low) * 0.6;
    min = Math.max(0, low - pad);
    max = high + pad;
  } else if (high != null) {
    min = 0;
    max = high * 1.6 || 1;
  } else if (low != null) {
    min = 0;
    max = low * 2 || 1;
  } else {
    return null;
  }

  const pct = (v) => Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100));
  const offScale = value > max ? 'above' : value < min ? 'below' : null;
  const marker = pct(value);
  const color = (RESULT_STYLE[status] || RESULT_STYLE.normal).color;

  return (
    <div className="relative h-5 w-full min-w-[120px]" aria-hidden="true">
      <div className="absolute inset-x-0 top-2 h-1.5 rounded-full bg-slate-700" />
      {range.kind === 'cutoff' && cutoff != null ? (
        <>
          <div className="absolute top-2 h-1.5 rounded-r-full bg-red-500/30" style={{ left: `${pct(cutoff)}%`, right: 0 }} />
          <div className="absolute top-0.5 h-4 w-px bg-red-400" style={{ left: `${pct(cutoff)}%` }} />
        </>
      ) : (
        <div
          className="absolute top-2 h-1.5 bg-emerald-500/40"
          style={{ left: `${low != null ? pct(low) : 0}%`, right: `${high != null ? 100 - pct(high) : 0}%` }}
        />
      )}
      <div
        className="absolute top-0.5 h-4 w-4 -translate-x-1/2 rounded-full border-2 border-slate-900"
        style={{ left: `${marker}%`, backgroundColor: color }}
      />
      {offScale && (
        <span className={`absolute -top-0.5 text-[10px] font-bold ${offScale === 'above' ? 'right-0' : 'left-0'}`} style={{ color }}>
          {offScale === 'above' ? '▶' : '◀'}
        </span>
      )}
    </div>
  );
}
