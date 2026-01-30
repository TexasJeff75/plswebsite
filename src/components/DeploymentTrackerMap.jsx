import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Search, X, Upload, Maximize2, Minimize2, MapPin, Activity, Target, ZoomIn, ZoomOut, RotateCcw, Cloud, CloudRain } from 'lucide-react';
import { facilitiesService } from '../services/facilitiesService';
import { weatherService } from '../services/weatherService';
import FacilityDetailPanel from './FacilityDetailPanel';
import ImportData from './ImportData';

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
  'not_started': { color: '#6b7280', label: 'Not Started' },
  'in_progress': { color: '#fbbf24', label: 'In Progress' },
  'live': { color: '#10b981', label: 'Live' },
  'blocked': { color: '#ef4444', label: 'Blocked' }
};

const defaultCenter = [38.5, -92.5];
const defaultZoom = 5;

function calculateFacilityStatus(milestones) {
  if (!milestones || milestones.length === 0) return 'not_started';

  const completedCount = milestones.filter(m => m.status === 'complete').length;
  const blockedCount = milestones.filter(m => m.status === 'blocked').length;

  if (blockedCount > 0) return 'blocked';
  if (completedCount === milestones.length) return 'live';
  if (completedCount > 0) return 'in_progress';
  return 'not_started';
}

function createCustomIcon(color, isSelected) {
  const size = isSelected ? 28 : 18;
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background-color: ${color};
        border: 2px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        ${isSelected ? 'animation: pulse 2s infinite;' : ''}
      "></div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2]
  });
}

function MapController({ center, zoom, fitBounds }) {
  const map = useMap();

  useEffect(() => {
    if (fitBounds && fitBounds.length > 0) {
      map.fitBounds(fitBounds, { padding: [50, 50], maxZoom: 12 });
    } else if (center && zoom) {
      map.setView(center, zoom);
    }
  }, [map, center, zoom, fitBounds]);

  return null;
}

function RadarLayer({ enabled, opacity }) {
  const map = useMap();
  const radarLayerRef = useRef(null);

  useEffect(() => {
    if (!map) return;

    const fetchRadarTimestamps = async () => {
      try {
        const response = await fetch('https://api.rainviewer.com/public/weather-maps.json');
        const data = await response.json();
        return data;
      } catch (error) {
        console.error('Error fetching radar timestamps:', error);
        return null;
      }
    };

    const updateRadar = async () => {
      if (radarLayerRef.current) {
        map.removeLayer(radarLayerRef.current);
        radarLayerRef.current = null;
      }

      if (enabled) {
        const data = await fetchRadarTimestamps();
        if (data && data.radar && data.radar.past.length > 0) {
          const latestTimestamp = data.radar.past[data.radar.past.length - 1].time;
          const radarUrl = `https://tilecache.rainviewer.com/v2/radar/${latestTimestamp}/256/{z}/{x}/{y}/6/1_1.png`;

          radarLayerRef.current = L.tileLayer(radarUrl, {
            opacity: opacity,
            zIndex: 500,
            attribution: '&copy; <a href="https://www.rainviewer.com">RainViewer</a>'
          });

          radarLayerRef.current.addTo(map);
        }
      }
    };

    updateRadar();

    return () => {
      if (radarLayerRef.current) {
        map.removeLayer(radarLayerRef.current);
        radarLayerRef.current = null;
      }
    };
  }, [map, enabled, opacity]);

  return null;
}

