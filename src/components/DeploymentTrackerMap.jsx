import React, { useState, useEffect, useCallback } from 'react';
import { GoogleMap, LoadScript, Marker, InfoWindow } from '@react-google-maps/api';
import { Search, X, Upload, Maximize2, Minimize2, Eye, MapPin, Activity, Target, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { facilitiesService } from '../services/facilitiesService';
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
  'not_started': { color: '#6b7280', label: 'Not Started', glow: 'rgba(107, 114, 128, 0.5)' },
  'in_progress': { color: '#fbbf24', label: 'In Progress', glow: 'rgba(251, 191, 36, 0.5)' },
  'live': { color: '#10b981', label: 'Live', glow: 'rgba(16, 185, 129, 0.5)' },
  'blocked': { color: '#ef4444', label: 'Blocked', glow: 'rgba(239, 68, 68, 0.5)' }
};

const mapContainerStyle = {
  width: '100%',
  height: '100%'
};

const defaultCenter = {
  lat: 38.5,
  lng: -92.5
};

const mapOptions = {
  disableDefaultUI: false,
  zoomControl: false,
  mapTypeControl: false,
  scaleControl: true,
  streetViewControl: false,
  rotateControl: false,
  fullscreenControl: false,
  styles: [
    {
      featureType: 'all',
      elementType: 'labels.text.fill',
      stylers: [{ color: '#ffffff' }]
    },
    {
      featureType: 'all',
      elementType: 'labels.text.stroke',
      stylers: [{ visibility: 'on' }, { color: '#000000' }, { weight: 2 }]
    },
    {
      featureType: 'all',
      elementType: 'geometry',
      stylers: [{ color: '#1e293b' }]
    },
    {
      featureType: 'water',
      elementType: 'geometry',
      stylers: [{ color: '#0f172a' }]
    },
    {
      featureType: 'road',
      elementType: 'geometry',
      stylers: [{ color: '#334155' }]
    }
  ]
};

function calculateFacilityStatus(milestones) {
  if (!milestones || milestones.length === 0) return 'not_started';

  const completedCount = milestones.filter(m => m.status === 'complete').length;
  const blockedCount = milestones.filter(m => m.status === 'blocked').length;

  if (blockedCount > 0) return 'blocked';
  if (completedCount === milestones.length) return 'live';
  if (completedCount > 0) return 'in_progress';
  return 'not_started';
}

