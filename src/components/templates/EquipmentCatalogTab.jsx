import React, { useState, useEffect } from 'react';
import { templatesService } from '../../services/templatesService';
import { equipmentCatalogDocumentService } from '../../services/equipmentCatalogDocumentService';
import {
  Plus, Pencil, Trash2, X, ChevronDown, Check, Loader2, FileText, Upload, Download, Eye, ChevronRight
} from 'lucide-react';

const EQUIPMENT_TYPES = [
  { id: 'analyzer', label: 'Analyzer' },
  { id: 'poc_device', label: 'POC Device' },
  { id: 'laptop', label: 'Laptop' },
  { id: 'printer', label: 'Printer' },
  { id: 'barcode_scanner', label: 'Barcode Scanner' },
  { id: 'centrifuge', label: 'Centrifuge' },
  { id: 'refrigerator', label: 'Refrigerator' },
  { id: 'other', label: 'Other' },
];

const PROCUREMENT_METHODS = [
  { id: 'purchase', label: 'Purchase' },
  { id: 'reagent_rental', label: 'Reagent Rental' },
  { id: 'lease', label: 'Lease' },
  { id: 'client_provided', label: 'Client Provided' },
];

const DOCUMENT_TYPES = [
  { id: 'manual', label: 'User Manual' },
  { id: 'specification', label: 'Technical Specification' },
  { id: 'installation_guide', label: 'Installation Guide' },
  { id: 'maintenance_schedule', label: 'Maintenance Schedule' },
  { id: 'sds', label: 'Safety Data Sheet' },
  { id: 'other', label: 'Other' },
];

const COMPLEXITY_LEVELS = [
  'CLIA Waived',
  'Moderate Complexity',
  'High Complexity'
];

