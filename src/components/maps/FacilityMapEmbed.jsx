import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MAP_STYLES, getStatusColor, DEFAULT_CENTER, DEFAULT_ZOOM } from './mapStyles';
import { Maximize2, Minimize2, Layers } from 'lucide-react';

export default function FacilityMapEmbed({
  facility = null,
  facilities = [],
  height = 300,
  showControls = true,
  showStylePicker = false,
  interactive = true,
  onFacilityClick = null,
  highlightedId = null,
  className = ''
}) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markersRef = useRef([]);
  const [mapStyle, setMapStyle] = useState(MAP_STYLES[1]);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const allFacilities = facility ? [facility] : facilities;
  const validFacilities = allFacilities.filter(f => f?.latitude && f?.longitude);

  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    let center = DEFAULT_CENTER;
    let zoom = DEFAULT_ZOOM;

    if (validFacilities.length === 1) {
      center = [validFacilities[0].longitude, validFacilities[0].latitude];
      zoom = 14;
    } else if (validFacilities.length > 1) {
      const bounds = new maplibregl.LngLatBounds();
      validFacilities.forEach(f => bounds.extend([f.longitude, f.latitude]));
      center = bounds.getCenter().toArray();
    }

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: mapStyle.url,
      center,
      zoom,
      interactive,
      attributionControl: false
    });

    if (showControls && interactive) {
      map.current.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    }

    map.current.on('load', () => {
      addMarkers();
      if (validFacilities.length > 1) {
        fitToMarkers();
      }
    });

    return () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!map.current) return;
    map.current.setStyle(mapStyle.url);
    map.current.once('style.load', () => {
      addMarkers();
    });
  }, [mapStyle]);

  useEffect(() => {
    if (!map.current) return;
    addMarkers();
  }, [validFacilities, highlightedId]);

  function addMarkers() {
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    validFacilities.forEach(f => {
      const isHighlighted = highlightedId === f.id;
      const color = getStatusColor(f.status);
      const size = isHighlighted ? 20 : 14;

      const el = document.createElement('div');
      el.className = 'facility-marker';
      el.style.cssText = `
        width: ${size}px;
        height: ${size}px;
        background-color: ${color};
        border: 2px solid white;
        border-radius: 50%;
        cursor: ${onFacilityClick ? 'pointer' : 'default'};
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        transition: all 0.2s ease;
      `;

      if (isHighlighted) {
        el.style.boxShadow = `0 0 0 4px ${color}40, 0 2px 8px rgba(0,0,0,0.4)`;
      }

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([f.longitude, f.latitude])
        .addTo(map.current);

      if (onFacilityClick) {
        el.addEventListener('click', () => onFacilityClick(f));
      }

      const popup = new maplibregl.Popup({
        offset: 12,
        closeButton: false,
        closeOnClick: false,
        className: 'facility-popup'
      }).setHTML(`
        <div style="padding: 8px; min-width: 150px;">
          <div style="font-weight: 600; color: #fff; margin-bottom: 4px;">${f.name}</div>
          <div style="font-size: 12px; color: #94a3b8;">${f.city || ''}, ${f.state || ''}</div>
          <div style="display: flex; align-items: center; gap: 6px; margin-top: 6px;">
            <span style="width: 8px; height: 8px; border-radius: 50%; background: ${color};"></span>
            <span style="font-size: 11px; color: #cbd5e1;">${f.status || 'Unknown'}</span>
          </div>
        </div>
      `);

      el.addEventListener('mouseenter', () => {
        popup.addTo(map.current);
        marker.setPopup(popup);
        popup.addTo(map.current);
      });

      el.addEventListener('mouseleave', () => {
        popup.remove();
      });

      markersRef.current.push(marker);
    });
  }

  function fitToMarkers() {
    if (validFacilities.length === 0 || !map.current) return;

    const bounds = new maplibregl.LngLatBounds();
    validFacilities.forEach(f => bounds.extend([f.longitude, f.latitude]));

    map.current.fitBounds(bounds, {
      padding: 50,
      maxZoom: 14,
      duration: 500
    });
  }

  function toggleFullscreen() {
    if (!mapContainer.current) return;

    if (!isFullscreen) {
      if (mapContainer.current.requestFullscreen) {
        mapContainer.current.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
    setIsFullscreen(!isFullscreen);
  }

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(!!document.fullscreenElement);
      setTimeout(() => map.current?.resize(), 100);
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  if (validFacilities.length === 0) {
    return (
      <div
        className={`bg-slate-800 rounded-lg flex items-center justify-center ${className}`}
        style={{ height }}
      >
        <div className="text-center text-slate-400">
          <p className="text-sm">No location data available</p>
          <p className="text-xs mt-1">Add coordinates to view on map</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative rounded-lg overflow-hidden ${className}`} style={{ height }}>
      <div ref={mapContainer} className="w-full h-full" />

      {showStylePicker && (
        <div className="absolute top-2 left-2 z-10">
          <div className="bg-slate-800/90 backdrop-blur-sm rounded-lg border border-slate-700 p-1">
            <div className="flex gap-1">
              {MAP_STYLES.map(style => (
                <button
                  key={style.id}
                  onClick={() => setMapStyle(style)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    mapStyle.id === style.id
                      ? 'bg-teal-500 text-slate-900'
                      : 'text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {style.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {interactive && (
        <button
          onClick={toggleFullscreen}
          className="absolute bottom-2 right-2 z-10 p-2 bg-slate-800/90 backdrop-blur-sm rounded-lg border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      )}

      <style>{`
        .facility-popup .maplibregl-popup-content {
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 8px;
          padding: 0;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        .facility-popup .maplibregl-popup-tip {
          border-top-color: #1e293b;
        }
      `}</style>
    </div>
  );
}