function createMarkerIcon(color, isSelected) {
  const size = isSelected ? 28 : 18;
  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 2}" fill="${color}" stroke="#ffffff" stroke-width="2"/>
    </svg>
  `;
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
}

export default function DeploymentTrackerMap() {
  const [facilities, setFacilities] = useState([]);
  const [filteredFacilities, setFilteredFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [hoveredFacility, setHoveredFacility] = useState(null);
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [regionFilter, setRegionFilter] = useState('All Regions');
  const [regions, setRegions] = useState(DEFAULT_REGIONS);

  const [map, setMap] = useState(null);
  const [center, setCenter] = useState(defaultCenter);
  const [zoom, setZoom] = useState(5);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

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

  const onLoad = useCallback((map) => {
    setMap(map);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  const handleMarkerClick = (facility) => {
    setSelectedFacility(facility);
    setDetailPanelOpen(true);
    if (map && facility.latitude && facility.longitude) {
      map.panTo({ lat: parseFloat(facility.latitude), lng: parseFloat(facility.longitude) });
      map.setZoom(12);
    }
  };

  const handleFacilitySelect = (facility) => {
    setSelectedFacility(facility);
    setDetailPanelOpen(true);
    if (map && facility.latitude && facility.longitude) {
      map.panTo({ lat: parseFloat(facility.latitude), lng: parseFloat(facility.longitude) });
      map.setZoom(12);
    }
  };

  const fitBoundsToFacilities = useCallback(() => {
    if (!map) return;

    const facilitiesWithCoords = filteredFacilities.filter(f =>
      f.latitude != null && f.longitude != null
    );

    if (facilitiesWithCoords.length === 0) return;

    if (facilitiesWithCoords.length === 1) {
      const facility = facilitiesWithCoords[0];
      map.panTo({ lat: parseFloat(facility.latitude), lng: parseFloat(facility.longitude) });
      map.setZoom(10);
      return;
    }

    const bounds = new window.google.maps.LatLngBounds();
    facilitiesWithCoords.forEach(f => {
      bounds.extend({ lat: parseFloat(f.latitude), lng: parseFloat(f.longitude) });
    });

    map.fitBounds(bounds, { left: 400, right: 50, top: 50, bottom: 50 });
  }, [map, filteredFacilities]);

  const resetView = useCallback(() => {
    if (!map) return;
    map.panTo(defaultCenter);
    map.setZoom(5);
  }, [map]);

  const handleZoomIn = useCallback(() => {
    if (!map) return;
    map.setZoom(map.getZoom() + 1);
  }, [map]);

  const handleZoomOut = useCallback(() => {
    if (!map) return;
    map.setZoom(map.getZoom() - 1);
  }, [map]);

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

  if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <div className="text-center max-w-lg p-8 bg-slate-800 rounded-lg border border-slate-700">
          <MapPin className="w-16 h-16 text-teal-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-4">Google Maps API Key Required</h2>
          <p className="text-slate-400 mb-6">
            To use the deployment tracker map, you need to add your Google Maps API key.
          </p>
          <div className="bg-slate-900 rounded-lg p-4 mb-6 text-left">
            <h3 className="text-white font-semibold mb-3">Quick Setup:</h3>
            <ol className="text-slate-300 text-sm space-y-2">
              <li>1. Go to <a href="https://console.cloud.google.com/google/maps-apis" target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:underline">Google Cloud Console</a></li>
              <li>2. Enable the <strong>Maps JavaScript API</strong></li>
              <li>3. Create an API key</li>
              <li>4. Add to your <code className="bg-slate-950 px-2 py-1 rounded text-xs">.env</code> file:</li>
            </ol>
            <div className="mt-3 bg-slate-950 p-3 rounded text-xs text-teal-300 font-mono">
              VITE_GOOGLE_MAPS_API_KEY=your_api_key_here
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Google Maps offers $200/month free credit (covers ~28,000 map loads)
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-[calc(100vh-3.5rem)] flex flex-col bg-slate-950 ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      <style>{`
        @keyframes pulse-marker {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.1); }
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
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950 z-20">
              <div className="text-center">
                <div className="w-12 h-12 border-3 border-teal-500 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-slate-400">Loading map...</p>
              </div>
            </div>
          )}

          <LoadScript googleMapsApiKey={apiKey}>
            <GoogleMap
              mapContainerStyle={mapContainerStyle}
              center={center}
              zoom={zoom}
              onLoad={onLoad}
              onUnmount={onUnmount}
              options={mapOptions}
            >
              {filteredFacilities.map(facility => {
                if (!facility.latitude || !facility.longitude) return null;

                const position = {
                  lat: parseFloat(facility.latitude),
                  lng: parseFloat(facility.longitude)
                };

                const color = STATUS_CONFIG[facility.status]?.color || '#6b7280';
                const isSelected = selectedFacility?.id === facility.id;

                return (
                  <Marker
                    key={facility.id}
                    position={position}
                    icon={{
                      url: createMarkerIcon(color, isSelected),
                      scaledSize: isSelected
                        ? new window.google.maps.Size(28, 28)
                        : new window.google.maps.Size(18, 18),
                    }}
                    onClick={() => handleMarkerClick(facility)}
                    onMouseOver={() => setHoveredFacility(facility)}
                    onMouseOut={() => setHoveredFacility(null)}
                  />
                );
              })}

              {hoveredFacility && hoveredFacility.latitude && hoveredFacility.longitude && (
                <InfoWindow
                  position={{
                    lat: parseFloat(hoveredFacility.latitude),
                    lng: parseFloat(hoveredFacility.longitude)
                  }}
                  onCloseClick={() => setHoveredFacility(null)}
                >
                  <div className="p-3 min-w-48">
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: STATUS_CONFIG[hoveredFacility.status]?.color }}
                      />
                      <h3 className="font-semibold text-sm text-slate-900">{hoveredFacility.name}</h3>
                    </div>
                    <p className="text-xs text-slate-600 mb-2">
                      {hoveredFacility.city}, {hoveredFacility.state}
                    </p>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500">Status</span>
                      <span className="font-medium" style={{ color: STATUS_CONFIG[hoveredFacility.status]?.color }}>
                        {STATUS_CONFIG[hoveredFacility.status]?.label}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs mb-2">
                      <span className="text-slate-500">Progress</span>
                      <span className="font-medium text-slate-700">
                        {hoveredFacility.completedMilestones}/{hoveredFacility.totalMilestones}
                      </span>
                    </div>
                    <div className="bg-slate-200 h-1 rounded-full overflow-hidden">
                      <div
                        className="h-full transition-all"
                        style={{
                          width: `${(hoveredFacility.completedMilestones / hoveredFacility.totalMilestones) * 100}%`,
                          backgroundColor: STATUS_CONFIG[hoveredFacility.status]?.color
                        }}
                      />
                    </div>
                    <p className="text-xs text-slate-400 mt-2 text-center">Click for details</p>
                  </div>
                </InfoWindow>
              )}
            </GoogleMap>
          </LoadScript>

          <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
            <button
              onClick={handleZoomIn}
              className="p-2.5 bg-slate-900/90 backdrop-blur-sm border border-slate-700/50 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-all shadow-lg"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={handleZoomOut}
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