export default function EquipmentCatalogTab() {
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    equipment_name: '',
    equipment_type: 'analyzer',
    manufacturer: '',
    model_number: '',
    procurement_method_default: 'purchase',
    applicable_complexity_levels: ['CLIA Waived', 'Moderate Complexity', 'High Complexity'],
    complexity_specific_notes: '',
    notes: ''
  });
  const [saving, setSaving] = useState(false);

  // Document management state
  const [showDocumentsModal, setShowDocumentsModal] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [documentCounts, setDocumentCounts] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const data = await templatesService.getEquipmentCatalog();
      setEquipment(data);

      // Load document counts for each equipment
      const counts = {};
      await Promise.all(data.map(async (item) => {
        try {
          const docs = await equipmentCatalogDocumentService.getDocuments(item.id);
          counts[item.id] = docs.length;
        } catch (error) {
          console.error('Error loading document count:', error);
          counts[item.id] = 0;
        }
      }));
      setDocumentCounts(counts);
    } catch (error) {
      console.error('Error loading equipment catalog:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadDocuments(equipmentId) {
    setLoadingDocuments(true);
    try {
      const docs = await equipmentCatalogDocumentService.getDocuments(equipmentId);
      setDocuments(docs);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoadingDocuments(false);
    }
  }

  function openDocumentsModal(item) {
    setSelectedEquipment(item);
    setShowDocumentsModal(true);
    loadDocuments(item.id);
  }

  async function handleDocumentUpload(file, documentInfo) {
    if (!selectedEquipment || !file) return;

    setUploadingDocument(true);
    try {
      await equipmentCatalogDocumentService.uploadDocument(
        selectedEquipment.id,
        file,
        documentInfo
      );

      // Reload documents and update count
      loadDocuments(selectedEquipment.id);
      const docs = await equipmentCatalogDocumentService.getDocuments(selectedEquipment.id);
      setDocumentCounts(prev => ({ ...prev, [selectedEquipment.id]: docs.length }));
    } catch (error) {
      console.error('Error uploading document:', error);
      alert('Failed to upload document. Please try again.');
    } finally {
      setUploadingDocument(false);
    }
  }

  async function handleDownloadDocument(doc) {
    try {
      const url = await equipmentCatalogDocumentService.getDocumentUrl(doc.storage_path);
      window.open(url, '_blank');
    } catch (error) {
      console.error('Error downloading document:', error);
      alert('Failed to download document. Please try again.');
    }
  }

  async function handleDeleteDocument(docId) {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      await equipmentCatalogDocumentService.deleteDocument(docId);
      loadDocuments(selectedEquipment.id);
      const docs = await equipmentCatalogDocumentService.getDocuments(selectedEquipment.id);
      setDocumentCounts(prev => ({ ...prev, [selectedEquipment.id]: docs.length }));
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Failed to delete document. Please try again.');
    }
  }

  function openCreateModal() {
    setEditingItem(null);
    setFormData({
      equipment_name: '',
      equipment_type: 'analyzer',
      manufacturer: '',
      model_number: '',
      procurement_method_default: 'purchase',
      applicable_complexity_levels: ['CLIA Waived', 'Moderate Complexity', 'High Complexity'],
      complexity_specific_notes: '',
      notes: ''
    });
    setShowModal(true);
  }

  function openEditModal(item) {
    setEditingItem(item);
    setFormData({
      equipment_name: item.equipment_name,
      equipment_type: item.equipment_type,
      manufacturer: item.manufacturer || '',
      model_number: item.model_number || '',
      procurement_method_default: item.procurement_method_default || 'purchase',
      applicable_complexity_levels: item.applicable_complexity_levels || ['CLIA Waived', 'Moderate Complexity', 'High Complexity'],
      complexity_specific_notes: item.complexity_specific_notes || '',
      notes: item.notes || ''
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!formData.equipment_name.trim()) return;

    setSaving(true);
    try {
      if (editingItem) {
        await templatesService.updateEquipmentCatalogItem(editingItem.id, formData);
      } else {
        await templatesService.createEquipmentCatalogItem({
          ...formData,
          is_system_item: true
        });
      }

      setShowModal(false);
      loadData();
    } catch (error) {
      console.error('Error saving equipment:', error);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item) {
    if (!confirm(`Delete "${item.equipment_name}" from catalog?`)) return;

    try {
      await templatesService.deleteEquipmentCatalogItem(item.id);
      loadData();
    } catch (error) {
      console.error('Error deleting equipment:', error);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-teal-400 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-slate-400 text-sm">{equipment.length} item{equipment.length !== 1 ? 's' : ''} in catalog</p>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-slate-900 font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Equipment
          </button>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Type</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Manufacturer</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Model</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Complexity Levels</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Default Procurement</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Documents</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {equipment.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-12 text-center text-slate-400">
                    No equipment in catalog yet. Add some to get started.
                  </td>
                </tr>
              ) : (
                equipment.map(item => (
                  <tr key={item.id} className="hover:bg-slate-700/20">
                    <td className="px-4 py-3">
                      <p className="text-white font-medium">{item.equipment_name}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${getTypeStyle(item.equipment_type)}`}>
                        {EQUIPMENT_TYPES.find(t => t.id === item.equipment_type)?.label || item.equipment_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {item.manufacturer || '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-sm">
                      {item.model_number || '-'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(item.applicable_complexity_levels || ['CLIA Waived', 'Moderate Complexity', 'High Complexity']).map(level => (
                          <span key={level} className={`px-2 py-0.5 text-xs rounded-full ${
                            level === 'CLIA Waived' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                            level === 'Moderate Complexity' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                            'bg-red-500/20 text-red-400 border border-red-500/30'
                          }`}>
                            {level === 'CLIA Waived' ? 'Waived' : level === 'Moderate Complexity' ? 'Moderate' : 'High'}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {PROCUREMENT_METHODS.find(p => p.id === item.procurement_method_default)?.label || item.procurement_method_default}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center">
                        <button
                          onClick={() => openDocumentsModal(item)}
                          className="flex items-center gap-2 px-3 py-1.5 text-sm text-teal-400 hover:text-teal-300 hover:bg-slate-700/50 rounded-lg transition-colors"
                          title="Manage Documents"
                        >
                          <FileText className="w-4 h-4" />
                          <span>{documentCounts[item.id] || 0}</span>
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(item)}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
                          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-white">
                {editingItem ? 'Edit Equipment' : 'Add Equipment to Catalog'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Name</label>
                <input
                  type="text"
                  value={formData.equipment_name}
                  onChange={(e) => setFormData({ ...formData, equipment_name: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500"
                  placeholder="Equipment name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Type</label>
                  <div className="relative">
                    <select
                      value={formData.equipment_type}
                      onChange={(e) => setFormData({ ...formData, equipment_type: e.target.value })}
                      className="w-full px-4 py-2 pr-10 bg-slate-900 border border-slate-700 rounded-lg text-white appearance-none focus:outline-none focus:border-teal-500"
                    >
                      {EQUIPMENT_TYPES.map(type => (
                        <option key={type.id} value={type.id}>{type.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Default Procurement</label>
                  <div className="relative">
                    <select
                      value={formData.procurement_method_default}
                      onChange={(e) => setFormData({ ...formData, procurement_method_default: e.target.value })}
                      className="w-full px-4 py-2 pr-10 bg-slate-900 border border-slate-700 rounded-lg text-white appearance-none focus:outline-none focus:border-teal-500"
                    >
                      {PROCUREMENT_METHODS.map(method => (
                        <option key={method.id} value={method.id}>{method.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Manufacturer</label>
                  <input
                    type="text"
                    value={formData.manufacturer}
                    onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500"
                    placeholder="e.g. Abbott"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Model Number</label>
                  <input
                    type="text"
                    value={formData.model_number}
                    onChange={(e) => setFormData({ ...formData, model_number: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500"
                    placeholder="e.g. i-STAT 1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Applicable Complexity Levels</label>
                <div className="space-y-2 bg-slate-900 border border-slate-700 rounded-lg p-3">
                  {COMPLEXITY_LEVELS.map(level => (
                    <label key={level} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.applicable_complexity_levels.includes(level)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({
                              ...formData,
                              applicable_complexity_levels: [...formData.applicable_complexity_levels, level]
                            });
                          } else {
                            setFormData({
                              ...formData,
                              applicable_complexity_levels: formData.applicable_complexity_levels.filter(l => l !== level)
                            });
                          }
                        }}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-teal-500 focus:ring-teal-500 focus:ring-offset-0"
                      />
                      <span className={`text-sm ${
                        level === 'CLIA Waived' ? 'text-green-400' :
                        level === 'Moderate Complexity' ? 'text-yellow-400' :
                        'text-red-400'
                      }`}>
                        {level}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Complexity Specific Notes</label>
                <textarea
                  value={formData.complexity_specific_notes}
                  onChange={(e) => setFormData({ ...formData, complexity_specific_notes: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500 resize-none"
                  rows={2}
                  placeholder="Notes about complexity-specific requirements"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-teal-500 resize-none"
                  rows={2}
                  placeholder="Optional notes"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-700">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-slate-300 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!formData.equipment_name.trim() || saving}
                className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-slate-900 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    {editingItem ? 'Save Changes' : 'Add to Catalog'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Documents Modal */}
      {showDocumentsModal && selectedEquipment && (
        <DocumentsModal
          equipment={selectedEquipment}
          documents={documents}
          loading={loadingDocuments}
          uploading={uploadingDocument}
          onClose={() => {
            setShowDocumentsModal(false);
            setSelectedEquipment(null);
            setDocuments([]);
          }}
          onUpload={handleDocumentUpload}
          onDownload={handleDownloadDocument}
          onDelete={handleDeleteDocument}
        />
      )}
    </>
  );
}

function DocumentsModal({ equipment, documents, loading, uploading, onClose, onUpload, onDownload, onDelete }) {
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadFormData, setUploadFormData] = useState({
    document_name: '',
    document_type: 'manual',
    description: '',
    version: ''
  });

  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setUploadFormData(prev => ({
        ...prev,
        document_name: file.name
      }));
    }
  }

  async function handleUpload() {
    if (!selectedFile) return;

    await onUpload(selectedFile, uploadFormData);
    setShowUploadForm(false);
    setSelectedFile(null);
    setUploadFormData({
      document_name: '',
      document_type: 'manual',
      description: '',
      version: ''
    });
  }

  function formatFileSize(bytes) {
    if (!bytes) return 'Unknown';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div>
            <h2 className="text-lg font-semibold text-white">Reference Documents</h2>
            <p className="text-sm text-slate-400 mt-0.5">{equipment.equipment_name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Upload Button */}
          {!showUploadForm && (
            <button
              onClick={() => setShowUploadForm(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 mb-4 border-2 border-dashed border-slate-600 hover:border-teal-500 text-slate-400 hover:text-teal-400 rounded-lg transition-colors"
            >
              <Upload className="w-5 h-5" />
              <span>Upload Document</span>
            </button>
          )}

          {/* Upload Form */}
          {showUploadForm && (
            <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 mb-4">
              <h3 className="text-white font-medium mb-4">Upload New Document</h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">File</label>
                  <input
                    type="file"
                    onChange={handleFileSelect}
                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:bg-teal-500 file:text-slate-900 hover:file:bg-teal-600"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
                  />
                  {selectedFile && (
                    <p className="text-xs text-slate-400 mt-1">
                      Selected: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Document Name</label>
                    <input
                      type="text"
                      value={uploadFormData.document_name}
                      onChange={(e) => setUploadFormData({ ...uploadFormData, document_name: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                      placeholder="Document name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Type</label>
                    <select
                      value={uploadFormData.document_type}
                      onChange={(e) => setUploadFormData({ ...uploadFormData, document_type: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                    >
                      {DOCUMENT_TYPES.map(type => (
                        <option key={type.id} value={type.id}>{type.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Version (Optional)</label>
                  <input
                    type="text"
                    value={uploadFormData.version}
                    onChange={(e) => setUploadFormData({ ...uploadFormData, version: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                    placeholder="e.g., v1.0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Description (Optional)</label>
                  <textarea
                    value={uploadFormData.description}
                    onChange={(e) => setUploadFormData({ ...uploadFormData, description: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm resize-none"
                    rows={2}
                    placeholder="Brief description"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={() => {
                      setShowUploadForm(false);
                      setSelectedFile(null);
                      setUploadFormData({
                        document_name: '',
                        document_type: 'manual',
                        description: '',
                        version: ''
                      });
                    }}
                    className="px-4 py-2 text-slate-300 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg transition-colors text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpload}
                    disabled={!selectedFile || !uploadFormData.document_name || uploading}
                    className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-slate-900 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        Upload
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Documents List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-teal-400 animate-spin" />
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No documents uploaded yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map(doc => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-4 bg-slate-900/50 border border-slate-700 rounded-lg hover:bg-slate-900 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="w-4 h-4 text-teal-400 flex-shrink-0" />
                      <p className="text-white font-medium truncate">{doc.document_name}</p>
                      {doc.version && (
                        <span className="px-2 py-0.5 bg-slate-700 text-slate-300 text-xs rounded">
                          {doc.version}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span>{DOCUMENT_TYPES.find(t => t.id === doc.document_type)?.label || doc.document_type}</span>
                      <span>•</span>
                      <span>{formatFileSize(doc.file_size)}</span>
                      <span>•</span>
                      <span>{new Date(doc.upload_date).toLocaleDateString()}</span>
                    </div>
                    {doc.description && (
                      <p className="text-sm text-slate-400 mt-1">{doc.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => onDownload(doc)}
                      className="p-2 text-slate-400 hover:text-teal-400 hover:bg-slate-700 rounded-lg transition-colors"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDelete(doc.id)}
                      className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getTypeStyle(type) {
  const styles = {
    analyzer: 'bg-blue-500/10 text-blue-400',
    poc_device: 'bg-teal-500/10 text-teal-400',
    laptop: 'bg-slate-500/10 text-slate-300',
    printer: 'bg-amber-500/10 text-amber-400',
    barcode_scanner: 'bg-cyan-500/10 text-cyan-400',
    centrifuge: 'bg-emerald-500/10 text-emerald-400',
    refrigerator: 'bg-sky-500/10 text-sky-400',
    other: 'bg-slate-500/10 text-slate-400'
  };
  return styles[type] || styles.other;
}
