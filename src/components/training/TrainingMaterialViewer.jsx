import React, { useState, useEffect } from 'react';
import { X, Download, ExternalLink, Loader as Loader2, Video, FileText, Image, Link, Monitor, Package } from 'lucide-react';

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
import { trainingMaterialsService } from '../../services/trainingMaterialsService';

function getYouTubeEmbedUrl(url) {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^&?/]+)/);
  if (match) return `https://www.youtube.com/embed/${match[1]}?rel=0&modestbranding=1`;
  return null;
}

function getVimeoEmbedUrl(url) {
  if (!url) return null;
  const match = url.match(/vimeo\.com\/(\d+)/);
  if (match) return `https://player.vimeo.com/video/${match[1]}?byline=0&portrait=0`;
  return null;
}

const TYPE_ICON = {
  video: Video,
  document: FileText,
  image: Image,
  presentation: Monitor,
  link: Link,
};

export default function TrainingMaterialViewer({ material, onClose }) {
  const [fileUrl, setFileUrl] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (material.storage_path) {
      setLoading(true);
      trainingMaterialsService
        .getFileUrl(material.storage_path)
        .then(url => setFileUrl(url))
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [material.storage_path]);

  const youtubeEmbed = getYouTubeEmbedUrl(material.video_url);
  const vimeoEmbed = getVimeoEmbedUrl(material.video_url);

  const handleDownload = () => {
    if (fileUrl) {
      const a = document.createElement('a');
      a.href = fileUrl;
      a.download = material.file_name || material.title;
      a.click();
    }
  };

  const Icon = TYPE_ICON[material.material_type] || FileText;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl">
        <div className="flex items-start justify-between p-5 border-b border-slate-700/50 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-teal-500/15 flex items-center justify-center flex-shrink-0">
              <Icon className="w-5 h-5 text-teal-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-white truncate">{material.title}</h2>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-xs text-slate-400 capitalize">{material.category}</span>
                <span className="text-slate-600">·</span>
                <span className="text-xs text-slate-400 capitalize">{material.material_type}</span>
                {material.equipment_catalog && (
                  <>
                    <span className="text-slate-600">·</span>
                    <span className="flex items-center gap-1 text-xs text-teal-400">
                      <Package className="w-3 h-3" />
                      {material.equipment_catalog.equipment_name}
                      {material.equipment_catalog.manufacturer && (
                        <span className="text-slate-500">({material.equipment_catalog.manufacturer})</span>
                      )}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-4">
            {material.material_type === 'link' && material.external_link && (
              <a
                href={material.external_link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open Link
              </a>
            )}
            {material.storage_path && fileUrl && (
              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm font-medium transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto min-h-0">
          {loading && (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-teal-400" />
            </div>
          )}

          {!loading && material.material_type === 'video' && (
            <div className="p-1">
              {youtubeEmbed ? (
                <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                  <iframe
                    src={youtubeEmbed}
                    className="absolute inset-0 w-full h-full rounded-lg"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title={material.title}
                  />
                </div>
              ) : vimeoEmbed ? (
                <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                  <iframe
                    src={vimeoEmbed}
                    className="absolute inset-0 w-full h-full rounded-lg"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                    title={material.title}
                  />
                </div>
              ) : material.video_url ? (
                <video
                  src={material.video_url}
                  controls
                  className="w-full rounded-lg max-h-[60vh]"
                />
              ) : fileUrl && material.mime_type?.startsWith('video/') ? (
                <video src={fileUrl} controls className="w-full rounded-lg max-h-[60vh]" />
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-3">
                  <Video className="w-12 h-12 opacity-30" />
                  <p className="text-sm">No video source available</p>
                </div>
              )}
            </div>
          )}

          {!loading && material.material_type === 'image' && fileUrl && (
            <div className="p-4 flex items-center justify-center">
              <img src={fileUrl} alt={material.title} className="max-w-full max-h-[65vh] rounded-lg object-contain" />
            </div>
          )}

          {!loading && material.material_type === 'document' && fileUrl && (
            <div className="h-[65vh]">
              {material.mime_type === 'application/pdf' ? (
                <iframe src={fileUrl} className="w-full h-full" title={material.title} />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4">
                  <FileText className="w-16 h-16 opacity-30" />
                  <p className="text-sm">Preview not available for this file type</p>
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download to View
                  </button>
                </div>
              )}
            </div>
          )}

          {!loading && material.material_type === 'presentation' && fileUrl && (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-4 p-6">
              <Monitor className="w-16 h-16 opacity-30" />
              <p className="text-sm text-center">Download this presentation to view it in your presentation app</p>
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Download className="w-4 h-4" />
                Download Presentation
              </button>
            </div>
          )}

          {!loading && material.material_type === 'link' && (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-4 p-6">
              <Link className="w-16 h-16 opacity-30" />
              <p className="text-sm text-center text-slate-300">This material links to an external resource</p>
              <a
                href={material.external_link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Open External Link
              </a>
            </div>
          )}

          {material.equipment_catalog && (
            <div className="px-5 py-3 border-t border-slate-700/50 bg-slate-800/30">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Linked Equipment</h3>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-teal-500/15 border border-teal-500/25 flex items-center justify-center flex-shrink-0">
                  <Package className="w-4 h-4 text-teal-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{material.equipment_catalog.equipment_name}</p>
                  <p className="text-xs text-slate-400">
                    {material.equipment_catalog.manufacturer && `${material.equipment_catalog.manufacturer}`}
                    {material.equipment_catalog.manufacturer && material.equipment_catalog.model_number && ' · '}
                    {material.equipment_catalog.model_number && `Model: ${material.equipment_catalog.model_number}`}
                    {(material.equipment_catalog.manufacturer || material.equipment_catalog.model_number) && material.equipment_catalog.equipment_type && ' · '}
                    {material.equipment_catalog.equipment_type && (EQUIPMENT_TYPE_LABELS[material.equipment_catalog.equipment_type] || material.equipment_catalog.equipment_type)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {material.description && (
            <div className="px-5 py-4 border-t border-slate-700/50">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Description</h3>
              <p className="text-sm text-slate-300 leading-relaxed">{material.description}</p>
            </div>
          )}

          {material.tags?.length > 0 && (
            <div className="px-5 pb-4">
              <div className="flex flex-wrap gap-1.5">
                {material.tags.map(tag => (
                  <span key={tag} className="px-2 py-0.5 bg-slate-700/60 text-slate-400 text-xs rounded-full border border-slate-600/50">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
