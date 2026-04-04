import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Search, Package, ShoppingCart, CircleAlert as AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { supplyOrdersService } from '../services/supplyOrdersService';
import { useAuth } from '../contexts/AuthContext';

export default function SupplyOrderModal({ facility, onClose, onSuccess }) {
  const { user } = useAuth();
  const [catalog, setCatalog] = useState([]);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedItems, setSelectedItems] = useState([]);
  const [freeFormItems, setFreeFormItems] = useState([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');

  useEffect(() => {
    loadCatalog();
  }, []);

  async function loadCatalog() {
    try {
      const { data, error: err } = await supabase
        .from('supply_catalog')
        .select('*')
        .eq('is_active', true)
        .order('category')
        .order('name');
      if (err) throw err;
      setCatalog(data || []);
    } catch (err) {
      console.error('Error loading catalog:', err);
    } finally {
      setLoading(false);
    }
  }

  const categories = ['all', ...new Set(catalog.map(i => i.category))];

  const filteredCatalog = catalog.filter(item => {
    const matchesSearch = !catalogSearch || item.name.toLowerCase().includes(catalogSearch.toLowerCase());
    const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  function adjustCatalogItem(item, delta) {
    setSelectedItems(prev => {
      const existing = prev.find(s => s.catalog_item_id === item.id);
      if (existing) {
        const newQty = existing.quantity_requested + delta;
        if (newQty <= 0) return prev.filter(s => s.catalog_item_id !== item.id);
        return prev.map(s => s.catalog_item_id === item.id ? { ...s, quantity_requested: newQty } : s);
      }
      if (delta > 0) {
        return [...prev, { catalog_item_id: item.id, name: item.name, unit: item.unit, quantity_requested: 1 }];
      }
      return prev;
    });
  }

  function getCatalogItemQty(itemId) {
    return selectedItems.find(s => s.catalog_item_id === itemId)?.quantity_requested || 0;
  }

  function addFreeFormItem() {
    setFreeFormItems(prev => [...prev, { id: Date.now(), free_form_description: '', quantity_requested: 1 }]);
  }

  function updateFreeFormItem(id, field, value) {
    setFreeFormItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  }

  function removeFreeFormItem(id) {
    setFreeFormItems(prev => prev.filter(i => i.id !== id));
  }

  const totalItemCount = selectedItems.length + freeFormItems.filter(i => i.free_form_description.trim()).length;

  async function handleSubmit() {
    setError(null);

    const validFreeForm = freeFormItems.filter(i => i.free_form_description.trim() && i.quantity_requested > 0);

    if (selectedItems.length === 0 && validFreeForm.length === 0) {
      setError('Please add at least one item to your order.');
      return;
    }

    if (!facility.organization_id) {
      setError('This facility has no associated organization. Please contact Proximity staff.');
      return;
    }

    try {
      setSubmitting(true);

      const items = [
        ...selectedItems.map(i => ({
          catalog_item_id: i.catalog_item_id,
          quantity_requested: i.quantity_requested,
        })),
        ...validFreeForm.map(i => ({
          free_form_description: i.free_form_description,
          quantity_requested: i.quantity_requested,
        })),
      ];

      await supplyOrdersService.create({
        facilityId: facility.id,
        organizationId: facility.organization_id,
        requestedBy: user.id,
        notes,
        items,
      });

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Error creating order:', err);
      setError(err.message || 'Failed to create order');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white">New Supply Order</h2>
            <p className="text-slate-400 text-sm mt-0.5">{facility.name}</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-6 space-y-6 border-r border-slate-700">
            <div>
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <Package className="w-4 h-4 text-teal-400" />
                Catalog Items
              </h3>

              <div className="flex items-center gap-2 mb-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={catalogSearch}
                    onChange={e => setCatalogSearch(e.target.value)}
                    placeholder="Search catalog..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="flex gap-2 mb-3 flex-wrap">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${activeCategory === cat ? 'bg-teal-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                  >
                    {cat === 'all' ? 'All' : cat}
                  </button>
                ))}
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filteredCatalog.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-6">No items found</p>
              ) : (
                <div className="space-y-2">
                  {filteredCatalog.map(item => {
                    const qty = getCatalogItemQty(item.id);
                    return (
                      <div key={item.id} className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${qty > 0 ? 'bg-teal-500/10 border-teal-500/30' : 'bg-slate-800 border-slate-700 hover:border-slate-600'}`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{item.name}</p>
                          {item.description && <p className="text-slate-400 text-xs truncate">{item.description}</p>}
                          <span className="text-xs text-slate-500">{item.unit}</span>
                        </div>
                        <div className="flex items-center gap-2 ml-3">
                          <button
                            onClick={() => adjustCatalogItem(item, -1)}
                            className="w-7 h-7 flex items-center justify-center bg-slate-700 hover:bg-slate-600 text-white rounded-md transition-colors text-sm font-bold"
                          >
                            -
                          </button>
                          <span className="w-8 text-center text-white text-sm font-medium">{qty}</span>
                          <button
                            onClick={() => adjustCatalogItem(item, 1)}
                            className="w-7 h-7 flex items-center justify-center bg-teal-600 hover:bg-teal-700 text-white rounded-md transition-colors text-sm font-bold"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <Plus className="w-4 h-4 text-slate-400" />
                  Unlisted Items
                </h3>
                <button
                  onClick={addFreeFormItem}
                  className="text-xs text-teal-400 hover:text-teal-300 flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Add row
                </button>
              </div>

              {freeFormItems.length === 0 ? (
                <p className="text-slate-500 text-sm">Click "Add row" to request an item not in the catalog.</p>
              ) : (
                <div className="space-y-2">
                  {freeFormItems.map(item => (
                    <div key={item.id} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={item.free_form_description}
                        onChange={e => updateFreeFormItem(item.id, 'free_form_description', e.target.value)}
                        placeholder="Describe the item..."
                        className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-teal-500"
                      />
                      <input
                        type="number"
                        min="1"
                        value={item.quantity_requested}
                        onChange={e => updateFreeFormItem(item.id, 'quantity_requested', Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-16 px-2 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm text-center focus:outline-none focus:border-teal-500"
                      />
                      <button
                        onClick={() => removeFreeFormItem(item.id)}
                        className="p-2 text-slate-400 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Order Notes (optional)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder="Any special instructions or notes for this order..."
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-teal-500 resize-none"
              />
            </div>
          </div>

          <div className="w-72 flex-shrink-0 p-5 overflow-y-auto">
            <div className="sticky top-0">
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-teal-400" />
                Order Summary
                {totalItemCount > 0 && (
                  <span className="ml-auto bg-teal-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{totalItemCount}</span>
                )}
              </h3>

              {selectedItems.length === 0 && freeFormItems.filter(i => i.free_form_description.trim()).length === 0 ? (
                <p className="text-slate-500 text-sm">No items selected yet.</p>
              ) : (
                <div className="space-y-2">
                  {selectedItems.map(item => (
                    <div key={item.catalog_item_id} className="flex items-center justify-between text-sm">
                      <span className="text-slate-300 truncate flex-1 mr-2">{item.name}</span>
                      <span className="text-teal-400 font-medium flex-shrink-0">&times;{item.quantity_requested} {item.unit}</span>
                    </div>
                  ))}
                  {freeFormItems.filter(i => i.free_form_description.trim()).map(item => (
                    <div key={item.id} className="flex items-center justify-between text-sm">
                      <span className="text-slate-300 truncate flex-1 mr-2 italic">{item.free_form_description}</span>
                      <span className="text-amber-400 font-medium flex-shrink-0">&times;{item.quantity_requested}</span>
                    </div>
                  ))}
                </div>
              )}

              {error && (
                <div className="mt-4 flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={submitting || totalItemCount === 0}
                className="mt-6 w-full flex items-center justify-center gap-2 px-4 py-3 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-colors"
              >
                {submitting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <ShoppingCart className="w-4 h-4" />
                    Submit Order
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
