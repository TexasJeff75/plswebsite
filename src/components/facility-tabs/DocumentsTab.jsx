import React, { useState, useEffect } from 'react';
import { FileText, Download, Trash2, AlertTriangle, Eye, Archive, RefreshCw, Book } from 'lucide-react';
import { unifiedDocumentService } from '../../services/unifiedDocumentService';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useOrganization } from '../../contexts/OrganizationContext';
import DocumentUploadForm from '../documents/DocumentUploadForm';
import DocumentViewer from '../documents/DocumentViewer';

const TYPE_LABELS = {
  clia_certificate: 'CLIA Certificate',
  lab_director_agreement: 'Lab Director Agreement',
  implementation_acknowledgment: 'Implementation Acknowledgment',
  training_record: 'Training Record',
  competency_assessment: 'Competency Assessment',
  pt_report: 'PT Report',
  manual: 'Manual',
  specification: 'Specification',
  certificate: 'Certificate',
  report: 'Report',
  training_material: 'Training Material',
  regulatory: 'Regulatory Document',
  image: 'Image',
  other: 'Other',
};

export default function DocumentsTab({ facility, isEditor }) {
  const { user } = useAuth();
  const { selectedOrganization } = useOrganization();
  const [documents, setDocuments] = useState([]);
  const [equipmentRefDocs, setEquipmentRefDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [viewingDoc, setViewingDoc] = useState(null);
  const [replacingDoc, setReplacingDoc] = useState(null);

  useEffect(() => {
    loadDocuments();
  }, [facility?.id]);

  async function loadDocuments() {
    try {
      setLoading(true);

      const [facilityDocs, refDocs] = await Promise.all([
        unifiedDocumentService.getDocuments('facility', facility.id),
        loadEquipmentReferenceDocs()
      ]);

      setDocuments(facilityDocs);
      setEquipmentRefDocs(refDocs);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadEquipmentReferenceDocs() {
    try {
      const { data, error } = await supabase
        .from('unified_documents')
        .select('*')
        .eq('entity_type', 'equipment_catalog')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error loading equipment reference documents:', error);
      return [];
    }
  }

  async function handleUpload(file, metadata) {
    try {
      setUploading(true);

      if (replacingDoc) {
        await unifiedDocumentService.replaceDocument(
          replacingDoc.id,
          'facility',
          facility.id,
          file,
          {
            ...metadata,
            organization_id: selectedOrganization?.id,
          }
        );
        setReplacingDoc(null);
      } else {
        await unifiedDocumentService.uploadDocument(
          'facility',
          facility.id,
          file,
          {
            ...metadata,
            organization_id: selectedOrganization?.id,
          }
        );
      }

      await loadDocuments();
    } catch (error) {
      console.error('Error uploading document:', error);
      alert('Failed to upload document: ' + error.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleView(doc) {
    try {
      const url = await unifiedDocumentService.getDocumentUrl(doc.storage_bucket, doc.storage_path);
      setViewingDoc({ ...doc, signedUrl: url });
    } catch (error) {
      console.error('Error getting document URL:', error);
      alert('Failed to load document preview');
    }
  }

  async function handleDownload(doc) {
    try {
      const url = await unifiedDocumentService.getDocumentUrl(doc.storage_bucket, doc.storage_path);
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.document_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading document:', error);
      alert('Failed to download document');
    }
  }

  async function handleRetire(doc) {
    if (!window.confirm(`Are you sure you want to retire "${doc.document_name}"? It will no longer be active but will remain in the system for audit purposes.`)) {
      return;
    }

    const reason = window.prompt('Enter reason for retiring this document (optional):');
    if (reason === null) return;

    try {
      await unifiedDocumentService.retireDocument(doc.id, reason || 'Retired by user');
      await loadDocuments();
    } catch (error) {
      console.error('Error retiring document:', error);
      alert('Failed to retire document');
    }
  }

  async function handleDelete(doc) {
    if (!window.confirm(`Are you sure you want to permanently delete "${doc.document_name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await unifiedDocumentService.deleteDocument(doc.id);
      await loadDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Failed to delete document');
    }
  }

  function isExpired(doc) {
    return doc.expiration_date && new Date(doc.expiration_date) < new Date();
  }

  function isExpiringSoon(doc) {
    if (!doc.expiration_date) return false;
    const expDate = new Date(doc.expiration_date);
    const today = new Date();
    const daysDiff = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
    return daysDiff > 0 && daysDiff <= 30;
  }

  const expiringDocs = documents.filter(isExpiringSoon);
  const expiredDocs = documents.filter(isExpired);
  const activeDocuments = documents.filter(d => d.status === 'active');
  const retiredDocuments = documents.filter(d => d.status === 'retired');

  if (loading) {
    return <div className="text-slate-400">Loading documents...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <FileText className="w-5 h-5 text-teal-400" />
        <h3 className="text-lg font-semibold text-white">Document Management</h3>
      </div>

      {isEditor && (
        <div className="bg-slate-800 rounded-lg p-6 space-y-4">
          <h4 className="text-white font-semibold">
            {replacingDoc ? `Replace: ${replacingDoc.document_name}` : 'Upload Document'}
          </h4>
          {replacingDoc && (
            <button
              onClick={() => setReplacingDoc(null)}
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              Cancel replacement
            </button>
          )}
          <DocumentUploadForm
            onUpload={handleUpload}
            uploading={uploading}
            defaultType={replacingDoc?.document_type || 'other'}
          />
        </div>
      )}

      {expiredDocs.length > 0 && (
        <div className="bg-red-900/30 border border-red-700 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-red-200 font-semibold mb-2">Expired Documents</h4>
              <ul className="space-y-1">
                {expiredDocs.map(doc => (
                  <li key={doc.id} className="text-red-300 text-sm">
                    {doc.document_name} (Expired: {new Date(doc.expiration_date).toLocaleDateString()})
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
                    {doc.document_name} (Expires: {new Date(doc.expiration_date).toLocaleDateString()})
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="bg-slate-800 rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-white font-semibold">Active Documents</h4>
          <span className="text-slate-400 text-sm">{activeDocuments.length} documents</span>
        </div>
        {activeDocuments.length === 0 ? (
          <p className="text-slate-400 text-center py-8">No active documents</p>
        ) : (
          <div className="grid gap-3">
            {activeDocuments.map(doc => (
              <div
                key={doc.id}
                className="bg-slate-700 p-4 rounded-lg hover:bg-slate-600/80 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <FileText className="w-5 h-5 text-teal-400 flex-shrink-0 mt-1" />
                  <div className="flex-1 min-w-0">
                    <h5 className="text-white font-semibold truncate mb-1">{doc.document_name}</h5>
                    {doc.description && (
                      <p className="text-slate-400 text-sm mb-2">{doc.description}</p>
                    )}
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="bg-slate-600 px-2 py-1 rounded text-slate-300">
                        {TYPE_LABELS[doc.document_type] || doc.document_type}
                      </span>
                      {doc.version && (
                        <span className="bg-slate-600 px-2 py-1 rounded text-slate-300">
                          v{doc.version}
                        </span>
                      )}
                      <span className="text-slate-400 py-1">
                        {new Date(doc.created_at).toLocaleDateString()}
                      </span>
                      {doc.expiration_date && (
                        <span className={`py-1 ${isExpired(doc) ? 'text-red-400' : isExpiringSoon(doc) ? 'text-yellow-400' : 'text-slate-400'}`}>
                          Expires: {new Date(doc.expiration_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleView(doc)}
                      className="p-2 rounded hover:bg-slate-600 text-slate-400 hover:text-white transition-colors"
                      title="View"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDownload(doc)}
                      className="p-2 rounded hover:bg-slate-600 text-teal-400 hover:text-teal-300 transition-colors"
                      title="Download"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                    {isEditor && (
                      <>
                        <button
                          onClick={() => setReplacingDoc(doc)}
                          className="p-2 rounded hover:bg-slate-600 text-slate-400 hover:text-white transition-colors"
                          title="Replace with new version"
                        >
                          <RefreshCw className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleRetire(doc)}
                          className="p-2 rounded hover:bg-slate-600 text-yellow-400 hover:text-yellow-300 transition-colors"
                          title="Retire document"
                        >
                          <Archive className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(doc)}
                          className="p-2 rounded hover:bg-slate-600 text-red-400 hover:text-red-300 transition-colors"
                          title="Delete permanently"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {equipmentRefDocs.length > 0 && (
        <div className="bg-slate-800 rounded-lg p-6 space-y-4 border border-slate-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Book className="w-5 h-5 text-blue-400" />
              <h4 className="text-white font-semibold">Equipment Reference Documents</h4>
              <span className="text-xs text-slate-400 bg-slate-700 px-2 py-1 rounded">System-wide</span>
            </div>
            <span className="text-slate-400 text-sm">{equipmentRefDocs.length} documents</span>
          </div>
          <p className="text-slate-400 text-sm">
            Reference materials including manuals, specifications, and installation guides for equipment in your system.
          </p>
          <div className="grid gap-3">
            {equipmentRefDocs.map(doc => (
              <div
                key={doc.id}
                className="bg-slate-700/50 p-4 rounded-lg hover:bg-slate-700/80 transition-colors border border-blue-500/20"
              >
                <div className="flex items-start gap-4">
                  <FileText className="w-5 h-5 text-blue-400 flex-shrink-0 mt-1" />
                  <div className="flex-1 min-w-0">
                    <h5 className="text-white font-semibold truncate mb-1">{doc.document_name}</h5>
                    {doc.description && (
                      <p className="text-slate-400 text-sm mb-2">{doc.description}</p>
                    )}
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="bg-slate-600/50 px-2 py-1 rounded text-slate-300 border border-blue-500/20">
                        {TYPE_LABELS[doc.document_type] || doc.document_type}
                      </span>
                      {doc.version && (
                        <span className="bg-slate-600/50 px-2 py-1 rounded text-slate-300">
                          v{doc.version}
                        </span>
                      )}
                      <span className="text-slate-400 py-1">
                        {new Date(doc.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleView(doc)}
                      className="p-2 rounded hover:bg-slate-600 text-slate-400 hover:text-white transition-colors"
                      title="View document"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDownload(doc)}
                      className="p-2 rounded hover:bg-slate-600 text-blue-400 hover:text-blue-300 transition-colors"
                      title="Download"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {retiredDocuments.length > 0 && (
        <div className="bg-slate-800 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-white font-semibold">Retired Documents</h4>
            <span className="text-slate-400 text-sm">{retiredDocuments.length} documents</span>
          </div>
          <div className="grid gap-3">
            {retiredDocuments.map(doc => (
              <div
                key={doc.id}
                className="bg-slate-700/50 p-4 rounded-lg border border-yellow-700/30"
              >
                <div className="flex items-start gap-4">
                  <FileText className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-1" />
                  <div className="flex-1 min-w-0">
                    <h5 className="text-slate-300 font-semibold truncate mb-1">{doc.document_name}</h5>
                    {doc.retirement_reason && (
                      <p className="text-yellow-400 text-sm mb-2">Reason: {doc.retirement_reason}</p>
                    )}
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="bg-slate-600 px-2 py-1 rounded text-slate-400">
                        Retired {new Date(doc.retired_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleView(doc)}
                      className="p-2 rounded hover:bg-slate-600 text-slate-400 hover:text-white transition-colors"
                      title="View"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDownload(doc)}
                      className="p-2 rounded hover:bg-slate-600 text-slate-400 hover:text-slate-300 transition-colors"
                      title="Download"
                    >
                      <Download className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {viewingDoc && (
        <DocumentViewer
          document={viewingDoc}
          onClose={() => setViewingDoc(null)}
          onDownload={() => handleDownload(viewingDoc)}
        />
      )}
    </div>
  );
}
