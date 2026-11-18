// Helpers for reading StratusDX results and matching them to reference ranges.

// Numeric value of a result, or null. Uses the raw value first ("86.7"),
// then the display value ("<15.00" -> 15, ">500" -> 500).
export function numericValue(obs) {
  for (const raw of [obs?.result_value, obs?.result_display]) {
    if (raw == null) continue;
    const m = String(raw).replace(/,/g, '').match(/-?\d+(\.\d+)?/);
    if (m && !/^n\/?a$/i.test(String(raw).trim())) return Number(m[0]);
  }
  return null;
}

// What the result means, for colors and labels.
// 'positive' | 'negative' | 'high' | 'low' | 'abnormal' | 'normal' | 'pending'
export function classify(obs, range) {
  const flag = String(obs?.result_flag || '').trim().toLowerCase();
  const display = String(obs?.result_display || obs?.result_value || '').trim().toLowerCase();
  if (flag.startsWith('pos') || display === 'positive' || display === 'detected') return 'positive';
  if (flag === 'h' || flag.startsWith('high') || flag === 'hh') return 'high';
  if (flag === 'l' || flag.startsWith('low') || flag === 'll') return 'low';
  if (flag && flag !== 'n' && flag !== 'normal' && flag !== 'neg' && flag !== 'negative') return 'abnormal';
  if (display === 'negative' || display === 'not detected' || flag.startsWith('neg')) return 'negative';
  const v = numericValue(obs);
  if (range && v != null) {
    if (range.kind === 'cutoff' && range.cutoff != null) return v >= Number(range.cutoff) ? 'positive' : 'negative';
    if (range.range_high != null && v > Number(range.range_high)) return 'high';
    if (range.range_low != null && v < Number(range.range_low)) return 'low';
  }
  if (!display) return 'pending';
  return 'normal';
}

export const RESULT_STYLE = {
  positive: { label: 'Positive', pill: 'bg-red-500/15 text-red-300 border-red-500/30', color: '#f87171' },
  high: { label: 'High', pill: 'bg-red-500/15 text-red-300 border-red-500/30', color: '#f87171' },
  low: { label: 'Low', pill: 'bg-amber-500/15 text-amber-300 border-amber-500/30', color: '#fbbf24' },
  abnormal: { label: 'Abnormal', pill: 'bg-amber-500/15 text-amber-300 border-amber-500/30', color: '#fbbf24' },
  negative: { label: 'Negative', pill: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', color: '#34d399' },
  normal: { label: 'In range', pill: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', color: '#34d399' },
  pending: { label: 'Pending', pill: 'bg-slate-700 text-slate-300 border-slate-600', color: '#94a3b8' },
};

// The reference range for a result: a panel-specific one first, then one for the test name.
export function findRange(ranges, testName, panelName) {
  if (!ranges?.length || !testName) return null;
  const t = testName.trim().toLowerCase();
  const p = (panelName || '').trim().toLowerCase();
  return (
    ranges.find((r) => r.test_name.trim().toLowerCase() === t && (r.panel_name || '').trim().toLowerCase() === p && p) ||
    ranges.find((r) => r.test_name.trim().toLowerCase() === t && !r.panel_name) ||
    null
  );
}

export function rangeLabel(range) {
  if (!range) return null;
  const unit = range.unit ? ` ${range.unit}` : '';
  if (range.kind === 'cutoff') return range.cutoff != null ? `Cut-off ${range.cutoff}${unit}` : null;
  if (range.range_low != null && range.range_high != null) return `${range.range_low} to ${range.range_high}${unit}`;
  if (range.range_low != null) return `${range.range_low} or more${unit}`;
  if (range.range_high != null) return `${range.range_high} or less${unit}`;
  return null;
}

// Orders are grouped into patients by last name, first name and date of birth.
export function patientKey(order) {
  return [order.patient_last_name, order.patient_first_name, order.patient_dob]
    .map((v) => String(v || '').trim().toLowerCase())
    .join('|');
}

export function patientName(order) {
  const last = order?.patient_last_name || '';
  const first = order?.patient_first_name || '';
  return last || first ? `${last}${last && first ? ', ' : ''}${first}` : 'Unknown patient';
}

// StratusDX dates come as yyyyMMddHHmmss (US Central) or ISO; returns a Date or null.
export function parseLabDate(value) {
  if (!value) return null;
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?$/.exec(String(value));
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDob(value) {
  const d = parseLabDate(value);
  return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : value || '';
}