function MapControls({ onZoomIn, onZoomOut, onFitBounds, onReset, onFullscreen, isFullscreen, onWeatherToggle, weatherEnabled, onRadarToggle, radarEnabled }) {
  return (
    <div className="absolute top-4 left-4 flex flex-col gap-2 z-[1000]">
      <button
        onClick={onZoomIn}
        className="p-2.5 bg-slate-900/90 backdrop-blur-sm border border-slate-700/50 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-all shadow-lg"
        title="Zoom In"
      >
        <ZoomIn className="w-4 h-4" />
      </button>
      <button
        onClick={onZoomOut}
        className="p-2.5 bg-slate-900/90 backdrop-blur-sm border border-slate-700/50 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-all shadow-lg"
        title="Zoom Out"
      >
        <ZoomOut className="w-4 h-4" />
      </button>
      <div className="w-full h-px bg-slate-700/50 my-1" />
      <button
        onClick={onFitBounds}
        className="p-2.5 bg-slate-900/90 backdrop-blur-sm border border-slate-700/50 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-all shadow-lg"
        title="Fit to Facilities"
      >
        <Target className="w-4 h-4" />
      </button>
      <button
        onClick={onReset}
        className="p-2.5 bg-slate-900/90 backdrop-blur-sm border border-slate-700/50 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-all shadow-lg"
        title="Reset View"
      >
        <RotateCcw className="w-4 h-4" />
      </button>
      <div className="w-full h-px bg-slate-700/50 my-1" />
      <button
        onClick={onWeatherToggle}
        className={`p-2.5 backdrop-blur-sm border rounded-lg transition-all shadow-lg ${
          weatherEnabled
            ? 'bg-sky-500/20 border-sky-500/50 text-sky-400 hover:bg-sky-500/30'
            : 'bg-slate-900/90 border-slate-700/50 text-slate-300 hover:text-white hover:bg-slate-800'
        }`}
        title={weatherEnabled ? 'Hide Weather' : 'Show Weather'}
      >
        <Cloud className="w-4 h-4" />
      </button>
      <button
        onClick={onRadarToggle}
        className={`p-2.5 backdrop-blur-sm border rounded-lg transition-all shadow-lg ${
          radarEnabled
            ? 'bg-blue-500/20 border-blue-500/50 text-blue-400 hover:bg-blue-500/30'
            : 'bg-slate-900/90 border-slate-700/50 text-slate-300 hover:text-white hover:bg-slate-800'
        }`}
        title={radarEnabled ? 'Hide Radar' : 'Show Radar'}
      >
        <CloudRain className="w-4 h-4" />
      </button>
      <button
        onClick={onFullscreen}
        className="p-2.5 bg-slate-900/90 backdrop-blur-sm border border-slate-700/50 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-all shadow-lg"
        title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
      >
        {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
      </button>
    </div>
  );
}

function MapControlHandler({ onZoomIn, onZoomOut, onFitBounds, onReset }) {
  const map = useMap();

  useEffect(() => {
    const handleZoomIn = () => map.zoomIn();
    const handleZoomOut = () => map.zoomOut();
    const handleReset = () => map.setView(defaultCenter, defaultZoom);

    if (onZoomIn) {
      const zoomInEl = document.querySelector('[title="Zoom In"]');
      if (zoomInEl) zoomInEl.onclick = handleZoomIn;
    }

    if (onZoomOut) {
      const zoomOutEl = document.querySelector('[title="Zoom Out"]');
      if (zoomOutEl) zoomOutEl.onclick = handleZoomOut;
    }

    if (onReset) {
      const resetEl = document.querySelector('[title="Reset View"]');
      if (resetEl) resetEl.onclick = handleReset;
    }

    if (onFitBounds) {
      const fitEl = document.querySelector('[title="Fit to Facilities"]');
      if (fitEl) fitEl.onclick = onFitBounds;
    }
  }, [map, onZoomIn, onZoomOut, onFitBounds, onReset]);

  return null;
}

export default function DeploymentTrackerMap() {
  const [facilities, setFacilities] = useState([]);
  const [filteredFacilities, setFilteredFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [regionFilter, setRegionFilter] = useState('All Regions');
  const [regions, setRegions] = useState(DEFAULT_REGIONS);

  const [mapKey, setMapKey] = useState(0);
  const [fitBounds, setFitBounds] = useState(null);

  const [weatherEnabled, setWeatherEnabled] = useState(false);
  const [weatherData, setWeatherData] = useState({});
  const [loadingWeather, setLoadingWeather] = useState(false);

  const [radarEnabled, setRadarEnabled] = useState(false);
  const [radarOpacity, setRadarOpacity] = useState(0.6);

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
    if (weatherEnabled && filteredFacilities.length > 0) {
      loadWeatherData();
    }
  }, [weatherEnabled, filteredFacilities]);

  const loadWeatherData = async () => {
    setLoadingWeather(true);
    try {
      const weatherMap = await weatherService.getWeatherForFacilities(filteredFacilities);
      setWeatherData(weatherMap);
    } catch (error) {
      console.error('Error loading weather:', error);
    } finally {
      setLoadingWeather(false);
    }
  };

  const toggleWeather = () => {
    setWeatherEnabled(!weatherEnabled);
  };

  const toggleRadar = () => {
    setRadarEnabled(!radarEnabled);
  };

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

  const handleFacilitySelect = async (facility) => {
    setSelectedFacility(facility);
    setDetailPanelOpen(true);
    if (facility.latitude && facility.longitude) {
      setFitBounds([[parseFloat(facility.latitude), parseFloat(facility.longitude)]]);
      setMapKey(prev => prev + 1);

      if (weatherEnabled && !weatherData[facility.id]) {
        try {
          const weather = await weatherService.getWeatherForLocation(
            parseFloat(facility.latitude),
            parseFloat(facility.longitude)
          );
          setWeatherData(prev => ({
            ...prev,
            [facility.id]: weather
          }));
        } catch (error) {
          console.error('Error loading weather for facility:', error);
        }
      }
    }
  };

  const handleFitToFacilities = () => {
    const facilitiesWithCoords = filteredFacilities.filter(f =>
      f.latitude != null && f.longitude != null
    );

    if (facilitiesWithCoords.length > 0) {
      const bounds = facilitiesWithCoords.map(f => [
        parseFloat(f.latitude),
        parseFloat(f.longitude)
      ]);
      setFitBounds(bounds);
      setMapKey(prev => prev + 1);
    }
  };

  const handleReset = () => {
    setFitBounds(null);
    setMapKey(prev => prev + 1);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

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
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.1); }
        }
        .custom-marker {
          background: transparent !important;
          border: none !important;
        }
        .leaflet-container {
          background: #0f172a;
          font-family: inherit;
        }
        .leaflet-popup-content-wrapper {
          background: white;
          border-radius: 8px;
          padding: 0;
        }
        .leaflet-popup-content {
          margin: 0;
          min-width: 200px;
        }
        .leaflet-popup-tip {
          background: white;
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
                          : 'hover:bg-slate-800/30 border-transparent'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2 flex-1">
                          <div
                            className={`w-3 h-3 rounded-full flex-shrink-0 ${facility.status === 'blocked' ? 'animate-pulse' : ''}`}
                            style={{ backgroundColor: statusConfig.color }}
                          />
                          <h3 className="font-medium text-white text-sm leading-tight">{facility.name}</h3>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {weatherEnabled && weatherData[facility.id] && (
                            <span className="text-xs" title={`${weatherData[facility.id].temperature}°F - ${weatherData[facility.id].icon.text}`}>
                              {weatherData[facility.id].icon.emoji}
                            </span>
                          )}
                          {!hasCoords && (
                            <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                              No coords
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-slate-400 pl-5">
                          {facility.city || 'Unknown'}, {facility.state || 'Unknown'}
                        </p>
                        {weatherEnabled && weatherData[facility.id] && (
                          <span className="text-xs text-sky-400">
                            {weatherData[facility.id].temperature}°F
                          </span>
                        )}
                      </div>
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
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950 z-20">
              <div className="text-center">
                <div className="w-12 h-12 border-3 border-teal-500 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-slate-400">Loading map...</p>
              </div>
            </div>
          ) : (
            <MapContainer
              key={mapKey}
              center={defaultCenter}
              zoom={defaultZoom}
              style={{ height: '100%', width: '100%' }}
              zoomControl={false}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <MapController
                center={fitBounds ? null : defaultCenter}
                zoom={fitBounds ? null : defaultZoom}
                fitBounds={fitBounds}
              />

              <MapControlHandler
                onFitBounds={handleFitToFacilities}
                onReset={handleReset}
              />

              <RadarLayer enabled={radarEnabled} opacity={radarOpacity} />

              {filteredFacilities.map(facility => {
                if (!facility.latitude || !facility.longitude) return null;

                const position = [parseFloat(facility.latitude), parseFloat(facility.longitude)];
                const color = STATUS_CONFIG[facility.status]?.color || '#6b7280';
                const isSelected = selectedFacility?.id === facility.id;
                const progress = (facility.completedMilestones / facility.totalMilestones) * 100;

                return (
                  <Marker
                    key={facility.id}
                    position={position}
                    icon={createCustomIcon(color, isSelected)}
                    eventHandlers={{
                      click: () => handleFacilitySelect(facility)
                    }}
                  >
                    <Popup>
                      <div className="p-3 min-w-48">
                        <div className="flex items-center gap-2 mb-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                          <h3 className="font-semibold text-sm text-slate-900">{facility.name}</h3>
                        </div>
                        <p className="text-xs text-slate-600 mb-2">
                          {facility.city}, {facility.state}
                        </p>

                        {weatherEnabled && weatherData[facility.id] && (
                          <div className="bg-sky-50 border border-sky-200 rounded-lg p-2 mb-2">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <span className="text-2xl">{weatherData[facility.id].icon.emoji}</span>
                                <div>
                                  <div className="text-lg font-bold text-slate-900">
                                    {weatherData[facility.id].temperature}°F
                                  </div>
                                  <div className="text-xs text-slate-600">
                                    {weatherData[facility.id].icon.text}
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs mt-2 pt-2 border-t border-sky-200">
                              <div>
                                <span className="text-slate-500">Feels like:</span>
                                <span className="ml-1 font-medium text-slate-700">
                                  {weatherData[facility.id].feelsLike}°F
                                </span>
                              </div>
                              <div>
                                <span className="text-slate-500">Humidity:</span>
                                <span className="ml-1 font-medium text-slate-700">
                                  {weatherData[facility.id].humidity}%
                                </span>
                              </div>
                              <div className="col-span-2">
                                <span className="text-slate-500">Wind:</span>
                                <span className="ml-1 font-medium text-slate-700">
                                  {weatherData[facility.id].windDirection} {weatherData[facility.id].windSpeed} mph
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-500">Status</span>
                          <span className="font-medium" style={{ color }}>
                            {STATUS_CONFIG[facility.status]?.label}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs mb-2">
                          <span className="text-slate-500">Progress</span>
                          <span className="font-medium text-slate-700">
                            {facility.completedMilestones}/{facility.totalMilestones}
                          </span>
                        </div>
                        <div className="bg-slate-200 h-1 rounded-full overflow-hidden">
                          <div
                            className="h-full transition-all"
                            style={{
                              width: `${progress}%`,
                              backgroundColor: color
                            }}
                          />
                        </div>
                        <p className="text-xs text-slate-400 mt-2 text-center">Click for details</p>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          )}

          <MapControls
            onZoomIn={() => {}}
            onZoomOut={() => {}}
            onFitBounds={handleFitToFacilities}
            onReset={handleReset}
            onFullscreen={toggleFullscreen}
            isFullscreen={isFullscreen}
            onWeatherToggle={toggleWeather}
            weatherEnabled={weatherEnabled}
            onRadarToggle={toggleRadar}
            radarEnabled={radarEnabled}
          />

          <div className="absolute bottom-6 right-4 bg-slate-900/95 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4 z-[1000] shadow-xl">
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
            {(weatherEnabled || radarEnabled) && (
              <div className="mt-3 pt-3 border-t border-slate-700/50 space-y-2">
                {weatherEnabled && (
                  <div className="flex items-center gap-2">
                    <Cloud className="w-3.5 h-3.5 text-sky-400" />
                    <span className="text-sky-400 text-xs font-medium">Weather Enabled</span>
                    {loadingWeather && (
                      <span className="text-[10px] text-slate-500">(Loading...)</span>
                    )}
                  </div>
                )}
                {radarEnabled && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CloudRain className="w-3.5 h-3.5 text-blue-400" />
                      <span className="text-blue-400 text-xs font-medium">Radar Active</span>
                    </div>
                    <div className="pl-5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-slate-400">Opacity</span>
                        <span className="text-[10px] text-slate-300">{Math.round(radarOpacity * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={radarOpacity * 100}
                        onChange={(e) => setRadarOpacity(e.target.value / 100)}
                        className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
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
