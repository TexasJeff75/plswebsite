import React, { useState, useEffect, useRef } from 'react';
import MapLibreGL from 'maplibre-gl';
import { Search, ChevronDown, X, Plus, Upload } from 'lucide-react';
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

const REGIONS = ['All Regions', 'St. Louis Area', 'Kansas City Area', 'Rural Missouri', 'Kansas'];

const STATUS_CONFIG = {
  'not_started': { color: '#6b7280', label: 'Not Started' },
  'in_progress': { color: '#ffd93d', label: 'In Progress' },
  'live': { color: '#00d4aa', label: 'Live' },
  'blocked': { color: '#ff6b6b', label: 'Blocked' }
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

function CustomMarker({ facility, onClick, isSelected, color }) {
  const scale = isSelected ? 24 : 16;
  const isBlocked = facility.status === 'blocked';

  return (
    <div
      onClick={() => onClick(facility)}
      className={`cursor-pointer transition-all ${isBlocked ? 'animate-pulse' : ''}`}
      style={{
        width: `${scale}px`,
        height: `${scale}px`
      }}
    >
      <div
        style={{
          width: `${scale}px`,
          height: `${scale}px`,
          backgroundColor: color,
          border: '3px solid white',
          borderRadius: '50%',
          boxShadow: isSelected
            ? `0 0 20px rgba(0, 0, 0, 0.8), 0 0 10px ${color}, 0 4px 8px rgba(0, 0, 0, 0.4)`
            : `0 0 12px rgba(0, 0, 0, 0.6), 0 2px 4px rgba(0, 0, 0, 0.3)`,
          transform: isSelected ? 'scale(1.5)' : 'scale(1)',
          transformOrigin: 'center',
          transition: 'all 0.2s ease-in-out'
        }}
      />
    </div>
  );
}

export default function DeploymentTrackerMap() {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markersRef = useRef(new Map());

  const [facilities, setFacilities] = useState([]);
  const [filteredFacilities, setFilteredFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [regionFilter, setRegionFilter] = useState('All Regions');

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
    if (!mapContainer.current) return;

    map.current = new MapLibreGL.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: [-92.5, 38.5],
      zoom: 5.8,
      minZoom: 4,
      maxZoom: 18
    });

    const nav = new MapLibreGL.NavigationControl();
    map.current.addControl(nav, 'top-right');

    const scale = new MapLibreGL.ScaleControl();
    map.current.addControl(scale, 'bottom-left');

    map.current.on('click', (e) => {
      const features = map.current.queryRenderedFeatures({ layers: [] });
      if (features.length === 0) {
        setSelectedFacility(null);
      }
    });

    return () => {
      map.current?.remove();
    };
  }, []);

  useEffect(() => {
    if (!map.current || facilities.length === 0) return;

    markersRef.current.forEach(marker => marker.remove());
    markersRef.current.clear();

    filteredFacilities.forEach(facility => {
      if (!facility.latitude || !facility.longitude) return;

      const el = document.createElement('div');
      el.style.width = '100px';
      el.style.height = '100px';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';

      const color = STATUS_CONFIG[facility.status]?.color || '#6b7280';
      const isSelected = selectedFacility?.id === facility.id;
      const scale = isSelected ? 24 : 16;

      const markerEl = document.createElement('div');
      markerEl.style.width = `${scale}px`;
      markerEl.style.height = `${scale}px`;
      markerEl.style.backgroundColor = color;
      markerEl.style.border = '3px solid white';
      markerEl.style.borderRadius = '50%';
      markerEl.style.boxShadow = isSelected
        ? `0 0 20px rgba(0, 0, 0, 0.8), 0 0 10px ${color}, 0 4px 8px rgba(0, 0, 0, 0.4)`
        : `0 0 12px rgba(0, 0, 0, 0.6), 0 2px 4px rgba(0, 0, 0, 0.3)`;
      markerEl.style.cursor = 'pointer';
      markerEl.style.transition = 'all 0.2s ease-in-out';
      if (facility.status === 'blocked') {
        markerEl.style.animation = 'pulse 2s infinite';
      }

      markerEl.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelectedFacility(facility);
        setDetailPanelOpen(true);
      });

      markerEl.addEventListener('mouseenter', () => {
        markerEl.style.transform = 'scale(1.2)';
      });

      markerEl.addEventListener('mouseleave', () => {
        markerEl.style.transform = 'scale(1)';
      });

      el.appendChild(markerEl);

      const marker = new MapLibreGL.Marker({ element: el })
        .setLngLat([facility.longitude, facility.latitude])
        .addTo(map.current);

      markersRef.current.set(facility.id, marker);
    });
  }, [filteredFacilities, selectedFacility]);

  const handleFacilitySelect = (facility) => {
    setSelectedFacility(facility);
    setDetailPanelOpen(true);

    if (map.current && facility.latitude && facility.longitude) {
      map.current.flyTo({
        center: [facility.longitude, facility.latitude],
        zoom: 10,
        duration: 1500
      });
    }
  };

  const statusCounts = {
    total: facilities.length,
    live: facilities.filter(f => f.status === 'live').length,
    inProgress: facilities.filter(f => f.status === 'in_progress').length,
    blocked: facilities.filter(f => f.status === 'blocked').length,
    notStarted: facilities.filter(f => f.status === 'not_started').length
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-slate-950">
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>

      <div className="flex-none bg-slate-900 border-b border-slate-800 px-6 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Point-of-Care Deployment Tracker</h1>
            <p className="text-slate-400 text-xs">AMA Mini Lab Network - 30 Facilities</p>
          </div>

          <div className="flex gap-2">
            <div className="text-center bg-slate-800/50 px-3 py-1.5 rounded text-xs">
              <div className="font-bold text-white">{statusCounts.total}</div>
              <div className="text-slate-400 text-xs">Total</div>
            </div>
            <div className="text-center bg-teal-500/20 px-3 py-1.5 rounded border border-teal-500/30 text-xs">
              <div className="font-bold text-teal-400">{statusCounts.live}</div>
              <div className="text-teal-300 text-xs">Live</div>
            </div>
            <div className="text-center bg-amber-500/20 px-3 py-1.5 rounded border border-amber-500/30 text-xs">
              <div className="font-bold text-amber-400">{statusCounts.inProgress}</div>
              <div className="text-amber-300 text-xs">In Progress</div>
            </div>
            <div className="text-center bg-red-500/20 px-3 py-1.5 rounded border border-red-500/30 text-xs">
              <div className="font-bold text-red-400">{statusCounts.blocked}</div>
              <div className="text-red-300 text-xs">Blocked</div>
            </div>
            <div className="text-center bg-slate-700/50 px-3 py-1.5 rounded text-xs">
              <div className="font-bold text-slate-300">{statusCounts.notStarted}</div>
              <div className="text-slate-400 text-xs">Not Started</div>
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
                className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div className="flex gap-2 flex-wrap">
              {['All', 'Live', 'In Progress', 'Blocked', 'Not Started'].map(status => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    statusFilter === status
                      ? 'bg-teal-500 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {REGIONS.map(region => (
                <option key={region} value={region}>{region}</option>
              ))}
            </select>

            <div className="flex gap-2">
              <button
                onClick={() => setImportOpen(true)}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Upload className="w-4 h-4" />
                Import
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredFacilities.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">
                No facilities found
              </div>
            ) : (
              <div className="space-y-0.5">
                {filteredFacilities.map(facility => (
                  <button
                    key={facility.id}
                    onClick={() => handleFacilitySelect(facility)}
                    className={`w-full text-left p-3 transition-colors border-l-2 ${
                      selectedFacility?.id === facility.id
                        ? 'bg-teal-500/10 border-teal-500'
                        : 'hover:bg-slate-800/50 border-transparent'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: STATUS_CONFIG[facility.status]?.color }}
                        />
                        <h3 className="font-medium text-white text-sm">{facility.name}</h3>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 mb-1">
                      {facility.city}, {facility.state}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">
                        {facility.completedMilestones}/{facility.totalMilestones} milestones
                      </span>
                      <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-teal-500 transition-all"
                          style={{
                            width: `${(facility.completedMilestones / facility.totalMilestones) * 100}%`
                          }}
                        />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 relative bg-slate-950">
          <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

          <div className="absolute bottom-6 right-6 bg-slate-900/95 backdrop-blur-sm border border-slate-700 rounded-lg p-4 z-10 text-xs">
            <h3 className="font-semibold text-white mb-2">Status Legend</h3>
            <div className="space-y-1.5">
              {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                <div key={key} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: config.color }}
                  />
                  <span className="text-slate-300">{config.label}</span>
                </div>
              ))}
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
