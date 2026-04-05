import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, Link, Video, FileText, Image, Loader as Loader2, Package, ChevronDown, Search } from 'lucide-react';
import { trainingMaterialsService } from '../../services/trainingMaterialsService';

const CATEGORIES = [
  { value: 'equipment', label: 'Equipment' },
  { value: 'procedure', label: 'Procedure' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'safety', label: 'Safety' },
  { value: 'other', label: 'Other' },
];

const MATERIAL_TYPES = [
  { value: 'video', label: 'Video', icon: Video },
  { value: 'document', label: 'Document', icon: FileText },
  { value: 'image', label: 'Image', icon: Image },
  { value: 'presentation', label: 'Presentation', icon: FileText },
  { value: 'link', label: 'External Link', icon: Link },
];

const FILE_TYPES = {
  video: '.mp4,.webm,.mov',
  document: '.pdf,.doc,.docx,.xls,.xlsx,.txt',
  image: '.jpg,.jpeg,.png,.gif,.webp',
  presentation: '.ppt,.pptx,.pdf',
  link: '',
};

const EQUIPMENT_TYPE_LABELS = {
  analyzer: 'Analyzer',
  poc_device: 'POC Device',
  laptop: 'Laptop',
  printer: 'Printer',
  barcode_scanner: 'Barcode Scanner',
  centrifuge: 'Centrifuge',
  refrigerator: 'Refrigerator',
  other: 'Other',
};

