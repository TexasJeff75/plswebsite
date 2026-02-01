import React, { useState, useEffect } from 'react';
import { X, Download, ExternalLink, AlertCircle, Loader2 } from 'lucide-react';

export default function DocumentViewer({ document, onClose, onDownload }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewUrl, setViewUrl] = useState(null);

  useEffect(() => {
    loadDocument();
  }, [document]);

  async function loadDocument() {
    try {
      setLoading(true);
      setError(null);

      if (document.signedUrl) {
        setViewUrl(document.signedUrl);
      } else if (document.url) {
        setViewUrl(document.url);
      } else {
        setError('No URL available for this document');
      }
    } catch (err) {
      console.error('Error loading document:', err);
      setError('Failed to load document');
    } finally {
      setLoading(false);
    }
  }

  const isImage = document.mime_type?.startsWith('image/') ||
                  document.document_name?.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i);
  const isPdf = document.mime_type === 'application/pdf' ||
                document.document_name?.match(/\.pdf$/i);
  const canPreview = isImage || isPdf;

  if (!canPreview) {
    return (
      <div
        className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div className="bg-slate-800 rounded-lg p-8 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
          <div className="text-center">
            <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Preview Not Available</h3>
            <p className="text-slate-400 mb-6">
              This file type cannot be previewed in the browser. Please download it to view.
            </p>
            <div className="flex gap-3 justify-center">
              {onDownload && (
                <button
                  onClick={onDownload}
                  className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
              )}
              <button
                onClick={onClose}
                className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/90 z-50 flex flex-col"
      onClick={onClose}
    >
      <div className="flex items-center justify-between p-4 bg-slate-900/80 backdrop-blur">
        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold truncate">{document.document_name}</h3>
          <p className="text-slate-400 text-sm">
            {document.document_type && `${document.document_type} • `}
            {document.file_size && formatFileSize(document.file_size)}
          </p>
        </div>
        <div className="flex gap-2 ml-4">
          {viewUrl && (
            <a
              href={viewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              title="Open in new tab"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="w-5 h-5" />
            </a>
          )}
          {onDownload && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDownload();
              }}
              className="p-2 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              title="Download"
            >
              <Download className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-2 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4" onClick={(e) => e.stopPropagation()}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <p className="text-red-300 text-lg">{error}</p>
            </div>
          </div>
        ) : isImage ? (
          <div className="flex items-center justify-center min-h-full">
            <img
              src={viewUrl}
              alt={document.document_name}
              className="max-w-full max-h-full object-contain rounded-lg"
            />
          </div>
        ) : isPdf ? (
          <div className="h-full bg-slate-800 rounded-lg overflow-hidden">
            <iframe
              src={viewUrl}
              title={document.document_name}
              className="w-full h-full"
              style={{ minHeight: '600px' }}
            />
          </div>
        ) : null}
      </div>

      {document.description && (
        <div className="bg-slate-900/80 backdrop-blur p-4 border-t border-slate-700">
          <p className="text-slate-300 text-sm">{document.description}</p>
        </div>
      )}
    </div>
  );
}

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
