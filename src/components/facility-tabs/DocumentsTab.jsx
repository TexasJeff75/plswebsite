import React, { useState, useEffect, useMemo } from 'react';
import { FileText, Download, Trash2, AlertTriangle, Upload, X, Image, File, Eye } from 'lucide-react';
import { documentService } from '../../services/documentService';
import { useAuth } from '../../contexts/AuthContext';

const DOCUMENT_TYPES = [
  'clia_certificate',
  'lab_director_agreement',
  'implementation_acknowledgment',
  'training_record',
  'competency_assessment',
  'pt_report',
  'other',
];

const TYPE_LABELS = {
  clia_certificate: 'CLIA Certificate',
  lab_director_agreement: 'Lab Director Agreement',
  implementation_acknowledgment: 'Implementation Acknowledgment',
  training_record: 'Training Record',
  competency_assessment: 'Competency Assessment',
  pt_report: 'PT Report',
  other: 'Other',
};

export default function DocumentsTab({ facility, isEditor }) {
  const { user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [selectedType, setSelectedType] = useState('other');
  const [expirationDate, setExpirationDate] = useState('');
  const [previewDoc, setPreviewDoc] = useState(null);

  useEffect(() => {
    loadDocuments();
  }, [facility?.id]);

  async function loadDocuments() {
    try {
      setLoading(true);
      const docs = await documentService.getByFacilityId(facility.id);
      setDocuments(docs);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleFileSelect(file) {
    if (!file) {
      setSelectedFile(null);
      setFilePreview(null);
      return;
    }

    setSelectedFile(file);

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

  async function handleUpload(e) {
    e.preventDefault();
    if (!selectedFile) return;

    try {
      setUploading(true);
      const doc = await documentService.uploadDocument(facility.id, selectedFile, {
        type: selectedType,
        userId: user?.id,
        expirationDate: expirationDate || null,
      });
      setDocuments([doc, ...documents]);
      setSelectedFile(null);
      setFilePreview(null);
      setSelectedType('other');
      setExpirationDate('');
    } catch (error) {
      console.error('Error uploading document:', error);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(docId, storagePath) {
    if (window.confirm('Are you sure you want to delete this document?')) {
      try {
        await documentService.deleteDocument(docId, storagePath);
        setDocuments(documents.filter(d => d.id !== docId));
      } catch (error) {
        console.error('Error deleting document:', error);
      }
    }
  }

  const expiringDocs = documentService.getExpiringDocuments(documents, 30);
  const expiredDocs = documents.filter(d => documentService.isExpired(d));

  if (loading) {
    return <div className="text-slate-400">Loading documents...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <FileText className="w-5 h-5 text-teal-400" />
        <h3 className="text-lg font-semibold text-white">Document Management</h3>
      </div>

      {/* Upload Section */}
      {isEditor && (
        <div className="bg-slate-800 rounded-lg p-6 space-y-4">
          <h4 className="text-white font-semibold">Upload Document</h4>
          <form onSubmit={handleUpload} className="space-y-3">
            <div>
              <label className="text-slate-400 text-sm mb-2 block">Document Type</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600"
              >
                {DOCUMENT_TYPES.map(type => (
                  <option key={type} value={type}>{TYPE_LABELS[type]}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-slate-400 text-sm mb-2 block">File</label>
              {!filePreview ? (
                <div className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center hover:border-teal-500 transition-colors">
                  <input
                    type="file"
                    onChange={(e) => handleFileSelect(e.target.files?.[0])}
                    disabled={uploading}
                    className="hidden"
                    id="file-upload"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.jpg,.jpeg,.png,.gif"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
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

            <div>
              <label className="text-slate-400 text-sm mb-2 block">Expiration Date (Optional)</label>
              <input
                type="date"
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
                disabled={uploading}
                className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 disabled:opacity-50"
              />
            </div>

            <button
              type="submit"
              disabled={!selectedFile || uploading}
              className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-slate-600 text-white py-2 rounded font-medium transition-colors"
            >
              {uploading ? 'Uploading...' : 'Upload Document'}
            </button>
          </form>
        </div>
      )}

      {/* Expiration Warnings */}
      {expiredDocs.length > 0 && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-red-200 font-semibold mb-2">Expired Documents</h4>
              <ul className="space-y-1">
                {expiredDocs.map(doc => (
                  <li key={doc.id} className="text-red-300 text-sm">
                    {doc.name} (Expired: {new Date(doc.expiration_date).toLocaleDateString()})
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {expiringDocs.length > 0 && expiredDocs.length === 0 && (
        <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-yellow-200 font-semibold mb-2">Documents Expiring Soon (30 Days)</h4>
              <ul className="space-y-1">
                {expiringDocs.map(doc => (
                  <li key={doc.id} className="text-yellow-300 text-sm">
                    {doc.name} (Expires: {new Date(doc.expiration_date).toLocaleDateString()})
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Documents List */}
      <div className="bg-slate-800 rounded-lg p-6 space-y-4">
        <h4 className="text-white font-semibold">Documents</h4>
        {documents.length === 0 ? (
          <p className="text-slate-400 text-center py-8">No documents uploaded yet</p>
        ) : (
          <div className="grid gap-3">
            {documents.map(doc => {
              const isImage = doc.name?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
              const isPdf = doc.name?.match(/\.pdf$/i);

              return (
                <div
                  key={doc.id}
                  className="bg-slate-700 p-4 rounded-lg hover:bg-slate-600/80 transition-colors"
                >
                  <div className="flex gap-4">
                    {isImage && doc.url ? (
                      <div
                        className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-slate-800 cursor-pointer"
                        onClick={() => setPreviewDoc(doc)}
                      >
                        <img
                          src={doc.url}
                          alt={doc.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-lg flex-shrink-0 bg-slate-800 flex items-center justify-center">
                        {isPdf ? (
                          <div className="text-center">
                            <FileText className="w-8 h-8 text-red-400 mx-auto" />
                            <span className="text-xs text-red-400 font-semibold">PDF</span>
                          </div>
                        ) : (
                          <div className="text-center">
                            <File className="w-8 h-8 text-slate-400 mx-auto" />
                            <span className="text-xs text-slate-400 font-semibold">
                              {doc.name?.split('.').pop()?.toUpperCase() || 'FILE'}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h5 className="text-white font-semibold truncate mb-1">{doc.name}</h5>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="bg-slate-600 px-2 py-1 rounded text-slate-300">
                          {TYPE_LABELS[doc.type] || doc.type}
                        </span>
                        <span className="text-slate-400 py-1">
                          {new Date(doc.created_at).toLocaleDateString()}
                        </span>
                        {doc.expiration_date && (
                          <span className={`py-1 ${new Date(doc.expiration_date) < new Date() ? 'text-red-400' : 'text-slate-400'}`}>
                            Expires: {new Date(doc.expiration_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0 items-start">
                      {isImage && doc.url && (
                        <button
                          onClick={() => setPreviewDoc(doc)}
                          className="text-slate-400 hover:text-white transition-colors"
                          title="Preview"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                      )}
                      {doc.url && (
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-teal-400 hover:text-teal-300 transition-colors"
                          title="Download"
                        >
                          <Download className="w-5 h-5" />
                        </a>
                      )}
                      {isEditor && (
                        <button
                          onClick={() => handleDelete(doc.id, doc.storage_path)}
                          className="text-red-400 hover:text-red-300 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Image Preview Modal */}
      {previewDoc && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewDoc(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full">
            <button
              onClick={() => setPreviewDoc(null)}
              className="absolute -top-12 right-0 text-white hover:text-slate-300 transition-colors"
            >
              <X className="w-8 h-8" />
            </button>
            <div className="bg-slate-800 rounded-lg overflow-hidden">
              <img
                src={previewDoc.url}
                alt={previewDoc.name}
                className="w-full h-auto max-h-[80vh] object-contain"
                onClick={(e) => e.stopPropagation()}
              />
              <div className="p-4 border-t border-slate-700">
                <h5 className="text-white font-semibold">{previewDoc.name}</h5>
                <p className="text-slate-400 text-sm mt-1">
                  {TYPE_LABELS[previewDoc.type] || previewDoc.type} - Uploaded {new Date(previewDoc.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
