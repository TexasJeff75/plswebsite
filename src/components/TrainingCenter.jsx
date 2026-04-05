import React, { useState, useEffect } from 'react';
import { BookOpen, Plus, Search, Video, FileText, Image, Link, Monitor, CreditCard as Edit2, Trash2, Eye, EyeOff, ListFilter as Filter, RefreshCw, ChevronDown } from 'lucide-react';
import { trainingMaterialsService } from '../services/trainingMaterialsService';
import { useAuth } from '../contexts/AuthContext';
import TrainingMaterialModal from './training/TrainingMaterialModal';
import TrainingMaterialViewer from './training/TrainingMaterialViewer';

const CATEGORIES = [
  { value: 'all', label: 'All Categories' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'procedure', label: 'Procedure' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'safety', label: 'Safety' },
  { value: 'other', label: 'Other' },
];

const TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'video', label: 'Videos' },
  { value: 'document', label: 'Documents' },
  { value: 'image', label: 'Images' },
  { value: 'presentation', label: 'Presentations' },
  { value: 'link', label: 'Links' },
];

const TYPE_META = {
  video: { icon: Video, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', label: 'Video' },
  document: { icon: FileText, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', label: 'Document' },
  image: { icon: Image, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20', label: 'Image' },
  presentation: { icon: Monitor, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', label: 'Presentation' },
  link: { icon: Link, color: 'text-teal-400', bg: 'bg-teal-500/10 border-teal-500/20', label: 'Link' },
};

const CATEGORY_COLORS = {
  equipment: 'bg-blue-500/15 text-blue-300 border-blue-500/25',
  procedure: 'bg-teal-500/15 text-teal-300 border-teal-500/25',
  compliance: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/25',
  onboarding: 'bg-green-500/15 text-green-300 border-green-500/25',
  safety: 'bg-red-500/15 text-red-300 border-red-500/25',
  other: 'bg-slate-500/15 text-slate-300 border-slate-500/25',
};

function formatBytes(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function TrainingCenter() {
  const { isStaff, isAdmin } = useAuth();
  const canManage = isStaff || isAdmin;

  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [viewingMaterial, setViewingMaterial] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    loadMaterials();
  }, [categoryFilter, typeFilter]);

  const loadMaterials = async () => {
    try {
      setLoading(true);
      const data = await trainingMaterialsService.getAll({
        category: categoryFilter,
        material_type: typeFilter,
      });
      setMaterials(data);
    } catch (err) {
      console.error('Error loading training materials:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredMaterials = materials.filter(m => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      m.title?.toLowerCase().includes(q) ||
      m.description?.toLowerCase().includes(q) ||
      m.equipment_type?.toLowerCase().includes(q) ||
      m.tags?.some(t => t.toLowerCase().includes(q))
    );
  });

  const handleDelete = async (id) => {
    if (!confirm('Delete this training material? This cannot be undone.')) return;
    try {
      setDeletingId(id);
      await trainingMaterialsService.delete(id);
      setMaterials(prev => prev.filter(m => m.id !== id));
    } catch (err) {
      console.error('Error deleting material:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleTogglePublish = async (material) => {
    try {
      const updated = await trainingMaterialsService.update(material.id, { is_published: !material.is_published });
      setMaterials(prev => prev.map(m => m.id === material.id ? { ...m, ...updated } : m));
    } catch (err) {
      console.error('Error toggling publish:', err);
    }
  };

  const handleView = (material) => {
    setViewingMaterial(material);
  };

  const openAdd = () => {
    setEditingMaterial(null);
    setShowModal(true);
  };

  const openEdit = (material) => {
    setEditingMaterial(material);
    setShowModal(true);
  };

  const handleSaved = () => {
    setShowModal(false);
    setEditingMaterial(null);
    loadMaterials();
  };

  const stats = {
    total: materials.length,
    videos: materials.filter(m => m.material_type === 'video').length,
    documents: materials.filter(m => m.material_type === 'document').length,
    images: materials.filter(m => m.material_type === 'image').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Training Center</h1>
          <p className="text-sm text-slate-400 mt-1">
            Equipment training videos, guides, and reference materials for staff
          </p>
        </div>
        {canManage && (
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors font-medium text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Material
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Materials', value: stats.total, icon: BookOpen, color: 'teal' },
          { label: 'Videos', value: stats.videos, icon: Video, color: 'red' },
          { label: 'Documents', value: stats.documents, icon: FileText, color: 'blue' },
          { label: 'Images', value: stats.images, icon: Image, color: 'green' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className={`bg-gradient-to-br from-${color}-500/10 to-slate-800/50 border border-${color}-500/20 rounded-lg p-4 relative overflow-hidden`}>
            <div className={`absolute top-0 left-0 w-1 h-full bg-${color}-500 rounded-l-lg`} />
            <div className="flex items-center justify-between mb-2">
              <h3 className={`text-${color}-300/80 text-xs font-medium uppercase tracking-wider`}>{label}</h3>
              <div className={`w-8 h-8 bg-${color}-500/15 rounded flex items-center justify-center ring-1 ring-${color}-500/20`}>
                <Icon className={`w-4 h-4 text-${color}-400`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by title, description, equipment, or tags..."
              className="w-full pl-9 pr-4 py-2.5 bg-slate-900/60 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="px-3 py-2.5 bg-slate-900/60 border border-slate-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 min-w-[150px]"
          >
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-2.5 bg-slate-900/60 border border-slate-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 min-w-[140px]"
          >
            {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <button
            onClick={() => { setSearch(''); setCategoryFilter('all'); setTypeFilter('all'); }}
            className="px-3 py-2.5 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors text-sm whitespace-nowrap"
          >
            Clear
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-400 text-sm">Loading training materials...</p>
          </div>
        </div>
      ) : filteredMaterials.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <BookOpen className="w-16 h-16 opacity-20 mb-4" />
          <p className="text-lg font-medium text-slate-300">No training materials found</p>
          <p className="text-sm mt-1">
            {canManage ? 'Add your first training material to get started.' : 'Check back later for training content.'}
          </p>
          {canManage && (
            <button
              onClick={openAdd}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Add Material
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMaterials.map(material => {
            const meta = TYPE_META[material.material_type] || TYPE_META.document;
            const Icon = meta.icon;
            return (
              <div
                key={material.id}
                className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden hover:border-slate-600 transition-all duration-200 group"
              >
                <div className={`h-1.5 w-full ${meta.bg.includes('red') ? 'bg-red-500' : meta.bg.includes('blue') ? 'bg-blue-500' : meta.bg.includes('green') ? 'bg-green-500' : meta.bg.includes('orange') ? 'bg-orange-500' : 'bg-teal-500'}`} />

                <div className="p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-lg border flex items-center justify-center flex-shrink-0 ${meta.bg}`}>
                      <Icon className={`w-5 h-5 ${meta.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white text-sm leading-tight line-clamp-2 group-hover:text-teal-300 transition-colors">
                        {material.title}
                      </h3>
                      {material.equipment_type && (
                        <p className="text-xs text-slate-400 mt-0.5 truncate">{material.equipment_type}</p>
                      )}
                    </div>
                    {!material.is_published && canManage && (
                      <span className="flex-shrink-0 px-1.5 py-0.5 bg-yellow-500/15 text-yellow-400 text-xs rounded border border-yellow-500/25 font-medium">
                        Draft
                      </span>
                    )}
                  </div>

                  {material.description && (
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-2 mb-3">{material.description}</p>
                  )}

                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className={`px-2 py-0.5 text-xs rounded-full border font-medium capitalize ${CATEGORY_COLORS[material.category] || CATEGORY_COLORS.other}`}>
                      {material.category}
                    </span>
                    <span className={`px-2 py-0.5 text-xs rounded-full border ${meta.bg} ${meta.color}`}>
                      {meta.label}
                    </span>
                    {material.file_size > 0 && (
                      <span className="text-xs text-slate-500">{formatBytes(material.file_size)}</span>
                    )}
                  </div>

                  {material.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {material.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="px-1.5 py-0.5 bg-slate-700/60 text-slate-400 text-xs rounded border border-slate-600/50">
                          {tag}
                        </span>
                      ))}
                      {material.tags.length > 3 && (
                        <span className="text-xs text-slate-500">+{material.tags.length - 3}</span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-3 border-t border-slate-700/50">
                    <button
                      onClick={() => handleView(material)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-teal-600/15 hover:bg-teal-600 border border-teal-500/30 hover:border-teal-600 text-teal-400 hover:text-white rounded-lg text-xs font-medium transition-all"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View
                    </button>

                    {canManage && (
                      <>
                        <button
                          onClick={() => openEdit(material)}
                          className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleTogglePublish(material)}
                          className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
                          title={material.is_published ? 'Unpublish (hide from users)' : 'Publish (make visible to users)'}
                        >
                          {material.is_published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4 text-green-400" />}
                        </button>
                        <button
                          onClick={() => handleDelete(material.id)}
                          disabled={deletingId === material.id}
                          className="p-2 hover:bg-red-900/30 rounded-lg text-slate-400 hover:text-red-400 transition-colors disabled:opacity-50"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <TrainingMaterialModal
          editing={editingMaterial}
          onClose={() => { setShowModal(false); setEditingMaterial(null); }}
          onSaved={handleSaved}
        />
      )}

      {viewingMaterial && (
        <TrainingMaterialViewer
          material={viewingMaterial}
          onClose={() => setViewingMaterial(null)}
        />
      )}
    </div>
  );
}
