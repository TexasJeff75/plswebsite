import React from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceArea, ReferenceLine } from 'recharts';

// One test's values across a patient's orders, with the normal range shaded
// or the cut-off drawn as a line. points: [{ label, value, display }]
export default function TrendChart({ points, range, unit }) {
  if (!points?.length) return <p className="text-sm text-slate-500">No numeric values to chart for this test.</p>;
  const low = range?.range_low != null ? Number(range.range_low) : null;
  const high = range?.range_high != null ? Number(range.range_high) : null;
  const cutoff = range?.kind === 'cutoff' && range.cutoff != null ? Number(range.cutoff) : null;
  const values = points.map((p) => p.value);
  const top = Math.max(...values, high ?? 0, cutoff ?? 0) * 1.15 || 1;

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 10, right: 24, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
          <XAxis dataKey="label" stroke="#94a3b8" fontSize={12} />
          <YAxis stroke="#94a3b8" fontSize={12} domain={[0, Math.ceil(top)]} />
          {range?.kind !== 'cutoff' && (low != null || high != null) && (
            <ReferenceArea y1={low ?? 0} y2={high ?? top} fill="#10b981" fillOpacity={0.12} stroke="none" />
          )}
          {cutoff != null && (
            <ReferenceLine y={cutoff} stroke="#f87171" strokeDasharray="6 4" label={{ value: `Cut-off ${cutoff}`, fill: '#fca5a5', fontSize: 11, position: 'insideTopRight' }} />
          )}
          <Tooltip
            contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#fff' }}
            formatter={(v, _n, item) => [`${item.payload.display ?? v}${unit ? ` ${unit}` : ''}`, 'Result']}
          />
          <Line type="monotone" dataKey="value" stroke="#2dd4bf" strokeWidth={2} dot={{ r: 4, fill: '#2dd4bf' }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