function EquipmentPicker({ value, onChange, catalogItems }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selected = catalogItems.find(i => i.id === value);

  const filtered = catalogItems.filter(item => {
    const q = search.toLowerCase();
    return (
      item.equipment_name?.toLowerCase().includes(q) ||
      item.manufacturer?.toLowerCase().includes(q) ||
      item.model_number?.toLowerCase().includes(q) ||
      EQUIPMENT_TYPE_LABELS[item.equipment_type]?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-left hover:border-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
      >
        {selected ? (
          <div className="min-w-0">
            <span className="text-white text-sm font-medium truncate block">{selected.equipment_name}</span>
            <span className="text-slate-400 text-xs">
              {selected.manufacturer && `${selected.manufacturer} · `}
              {EQUIPMENT_TYPE_LABELS[selected.equipment_type] || selected.equipment_type}
            </span>
          </div>
        ) : (
          <span className="text-slate-500 text-sm">No equipment linked (optional)</span>
        )}
        <ChevronDown className={`w-4 h-4 text-slate-400 flex-shrink-0 ml-2 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-20 overflow-hidden">
          <div className="p-2 border-b border-slate-700/50">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search equipment..."
                autoFocus
                className="w-full pl-8 pr-3 py-2 bg-slate-900 border border-slate-700 rounded text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
          </div>
          <div className="max-h-52 overflow-y-auto">
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false); setSearch(''); }}
              className="w-full text-left px-3 py-2.5 text-slate-400 hover:bg-slate-700 text-sm italic transition-colors"
            >
              None (no equipment linked)
            </button>
            {filtered.length === 0 && (
              <p className="px-3 py-3 text-slate-500 text-sm text-center">No equipment found</p>
            )}
            {filtered.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => { onChange(item.id); setOpen(false); setSearch(''); }}
                className={`w-full text-left px-3 py-2.5 hover:bg-slate-700 transition-colors ${item.id === value ? 'bg-teal-500/15' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <Package className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-white text-sm font-medium truncate">{item.equipment_name}</p>
                    <p className="text-slate-400 text-xs">
                      {item.manufacturer && `${item.manufacturer} · `}
                      {item.model_number && `${item.model_number} · `}
                      {EQUIPMENT_TYPE_LABELS[item.equipment_type] || item.equipment_type}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TrainingMaterialModal({ onClose, onSaved, editing = null }) {
  const isEditing = Boolean(editing);
  const fileInputRef = useRef(null);

  const [catalogItems, setCatalogItems] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);

  const [form, setForm] = useState({
    title: editing?.title || '',
    description: editing?.description || '',
    category: editing?.category || 'equipment',
    material_type: editing?.material_type || 'document',
    video_url: editing?.video_url || '',
    external_link: editing?.external_link || '',
    equipment_catalog_id: editing?.equipment_catalog_id || null,
    tags: editing?.tags?.join(', ') || '',
    is_published: editing?.is_published ?? true,
  });

  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    trainingMaterialsService
      .getEquipmentCatalog()
      .then(data => setCatalogItems(data))
      .catch(console.error)
      .finally(() => setCatalogLoading(false));
  }, []);

  const needsFile = ['video', 'document', 'image', 'presentation'].includes(form.material_type);
  const needsVideoUrl = form.material_type === 'video';
  const needsLink = form.material_type === 'link';

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.title.trim()) {
      setError('Title is required.');
      return;
    }
    if (needsLink && !form.external_link.trim()) {
      setError('External link URL is required for link type.');
      return;
    }
    if (needsVideoUrl && !form.video_url.trim() && !file && !editing?.storage_path) {
      setError('Please provide a video URL or upload a video file.');
      return;
    }

    try {
      setSaving(true);
      let fileData = {};

      if (file) {
        const uploaded = await trainingMaterialsService.uploadFile(file);
        fileData = {
          storage_path: uploaded.path,
          storage_bucket: uploaded.bucket,
          file_name: uploaded.file_name,
          file_size: uploaded.file_size,
          mime_type: uploaded.mime_type,
        };
      }

      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        category: form.category,
        material_type: form.material_type,
        video_url: form.video_url.trim() || null,
        external_link: form.external_link.trim() || null,
        equipment_catalog_id: form.equipment_catalog_id || null,
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        is_published: form.is_published,
        ...fileData,
      };

      if (isEditing) {
        await trainingMaterialsService.update(editing.id, payload);
      } else {
        await trainingMaterialsService.create(payload);
      }

      onSaved();
    } catch (err) {
      setError(err.message || 'Failed to save material.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
          <h2 className="text-lg font-semibold text-white">
            {isEditing ? 'Edit Training Material' : 'Add Training Material'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Title <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. How to Calibrate the Analyzer"
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Package className="w-4 h-4 text-teal-400" />
              Equipment (from Catalog)
            </label>
            {catalogLoading ? (
              <div className="px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-slate-500 text-sm">Loading equipment catalog...</div>
            ) : (
              <EquipmentPicker
                value={form.equipment_catalog_id}
                onChange={id => setForm(f => ({ ...f, equipment_catalog_id: id }))}
                catalogItems={catalogItems}
              />
            )}
            <p className="text-xs text-slate-500 mt-1">Link this material to a specific piece of equipment in the catalog</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Category</label>
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              >
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Material Type</label>
              <select
                value={form.material_type}
                onChange={e => setForm(f => ({ ...f, material_type: e.target.value, video_url: '', external_link: '' }))}
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              >
                {MATERIAL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3}
              placeholder="Describe what this material covers..."
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 resize-none"
            />
          </div>

          {needsVideoUrl && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Video URL</label>
              <input
                type="url"
                value={form.video_url}
                onChange={e => setForm(f => ({ ...f, video_url: e.target.value }))}
                placeholder="https://youtube.com/watch?v=... or https://vimeo.com/..."
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
              <p className="text-xs text-slate-500 mt-1">YouTube, Vimeo, or direct video links supported</p>
            </div>
          )}

          {needsLink && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">External Link URL <span className="text-red-400">*</span></label>
              <input
                type="url"
                value={form.external_link}
                onChange={e => setForm(f => ({ ...f, external_link: e.target.value }))}
                placeholder="https://..."
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
          )}

          {needsFile && (
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                {isEditing ? 'Replace File (optional)' : 'Upload File'}
              </label>
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                  dragOver
                    ? 'border-teal-400 bg-teal-500/10'
                    : 'border-slate-600 hover:border-slate-500 hover:bg-slate-800/50'
                }`}
              >
                <Upload className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                {file ? (
                  <div>
                    <p className="text-white font-medium text-sm">{file.name}</p>
                    <p className="text-slate-400 text-xs mt-1">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-slate-300 text-sm font-medium">Drop file here or click to browse</p>
                    {isEditing && editing?.file_name && (
                      <p className="text-slate-500 text-xs mt-1">Current: {editing.file_name}</p>
                    )}
                    <p className="text-slate-500 text-xs mt-1">Max 100MB</p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={FILE_TYPES[form.material_type]}
                  onChange={e => setFile(e.target.files[0] || null)}
                  className="hidden"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Tags</label>
            <input
              type="text"
              value={form.tags}
              onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
              placeholder="analyzer, calibration, qc (comma-separated)"
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, is_published: !f.is_published }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${form.is_published ? 'bg-teal-500' : 'bg-slate-600'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.is_published ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
            <label className="text-sm text-slate-300">
              {form.is_published ? 'Published — visible to all users' : 'Draft — only visible to admins'}
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-700/50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg transition-colors text-sm font-medium"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Material'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
