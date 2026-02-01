import React, { useState, useEffect } from 'react';
import { FileText, Search, Filter, Eye, Download, Archive, RefreshCw, Upload, X, AlertCircle, CheckCircle } from 'lucide-react';
import { unifiedDocumentService } from '../services/unifiedDocumentService';
import { useAuth } from '../contexts/AuthContext';
import { useOrganization } from '../contexts/OrganizationContext';
import DocumentViewer from './documents/DocumentViewer';
import DocumentUploadForm from './documents/DocumentUploadForm';

const ENTITY_TYPES = [
  { value: '', label: 'All Entity Types' },
  { value: 'facility', label: 'Facility' },
  { value: 'equipment_catalog', label: 'Equipment Catalog' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'organization', label: 'Organization' },
  { value: 'milestone', label: 'Milestone' },
  { value: 'training', label: 'Training' },
  { value: 'regulatory', label: 'Regulatory' },
  { value: 'support_ticket', label: 'Support Ticket' },
  { value: 'user', label: 'User' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active', color: 'text-green-400' },
  { value: 'retired', label: 'Retired', color: 'text-yellow-400' },
  { value: 'archived', label: 'Archived', color: 'text-slate-400' },
];

export default function Documents() {
  const { profile } = useAuth();
  const { selectedOrganization } = useOrganization();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    entity_type: '',
    status: '',
    document_type: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [viewingDoc, setViewingDoc] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [actionStatus, setActionStatus] = useState(null);

  const isAdmin = ['Proximity Admin', 'Proximity Staff'].includes(profile?.role);

  useEffect(() => {
    loadDocuments();
    loadStats();
  }, [filters, selectedOrganization]);

  async function loadDocuments() {
    try {
      setLoading(true);
      const filterParams = {
        ...filters,
        status: filters.status || ['active', 'retired', 'archived'],
      };

      // Only apply organization filter for non-admins or if explicitly filtering
      // Admins can see all documents by default
      if (selectedOrganization?.id && !isAdmin) {
        filterParams.organization_id = selectedOrganization.id;
      }

      const docs = await unifiedDocumentService.getAllDocuments(filterParams);
      setDocuments(docs);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadStats() {
    try {
      const statsParams = {};
      // Only apply organization filter for non-admins
      if (selectedOrganization?.id && !isAdmin) {
        statsParams.organization_id = selectedOrganization.id;
      }
      const statsData = await unifiedDocumentService.getDocumentStats(statsParams);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }

  function handleFilterChange(field, value) {
    setFilters(prev => ({ ...prev, [field]: value }));
  }

  async function handleRetire(doc) {
    const reason = window.prompt('Enter reason for retiring this document (optional):');
    if (reason === null) return;

    try {
      await unifiedDocumentService.retireDocument(doc.id, reason || 'Retired by admin');
      setActionStatus({ type: 'success', message: 'Document retired successfully' });
      loadDocuments();
      loadStats();
      setTimeout(() => setActionStatus(null), 3000);
    } catch (error) {
      console.error('Error retiring document:', error);
      setActionStatus({ type: 'error', message: 'Failed to retire document' });
      setTimeout(() => setActionStatus(null), 3000);
    }
  }

  async function handleReplace(doc) {
    setSelectedDoc(doc);
    setShowUpload(true);
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

  async function handleUpload(file, metadata) {
    try {
      setUploading(true);

      if (selectedDoc) {
        await unifiedDocumentService.replaceDocument(
          selectedDoc.id,
          selectedDoc.entity_type,
          selectedDoc.entity_id,
          file,
          {
            ...metadata,
            organization_id: selectedDoc.organization_id,
          }
        );
        setActionStatus({ type: 'success', message: 'Document replaced successfully' });
        setSelectedDoc(null);
      } else {
        alert('Direct upload requires entity selection - use entity-specific upload forms');
      }

      setShowUpload(false);
      loadDocuments();
      loadStats();
      setTimeout(() => setActionStatus(null), 3000);
    } catch (error) {
      console.error('Error uploading document:', error);
      setActionStatus({ type: 'error', message: 'Failed to upload document' });
      setTimeout(() => setActionStatus(null), 3000);
    } finally {
      setUploading(false);
    }
  }

  function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function formatDate(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="w-8 h-8 text-teal-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">Document Management</h1>
            <p className="text-slate-400 text-sm">Central repository for all documents</p>
          </div>
        </div>
      </div>

      {actionStatus && (
        <div className={`p-4 rounded-lg border ${
          actionStatus.type === 'success'
            ? 'bg-green-900/30 border-green-700'
            : 'bg-red-900/30 border-red-700'
        }`}>
          <div className="flex items-center gap-2">
            {actionStatus.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-green-400" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-400" />
            )}
            <p className={actionStatus.type === 'success' ? 'text-green-200' : 'text-red-200'}>
              {actionStatus.message}
            </p>
          </div>
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-slate-800 rounded-lg p-4">
            <div className="text-slate-400 text-sm mb-1">Total Documents</div>
            <div className="text-2xl font-bold text-white">{stats.total}</div>
          </div>
          <div className="bg-slate-800 rounded-lg p-4">
            <div className="text-slate-400 text-sm mb-1">Active</div>
            <div className="text-2xl font-bold text-green-400">{stats.byStatus?.active || 0}</div>
          </div>
          <div className="bg-slate-800 rounded-lg p-4">
            <div className="text-slate-400 text-sm mb-1">Retired</div>
            <div className="text-2xl font-bold text-yellow-400">{stats.byStatus?.retired || 0}</div>
          </div>
          <div className="bg-slate-800 rounded-lg p-4">
            <div className="text-slate-400 text-sm mb-1">Archived</div>
            <div className="text-2xl font-bold text-slate-400">{stats.byStatus?.archived || 0}</div>
          </div>
        </div>
      )}

      <div className="bg-slate-800 rounded-lg p-6 space-y-4">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search documents by name or description..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="w-full bg-slate-700 text-white pl-10 pr-4 py-2 rounded border border-slate-600 focus:outline-none focus:border-teal-500"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${
              showFilters ? 'bg-teal-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            <Filter className="w-5 h-5" />
            Filters
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-700">
            <div>
              <label className="text-slate-400 text-sm mb-2 block">Entity Type</label>
              <select
                value={filters.entity_type}
                onChange={(e) => handleFilterChange('entity_type', e.target.value)}
                className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600"
              >
                {ENTITY_TYPES.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-slate-400 text-sm mb-2 block">Status</label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600"
              >
                <option value="">All Statuses</option>
                {STATUS_OPTIONS.map(status => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-slate-400 text-sm mb-2 block">Document Type</label>
              <input
                type="text"
                placeholder="e.g., manual, certificate"
                value={filters.document_type}
                onChange={(e) => handleFilterChange('document_type', e.target.value)}
                className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600"
              />
            </div>
          </div>
        )}

        {isAdmin && (
          <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-3 text-sm text-blue-200">
            Admin view: Showing all documents across all organizations
          </div>
        )}
      </div>

      <div className="bg-slate-800 rounded-lg">
        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading documents...</div>
        ) : documents.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            No documents found matching your filters
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700/50 border-b border-slate-700">
                <tr>
                  <th className="text-left px-4 py-3 text-slate-300 text-sm font-semibold">Document</th>
                  <th className="text-left px-4 py-3 text-slate-300 text-sm font-semibold">Type</th>
                  <th className="text-left px-4 py-3 text-slate-300 text-sm font-semibold">Entity</th>
                  <th className="text-left px-4 py-3 text-slate-300 text-sm font-semibold">Status</th>
                  <th className="text-left px-4 py-3 text-slate-300 text-sm font-semibold">Size</th>
                  <th className="text-left px-4 py-3 text-slate-300 text-sm font-semibold">Uploaded</th>
                  <th className="text-right px-4 py-3 text-slate-300 text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {documents.map(doc => (
                  <tr key={doc.id} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-slate-400 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="text-white font-medium truncate">{doc.document_name}</div>
                          {doc.description && (
                            <div className="text-slate-400 text-sm truncate">{doc.description}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-slate-300 text-sm">{doc.document_type || 'N/A'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-slate-300 text-sm capitalize">{doc.entity_type}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-medium ${
                        STATUS_OPTIONS.find(s => s.value === doc.status)?.color || 'text-slate-400'
                      }`}>
                        {doc.status || 'active'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-slate-400 text-sm">{formatFileSize(doc.file_size)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-slate-400 text-sm">{formatDate(doc.created_at)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleView(doc)}
                          className="p-2 rounded hover:bg-slate-600 text-slate-400 hover:text-white transition-colors"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDownload(doc)}
                          className="p-2 rounded hover:bg-slate-600 text-slate-400 hover:text-white transition-colors"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {isAdmin && doc.status === 'active' && (
                          <>
                            <button
                              onClick={() => handleReplace(doc)}
                              className="p-2 rounded hover:bg-slate-600 text-slate-400 hover:text-white transition-colors"
                              title="Replace"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleRetire(doc)}
                              className="p-2 rounded hover:bg-slate-600 text-yellow-400 hover:text-yellow-300 transition-colors"
                              title="Retire"
                            >
                              <Archive className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {viewingDoc && (
        <DocumentViewer
          document={viewingDoc}
          onClose={() => setViewingDoc(null)}
          onDownload={() => handleDownload(viewingDoc)}
        />
      )}

      {showUpload && selectedDoc && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-white">Replace Document</h2>
                <p className="text-slate-400 text-sm mt-1">
                  Replacing: {selectedDoc.document_name}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowUpload(false);
                  setSelectedDoc(null);
                }}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <DocumentUploadForm
              onUpload={handleUpload}
              uploading={uploading}
              defaultType={selectedDoc.document_type || 'other'}
            />
          </div>
        </div>
      )}
    </div>
  );
}
