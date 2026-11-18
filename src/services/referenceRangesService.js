import { supabase } from '../lib/supabase';

// Reference ranges and cut-offs for lab tests (Settings > Reference Ranges).
export const referenceRangesService = {
  async list() {
    const { data, error } = await supabase
      .from('lab_reference_ranges')
      .select('*')
      .order('test_name');
    if (error) throw error;
    return data || [];
  },

  async save(range) {
    const { data: { user } } = await supabase.auth.getUser();
    const toNumber = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));
    const row = {
      test_name: String(range.test_name || '').trim(),
      panel_name: String(range.panel_name || '').trim() || null,
      kind: range.kind === 'cutoff' ? 'cutoff' : 'range',
      range_low: range.kind === 'cutoff' ? null : toNumber(range.range_low),
      range_high: range.kind === 'cutoff' ? null : toNumber(range.range_high),
      cutoff: range.kind === 'cutoff' ? toNumber(range.cutoff) : null,
      unit: String(range.unit || '').trim() || null,
      notes: String(range.notes || '').trim() || null,
      updated_at: new Date().toISOString(),
      updated_by: user?.id || null,
    };
    const query = range.id
      ? supabase.from('lab_reference_ranges').update(row).eq('id', range.id)
      : supabase.from('lab_reference_ranges').insert(row);
    const { data, error } = await query.select().single();
    if (error) throw error;
    return data;
  },

  async remove(id) {
    const { error } = await supabase.from('lab_reference_ranges').delete().eq('id', id);
    if (error) throw error;
  },
};
