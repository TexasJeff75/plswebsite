import React, { useState, useEffect, useRef, useCallback } from 'react';
import MapLibreGL from 'maplibre-gl';
import { Search, X, Upload, Maximize2, Minimize2, Eye, MapPin, Activity, Layers, Target, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { facilitiesService } from '../services/facilitiesService';
import FacilityDetailPanel from './FacilityDetailPanel';
import ImportData from './ImportData';
import 'maplibre-gl/dist/maplibre-gl.css';

const MILESTONE_NAMES = [
  'Site Assessment',
  'CLIA Certificate Obtained',
  'Lab Director Assigned',
  'Equipment Ordered',
  'Equipment Installed',
  'Network/LIS Integration',
  'Staff Training Complete',
  'Competency Assessment Done',
  'Go-Live'
];

const DEFAULT_REGIONS = ['All Regions'];

const STATUS_CONFIG = {
  'not_started': { color: '#6b7280', label: 'Not Started', glow: 'rgba(107, 114, 128, 0.5)' },
  'in_progress': { color: '#fbbf24', label: 'In Progress', glow: 'rgba(251, 191, 36, 0.5)' },
  'live': { color: '#10b981', label: 'Live', glow: 'rgba(16, 185, 129, 0.5)' },
  'blocked': { color: '#ef4444', label: 'Blocked', glow: 'rgba(239, 68, 68, 0.5)' }
};

const MAP_STYLES = [
  { id: 'dark', name: 'Dark', url: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json' },
  { id: 'light', name: 'Light', url: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json' },
  { id: 'voyager', name: 'Voyager', url: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json' }
];

function calculateFacilityStatus(milestones) {
  if (!milestones || milestones.length === 0) return 'not_started';

  const completedCount = milestones.filter(m => m.status === 'complete').length;
  const blockedCount = milestones.filter(m => m.status === 'blocked').length;

  if (blockedCount > 0) return 'blocked';
  if (completedCount === milestones.length) return 'live';
  if (completedCount > 0) return 'in_progress';
  return 'not_started';
}

export default function DeploymentTrackerMap() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markersRef = useRef(new Map());
  const popupRef = useRef(null);

  const [facilities, setFacilities] = useState([]);
  const [filteredFacilities, setFilteredFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [hoveredFacility, setHoveredFacility] = useState(null);
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mapStyle, setMapStyle] = useState(MAP_STYLES[0].url);
  const [showStylePicker, setShowStylePicker] = useState(false);
  const [showClusters, setShowClusters] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [regionFilter, setRegionFilter] = useState('All Regions');
  const [regions, setRegions] = useState(DEFAULT_REGIONS);

  const loadFacilities = async () => {
    try {
      setLoading(true);
      const data = await facilitiesService.getAll({});

      const enrichedData = data.map(facility => {
        const status = calculateFacilityStatus(facility.milestones);
        const completedMilestones = facility.milestones?.filter(m => m.status === 'complete').length || 0;
        return {
          ...facility,
          status,
          completedMilestones,
          totalMilestones: MILESTONE_NAMES.length
        };
      });

      const uniqueRegions = [...new Set(data.filter(f => f.region).map(f => f.region))].sort();
      setRegions(['All Regions', ...uniqueRegions]);

      setFacilities(enrichedData);
      setLoading(false);
    } catch (error) {
      console.error('Error loading facilities:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFacilities();
  }, []);

  useEffect(() => {
    let filtered = facilities;

    if (searchQuery) {
      filtered = filtered.filter(f =>
        f.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.city?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (statusFilter !== 'All') {
      const statusMap = {
        'Live': 'live',
        'In Progress': 'in_progress',
        'Blocked': 'blocked',
        'Not Started': 'not_started'
      };
      filtered = filtered.filter(f => f.status === statusMap[statusFilter]);
    }

    if (regionFilter !== 'All Regions') {
      filtered = filtered.filter(f => f.region === regionFilter);
    }

    setFilteredFacilities(filtered);
  }, [facilities, searchQuery, statusFilter, regionFilter]);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new MapLibreGL.Map({
      container: mapContainer.current,
      style: mapStyle,
      center: [-92.5, 38.5],
      zoom: 5.8,
      minZoom: 3,
      maxZoom: 18,
      attributionControl: false
    });

    map.current.addControl(new MapLibreGL.AttributionControl({ compact: true }), 'bottom-right');

    map.current.on('load', () => {
      setMapLoaded(true);
    });

    map.current.on('click', () => {
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
    });

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!map.current) return;
    map.current.setStyle(mapStyle);
    map.current.once('style.load', () => {
      renderMarkers();
    });
  }, [mapStyle]);

  const createMarkerElement = useCallback((facility, isSelected) => {
    const el = document.createElement('div');
    el.className = 'facility-marker';

    const color = STATUS_CONFIG[facility.status]?.color || '#6b7280';
    const glow = STATUS_CONFIG[facility.status]?.glow || 'rgba(107, 114, 128, 0.5)';
    const size = isSelected ? 28 : 18;

    el.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      background-color: ${color};
      border: 3px solid rgba(255, 255, 255, 0.95);
      border-radius: 50%;
      cursor: pointer;
      transition: all 0.2s ease-in-out;
      box-shadow: 0 0 0 2px ${glow}, 0 4px 12px rgba(0, 0, 0, 0.4);
      ${facility.status === 'blocked' ? 'animation: pulse-marker 1.5s infinite;' : ''}
    `;

    el.addEventListener('mouseenter', () => {
      if (!isSelected) {
        el.style.transform = 'scale(1.3)';
        el.style.boxShadow = `0 0 0 4px ${glow}, 0 6px 20px rgba(0, 0, 0, 0.5)`;
      }
      showTooltip(facility);
    });

    el.addEventListener('mouseleave', () => {
      if (!isSelected) {
        el.style.transform = 'scale(1)';
        el.style.boxShadow = `0 0 0 2px ${glow}, 0 4px 12px rgba(0, 0, 0, 0.4)`;
      }
      hideTooltip();
    });

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      setSelectedFacility(facility);
      setDetailPanelOpen(true);
    });

    return el;
  }, []);

  const showTooltip = useCallback((facility) => {
    if (!map.current) return;

    if (popupRef.current) {
      popupRef.current.remove();
    }

    const statusConfig = STATUS_CONFIG[facility.status] || STATUS_CONFIG.not_started;
    const progress = Math.round((facility.completedMilestones / facility.totalMilestones) * 100);

    const popupContent = `
      <div style="padding: 12px; min-width: 220px; font-family: system-ui, -apple-system, sans-serif;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <div style="width: 10px; height: 10px; background-color: ${statusConfig.color}; border-radius: 50%;"></div>
          <h3 style="font-weight: 600; font-size: 14px; margin: 0; color: #1e293b;">${facility.name}</h3>
        </div>
        <p style="font-size: 12px; color: #64748b; margin: 0 0 8px 0;">
          ${facility.city || 'Unknown'}, ${facility.state || 'Unknown'}
        </p>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <span style="font-size: 11px; color: #94a3b8;">Status</span>
          <span style="font-size: 11px; font-weight: 500; color: ${statusConfig.color};">${statusConfig.label}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="font-size: 11px; color: #94a3b8;">Progress</span>
          <span style="font-size: 11px; font-weight: 500; color: #475569;">${facility.completedMilestones}/${facility.totalMilestones} milestones</span>
        </div>
        <div style="background: #e2e8f0; height: 4px; border-radius: 2px; overflow: hidden;">
          <div style="background: ${statusConfig.color}; height: 100%; width: ${progress}%; transition: width 0.3s;"></div>
        </div>
        <p style="font-size: 10px; color: #94a3b8; margin: 8px 0 0 0; text-align: center;">Click for details</p>
      </div>
    `;

    popupRef.current = new MapLibreGL.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 15,
      className: 'facility-tooltip'
    })
      .setLngLat([facility.longitude, facility.latitude])
      .setHTML(popupContent)
      .addTo(map.current);

    setHoveredFacility(facility);
  }, []);

  const hideTooltip = useCallback(() => {
    if (popupRef.current) {
      popupRef.current.remove();
      popupRef.current = null;
    }
    setHoveredFacility(null);
  }, []);

  const renderMarkers = useCallback(() => {
    if (!map.current || !mapLoaded) return;

    markersRef.current.forEach(marker => marker.remove());
    markersRef.current.clear();

    const facilitiesWithCoords = filteredFacilities.filter(f =>
      f.latitude != null && f.longitude != null &&
      !isNaN(parseFloat(f.latitude)) && !isNaN(parseFloat(f.longitude))
    );

    facilitiesWithCoords.forEach(facility => {
      const isSelected = selectedFacility?.id === facility.id;
      const el = createMarkerElement(facility, isSelected);

      const marker = new MapLibreGL.Marker({ element: el, anchor: 'center' })
        .setLngLat([parseFloat(facility.longitude), parseFloat(facility.latitude)])
        .addTo(map.current);

      markersRef.current.set(facility.id, marker);
    });
  }, [filteredFacilities, selectedFacility, mapLoaded, createMarkerElement]);

  useEffect(() => {
    if (mapLoaded) {
      renderMarkers();
    }
  }, [filteredFacilities, selectedFacility, mapLoaded, renderMarkers]);

  const handleFacilitySelect = (facility) => {
    setSelectedFacility(facility);
    setDetailPanelOpen(true);

    if (map.current && facility.latitude && facility.longitude) {
      map.current.flyTo({
        center: [parseFloat(facility.longitude), parseFloat(facility.latitude)],
        zoom: 12,
        duration: 1500,
        essential: true
      });
    }
  };

  const fitBoundsToFacilities = useCallback(() => {
    if (!map.current) return;

    const facilitiesWithCoords = filteredFacilities.filter(f =>
      f.latitude != null && f.longitude != null
    );

    if (facilitiesWithCoords.length === 0) return;

    if (facilitiesWithCoords.length === 1) {
      map.current.flyTo({
        center: [facilitiesWithCoords[0].longitude, facilitiesWithCoords[0].latitude],
        zoom: 10,
        duration: 1000
      });
      return;
    }

    const bounds = new MapLibreGL.LngLatBounds();
    facilitiesWithCoords.forEach(f => {
      bounds.extend([parseFloat(f.longitude), parseFloat(f.latitude)]);
    });

    map.current.fitBounds(bounds, {
      padding: { top: 50, bottom: 50, left: 420, right: 50 },
      duration: 1000
    });
  }, [filteredFacilities]);

  const resetView = useCallback(() => {
    if (!map.current) return;
    map.current.flyTo({
      center: [-92.5, 38.5],
      zoom: 5.8,
      duration: 1000
    });
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      mapContainer.current?.parentElement?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const statusCounts = {
    total: facilities.length,
    live: facilities.filter(f => f.status === 'live').length,
    inProgress: facilities.filter(f => f.status === 'in_progress').length,
    blocked: facilities.filter(f => f.status === 'blocked').length,
    notStarted: facilities.filter(f => f.status === 'not_started').length
  };

  const facilitiesOnMap = filteredFacilities.filter(f => f.latitude && f.longitude).length;

  return (
    <div className={`h-[calc(100vh-3.5rem)] flex flex-col bg-slate-950 ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      <style>{`
        @keyframes pulse-marker {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.1); }
        }
        .facility-tooltip .maplibregl-popup-content {
          background: white;
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
          padding: 0;
          border: 1px solid #e2e8f0;
        }
        .facility-tooltip .maplibregl-popup-tip {
          border-top-color: white;
        }
        .maplibregl-ctrl-group {
          background: rgba(15, 23, 42, 0.9) !important;
          border: 1px solid rgba(71, 85, 105, 0.5) !important;
          border-radius: 8px !important;
          backdrop-filter: blur(8px);
        }
        .maplibregl-ctrl-group button {
          background: transparent !important;
          border: none !important;
        }
        .maplibregl-ctrl-group button + button {
          border-top: 1px solid rgba(71, 85, 105, 0.3) !important;
        }
        .maplibregl-ctrl-group button:hover {
          background: rgba(45, 212, 191, 0.1) !important;
        }
        .maplibregl-ctrl-group button .maplibregl-ctrl-icon {
          filter: invert(1);
        }
      `}</style>

      <div className="flex-none bg-slate-900/95 backdrop-blur-sm border-b border-slate-800 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img
              src="/deployment_logo_animated.svg"
              alt="Deployment Tracker"
              className="w-10 h-10"
            />
            <div>
              <h1 className="text-lg font-bold text-white">Point-of-Care Deployment Tracker</h1>
              <p className="text-slate-400 text-xs">Real-time facility deployment monitoring</p>
            </div>
          </div>

          <div className="flex gap-2">
            <div className="text-center bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700/50">
              <div className="font-bold text-white text-lg">{statusCounts.total}</div>
              <div className="text-slate-400 text-[10px] uppercase tracking-wider">Total</div>
            </div>
            <div className="text-center bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/30">
              <div className="font-bold text-emerald-400 text-lg">{statusCounts.live}</div>
              <div className="text-emerald-300 text-[10px] uppercase tracking-wider">Live</div>
            </div>
            <div className="text-center bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/30">
              <div className="font-bold text-amber-400 text-lg">{statusCounts.inProgress}</div>
              <div className="text-amber-300 text-[10px] uppercase tracking-wider">Progress</div>
            </div>
            <div className="text-center bg-red-500/10 px-3 py-1.5 rounded-lg border border-red-500/30">
              <div className="font-bold text-red-400 text-lg">{statusCounts.blocked}</div>
              <div className="text-red-300 text-[10px] uppercase tracking-wider">Blocked</div>
            </div>
            <div className="text-center bg-slate-700/30 px-3 py-1.5 rounded-lg border border-slate-600/30">
              <div className="font-bold text-slate-300 text-lg">{statusCounts.notStarted}</div>
              <div className="text-slate-400 text-[10px] uppercase tracking-wider">Pending</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-96 bg-slate-900 border-r border-slate-800 flex flex-col">
          <div className="flex-none p-4 border-b border-slate-800 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search facilities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex gap-1.5 flex-wrap">
              {['All', 'Live', 'In Progress', 'Blocked', 'Not Started'].map(status => {
                const statusKey = status === 'All' ? null : status.toLowerCase().replace(' ', '_');
                const count = status === 'All' ? facilities.length :
                  status === 'Live' ? statusCounts.live :
                  status === 'In Progress' ? statusCounts.inProgress :
                  status === 'Blocked' ? statusCounts.blocked : statusCounts.notStarted;
                const color = statusKey ? STATUS_CONFIG[statusKey]?.color : null;

                return (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                      statusFilter === status
                        ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/20'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {color && (
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                    )}
                    {status} ({count})
                  </button>
                );
              })}
            </div>

            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all"
            >
              {regions.map(region => (
                <option key={region} value={region}>{region}</option>
              ))}
            </select>

            <div className="flex gap-2">
              <button
                onClick={() => setImportOpen(true)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-teal-500/20"
              >
                <Upload className="w-4 h-4" />
                Import Data
              </button>
            </div>
          </div>

          <div className="px-4 py-2 bg-slate-800/30 border-b border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Showing {filteredFacilities.length} of {facilities.length} facilities
            </span>
            <span className="text-xs text-teal-400">
              {facilitiesOnMap} on map
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-10 h-10 border-3 border-teal-500 border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-slate-400 text-sm">Loading facilities...</p>
              </div>
            ) : filteredFacilities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <MapPin className="w-12 h-12 text-slate-700 mb-3" />
                <p className="text-slate-400 text-sm">No facilities found</p>
                <p className="text-slate-500 text-xs mt-1">Try adjusting your filters</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/50">
                {filteredFacilities.map(facility => {
                  const statusConfig = STATUS_CONFIG[facility.status] || STATUS_CONFIG.not_started;
                  const hasCoords = facility.latitude && facility.longitude;
                  const progress = (facility.completedMilestones / facility.totalMilestones) * 100;

                  return (
                    <button
                      key={facility.id}
                      onClick={() => handleFacilitySelect(facility)}
                      className={`w-full text-left p-4 transition-all border-l-2 ${
                        selectedFacility?.id === facility.id
                          ? 'bg-teal-500/10 border-teal-500'
                          : hoveredFacility?.id === facility.id
                          ? 'bg-slate-800/50 border-slate-600'
                          : 'hover:bg-slate-800/30 border-transparent'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-3 h-3 rounded-full ${facility.status === 'blocked' ? 'animate-pulse' : ''}`}
                            style={{ backgroundColor: statusConfig.color }}
                          />
                          <h3 className="font-medium text-white text-sm leading-tight">{facility.name}</h3>
                        </div>
                        {!hasCoords && (
                          <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                            No coords
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mb-2 pl-5">
                        {facility.city || 'Unknown'}, {facility.state || 'Unknown'}
                      </p>
                      <div className="flex items-center justify-between pl-5">
                        <span className="text-[11px] text-slate-500">
                          {facility.completedMilestones}/{facility.totalMilestones} milestones
                        </span>
                        <div className="w-20 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${progress}%`,
                              backgroundColor: statusConfig.color
                            }}
                          />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 relative bg-slate-950">
          <div ref={mapContainer} className="absolute inset-0" />

          {!mapLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950">
              <div className="text-center">
                <div className="w-12 h-12 border-3 border-teal-500 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-slate-400">Loading map...</p>
              </div>
            </div>
          )}

          <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
            <button
              onClick={() => map.current?.zoomIn()}
              className="p-2.5 bg-slate-900/90 backdrop-blur-sm border border-slate-700/50 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-all shadow-lg"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => map.current?.zoomOut()}
              className="p-2.5 bg-slate-900/90 backdrop-blur-sm border border-slate-700/50 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-all shadow-lg"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <div className="w-full h-px bg-slate-700/50 my-1" />
            <button
              onClick={fitBoundsToFacilities}
              className="p-2.5 bg-slate-900/90 backdrop-blur-sm border border-slate-700/50 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-all shadow-lg"
              title="Fit to Facilities"
            >
              <Target className="w-4 h-4" />
            </button>
            <button
              onClick={resetView}
              className="p-2.5 bg-slate-900/90 backdrop-blur-sm border border-slate-700/50 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-all shadow-lg"
              title="Reset View"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <div className="w-full h-px bg-slate-700/50 my-1" />
            <button
              onClick={toggleFullscreen}
              className="p-2.5 bg-slate-900/90 backdrop-blur-sm border border-slate-700/50 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-all shadow-lg"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>

          <div className="absolute top-4 right-4 z-10">
            <div className="relative">
              <button
                onClick={() => setShowStylePicker(!showStylePicker)}
                className="p-2.5 bg-slate-900/90 backdrop-blur-sm border border-slate-700/50 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-all shadow-lg flex items-center gap-2"
              >
                <Layers className="w-4 h-4" />
                <span className="text-xs">Map Style</span>
              </button>

              {showStylePicker && (
                <>
                  <div className="fixed inset-0" onClick={() => setShowStylePicker(false)} />
                  <div className="absolute right-0 mt-2 bg-slate-900/95 backdrop-blur-sm border border-slate-700/50 rounded-lg shadow-xl overflow-hidden">
                    {MAP_STYLES.map(style => (
                      <button
                        key={style.id}
                        onClick={() => {
                          setMapStyle(style.url);
                          setShowStylePicker(false);
                        }}
                        className={`w-full px-4 py-2.5 text-left text-sm transition-colors flex items-center gap-2 ${
                          mapStyle === style.url
                            ? 'bg-teal-500/20 text-teal-400'
                            : 'text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {mapStyle === style.url && <span className="w-1.5 h-1.5 bg-teal-400 rounded-full" />}
                        {style.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="absolute bottom-6 right-4 bg-slate-900/95 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4 z-10 shadow-xl">
            <h3 className="font-semibold text-white text-xs uppercase tracking-wider mb-3 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-teal-400" />
              Status Legend
            </h3>
            <div className="space-y-2">
              {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                <div key={key} className="flex items-center gap-2.5">
                  <div
                    className={`w-3.5 h-3.5 rounded-full ${key === 'blocked' ? 'animate-pulse' : ''}`}
                    style={{ backgroundColor: config.color }}
                  />
                  <span className="text-slate-300 text-xs">{config.label}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-slate-700/50">
              <p className="text-[10px] text-slate-500">
                {facilitiesOnMap} facilities displayed
              </p>
            </div>
          </div>
        </div>
      </div>

      {detailPanelOpen && selectedFacility && (
        <FacilityDetailPanel
          facility={selectedFacility}
          onClose={() => {
            setDetailPanelOpen(false);
            setSelectedFacility(null);
          }}
          onSave={loadFacilities}
        />
      )}

      {importOpen && (
        <ImportData
          onImportComplete={loadFacilities}
          onClose={() => setImportOpen(false)}
        />
      )}
    </div>
  );
}
