import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Link } from 'react-router-dom';
import { MAP_STYLES, getStatusColor, DEFAULT_CENTER, DEFAULT_ZOOM } from './mapStyles';
import { facilitiesService } from '../../services/facilitiesService';
import { Map, ExternalLink, Loader2 } from 'lucide-react';

export default function DashboardMapWidget() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markersRef = useRef([]);
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, withCoords: 0 });

  useEffect(() => {
    loadFacilities();
  }, []);

  async function loadFacilities() {
    try {
      const data = await facilitiesService.getAll();
      setFacilities(data);
      const withCoords = data.filter(f => f.latitude && f.longitude).length;
      setStats({ total: data.length, withCoords });
    } catch (err) {
      console.error('Error loading facilities:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (loading || map.current || !mapContainer.current) return;

    const validFacilities = facilities.filter(f => f.latitude && f.longitude);

    let center = DEFAULT_CENTER;
    let zoom = DEFAULT_ZOOM;

    if (validFacilities.length > 0) {
      const bounds = new maplibregl.LngLatBounds();
      validFacilities.forEach(f => bounds.extend([f.longitude, f.latitude]));
      center = bounds.getCenter().toArray();
    }

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: MAP_STYLES[1].url,
      center,
      zoom,
      interactive: true,
      attributionControl: false
    });

    map.current.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    map.current.on('load', () => {
      addMarkers(validFacilities);
      if (validFacilities.length > 1) {
        const bounds = new maplibregl.LngLatBounds();
        validFacilities.forEach(f => bounds.extend([f.longitude, f.latitude]));
        map.current.fitBounds(bounds, { padding: 40, maxZoom: 10, duration: 0 });
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
  }, [loading, facilities]);

  function addMarkers(validFacilities) {
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    validFacilities.forEach(f => {
      const color = getStatusColor(f.status);

      const el = document.createElement('div');
      el.style.cssText = `
        width: 10px;
        height: 10px;
        background-color: ${color};
        border: 1.5px solid white;
        border-radius: 50%;
        cursor: pointer;
        box-shadow: 0 1px 3px rgba(0,0,0,0.3);
      `;

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([f.longitude, f.latitude])
        .addTo(map.current);

      const popup = new maplibregl.Popup({
        offset: 8,
        closeButton: false,
        closeOnClick: false,
        className: 'dashboard-popup'
      }).setHTML(`
        <div style="padding: 6px; min-width: 120px;">
          <div style="font-weight: 600; color: #fff; font-size: 12px;">${f.name}</div>
          <div style="font-size: 11px; color: #94a3b8;">${f.city || ''}, ${f.state || ''}</div>
        </div>
      `);

      el.addEventListener('mouseenter', () => {
        marker.setPopup(popup);
        popup.addTo(map.current);
      });

      el.addEventListener('mouseleave', () => {
        popup.remove();
      });

      markersRef.current.push(marker);
    });
  }

  const statusCounts = facilities.reduce((acc, f) => {
    const status = f.status || 'Unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 text-teal-400 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Map className="w-5 h-5 text-teal-400" />
          <h3 className="text-lg font-semibold text-white">Facility Locations</h3>
        </div>
        <Link
          to="/tracker"
          className="flex items-center gap-1 text-teal-400 hover:text-teal-300 text-sm transition-colors"
        >
          Open Tracker
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="relative h-64">
        <div ref={mapContainer} className="w-full h-full" />

        <div className="absolute bottom-2 left-2 bg-slate-900/90 backdrop-blur-sm rounded-lg px-3 py-2 border border-slate-700">
          <div className="flex items-center gap-4">
            {Object.entries(statusCounts).slice(0, 4).map(([status, count]) => (
              <div key={status} className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: getStatusColor(status) }}
                />
                <span className="text-slate-300 text-xs">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute top-2 left-2 bg-slate-900/90 backdrop-blur-sm rounded-lg px-2 py-1 border border-slate-700">
          <span className="text-slate-300 text-xs">
            {stats.withCoords} of {stats.total} mapped
          </span>
        </div>
      </div>

      <style>{`
        .dashboard-popup .maplibregl-popup-content {
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 6px;
          padding: 0;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        .dashboard-popup .maplibregl-popup-tip {
          border-top-color: #1e293b;
        }
      `}</style>
    </div>
  );
}
