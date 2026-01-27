import React, { useState, useEffect } from 'react';
import { FileText, Download, Trash2, AlertTriangle } from 'lucide-react';
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
  const [selectedType, setSelectedType] = useState('other');
  const [expirationDate, setExpirationDate] = useState('');

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
      setSelectedType('other');
      setExpirationDate('');
    } catch (error) {
      console.error('Error uploading document:', error);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(docId, fileUrl) {
    if (window.confirm('Are you sure you want to delete this document?')) {
      try {
        await documentService.deleteDocument(docId, fileUrl);
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
              <div className="border-2 border-dashed border-slate-600 rounded-lg p-6 text-center hover:border-teal-500 transition-colors">
                <input
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files?.[0])}
                  disabled={uploading}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <p className="text-slate-300 font-semibold">Click to upload or drag and drop</p>
                  <p className="text-slate-500 text-sm mt-1">{selectedFile?.name || 'No file selected'}</p>
                </label>
              </div>
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
          <div className="space-y-2">
            {documents.map(doc => (
              <div
                key={doc.id}
                className="bg-slate-700 p-4 rounded flex justify-between items-start gap-4 hover:bg-slate-600 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="w-4 h-4 text-teal-400 flex-shrink-0" />
                    <h5 className="text-white font-semibold truncate">{doc.name}</h5>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                    <span className="bg-slate-600 px-2 py-1 rounded">
                      {TYPE_LABELS[doc.type] || doc.type}
                    </span>
                    <span>Uploaded: {new Date(doc.created_at).toLocaleDateString()}</span>
                    {doc.expiration_date && (
                      <span className={doc.expiration_date && new Date(doc.expiration_date) < new Date() ? 'text-red-400' : 'text-slate-400'}>
                        Expires: {new Date(doc.expiration_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
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
                      onClick={() => handleDelete(doc.id, doc.url)}
                      className="text-red-400 hover:text-red-300 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
