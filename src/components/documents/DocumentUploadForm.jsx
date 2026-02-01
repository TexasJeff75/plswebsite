import React, { useState } from 'react';
import { Upload, X, FileText, File } from 'lucide-react';

const DOCUMENT_TYPES = [
  { value: 'manual', label: 'Manual' },
  { value: 'specification', label: 'Specification' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'report', label: 'Report' },
  { value: 'training_material', label: 'Training Material' },
  { value: 'regulatory', label: 'Regulatory Document' },
  { value: 'clia_certificate', label: 'CLIA Certificate' },
  { value: 'lab_director_agreement', label: 'Lab Director Agreement' },
  { value: 'implementation_acknowledgment', label: 'Implementation Acknowledgment' },
  { value: 'training_record', label: 'Training Record' },
  { value: 'competency_assessment', label: 'Competency Assessment' },
  { value: 'pt_report', label: 'PT Report' },
  { value: 'image', label: 'Image' },
  { value: 'other', label: 'Other' },
];

export default function DocumentUploadForm({ onUpload, uploading = false, defaultType = 'other' }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [formData, setFormData] = useState({
    document_type: defaultType,
    document_name: '',
    description: '',
    version: '',
    expiration_date: '',
    tags: '',
  });

  function handleFileSelect(file) {
    if (!file) {
      setSelectedFile(null);
      setFilePreview(null);
      return;
    }

    setSelectedFile(file);

    if (!formData.document_name) {
      setFormData(prev => ({ ...prev, document_name: file.name }));
    }

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFilePreview({
          type: 'image',
          url: e.target.result,
          name: file.name,
          size: formatFileSize(file.size),
          mimeType: file.type
        });
      };
      reader.readAsDataURL(file);
    } else if (file.type === 'application/pdf') {
      setFilePreview({
        type: 'pdf',
        name: file.name,
        size: formatFileSize(file.size),
        mimeType: file.type
      });
    } else {
      setFilePreview({
        type: 'file',
        name: file.name,
        size: formatFileSize(file.size),
        mimeType: file.type
      });
    }
  }

  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function clearFileSelection() {
    setSelectedFile(null);
    setFilePreview(null);
  }

  function handleChange(field, value) {
    setFormData(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedFile) return;

    const metadata = {
      ...formData,
      tags: formData.tags ? formData.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      expiration_date: formData.expiration_date || null,
    };

    await onUpload(selectedFile, metadata);

    setSelectedFile(null);
    setFilePreview(null);
    setFormData({
      document_type: defaultType,
      document_name: '',
      description: '',
      version: '',
      expiration_date: '',
      tags: '',
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-slate-400 text-sm mb-2 block">Document Name *</label>
        <input
          type="text"
          value={formData.document_name}
          onChange={(e) => handleChange('document_name', e.target.value)}
          placeholder="Enter document name"
          required
          disabled={uploading}
          className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 disabled:opacity-50"
        />
      </div>

      <div>
        <label className="text-slate-400 text-sm mb-2 block">Document Type *</label>
        <select
          value={formData.document_type}
          onChange={(e) => handleChange('document_type', e.target.value)}
          required
          disabled={uploading}
          className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 disabled:opacity-50"
        >
          {DOCUMENT_TYPES.map(type => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-slate-400 text-sm mb-2 block">Description</label>
        <textarea
          value={formData.description}
          onChange={(e) => handleChange('description', e.target.value)}
          placeholder="Enter document description"
          rows={3}
          disabled={uploading}
          className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 disabled:opacity-50 resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-slate-400 text-sm mb-2 block">Version</label>
          <input
            type="text"
            value={formData.version}
            onChange={(e) => handleChange('version', e.target.value)}
            placeholder="e.g., 1.0, Rev A"
            disabled={uploading}
            className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 disabled:opacity-50"
          />
        </div>

        <div>
          <label className="text-slate-400 text-sm mb-2 block">Expiration Date</label>
          <input
            type="date"
            value={formData.expiration_date}
            onChange={(e) => handleChange('expiration_date', e.target.value)}
            disabled={uploading}
            className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 disabled:opacity-50"
          />
        </div>
      </div>

      <div>
        <label className="text-slate-400 text-sm mb-2 block">Tags (comma-separated)</label>
        <input
          type="text"
          value={formData.tags}
          onChange={(e) => handleChange('tags', e.target.value)}
          placeholder="e.g., important, review, draft"
          disabled={uploading}
          className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 disabled:opacity-50"
        />
      </div>

      <div>
        <label className="text-slate-400 text-sm mb-2 block">File *</label>
        {!filePreview ? (
          <div className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center hover:border-teal-500 transition-colors">
            <input
              type="file"
              onChange={(e) => handleFileSelect(e.target.files?.[0])}
              disabled={uploading}
              className="hidden"
              id="document-file-upload"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.jpg,.jpeg,.png,.gif,.webp"
            />
            <label htmlFor="document-file-upload" className="cursor-pointer">
              <Upload className="w-10 h-10 text-slate-500 mx-auto mb-3" />
              <p className="text-slate-300 font-semibold">Click to upload or drag and drop</p>
              <p className="text-slate-500 text-sm mt-1">PDF, Word, Excel, Images up to 50MB</p>
            </label>
          </div>
        ) : (
          <div className="border border-slate-600 rounded-lg p-4 bg-slate-700/50">
            <div className="flex gap-4">
              {filePreview.type === 'image' ? (
                <div className="w-32 h-32 rounded-lg overflow-hidden flex-shrink-0 bg-slate-800">
                  <img
                    src={filePreview.url}
                    alt={filePreview.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-32 h-32 rounded-lg flex-shrink-0 bg-slate-800 flex items-center justify-center">
                  {filePreview.type === 'pdf' ? (
                    <div className="text-center">
                      <FileText className="w-12 h-12 text-red-400 mx-auto" />
                      <span className="text-xs text-red-400 font-semibold mt-1 block">PDF</span>
                    </div>
                  ) : (
                    <div className="text-center">
                      <File className="w-12 h-12 text-slate-400 mx-auto" />
                      <span className="text-xs text-slate-400 font-semibold mt-1 block">
                        {filePreview.name.split('.').pop()?.toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h5 className="text-white font-semibold truncate mb-2">{filePreview.name}</h5>
                <div className="space-y-1 text-sm">
                  <p className="text-slate-400">
                    <span className="text-slate-500">Size:</span> {filePreview.size}
                  </p>
                  <p className="text-slate-400">
                    <span className="text-slate-500">Type:</span> {filePreview.mimeType}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={clearFileSelection}
                  className="mt-3 flex items-center gap-1 text-red-400 hover:text-red-300 text-sm transition-colors"
                >
                  <X className="w-4 h-4" />
                  Remove file
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={!selectedFile || !formData.document_name || uploading}
        className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-slate-600 text-white py-2 rounded font-medium transition-colors"
      >
        {uploading ? 'Uploading...' : 'Upload Document'}
      </button>
    </form>
  );
}
