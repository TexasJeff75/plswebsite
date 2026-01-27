import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { MapPin, Search, Loader2 } from 'lucide-react';
import { facilitiesService } from '../services/facilitiesService';
import { geocodingService } from '../services/geocodingService';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

function createCustomIcon(status) {
  const colors = {
    'Live': '#10b981',
    'In Progress': '#3b82f6',
    'Not Started': '#6b7280',
    'Blocked': '#ef4444'
  };

  const color = colors[status] || '#6b7280';

  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: 14px;
        height: 14px;
        background-color: ${color};
        border: 2px solid rgba(255, 255, 255, 0.9);
        border-radius: 50%;
        box-shadow: 0 0 8px rgba(0, 0, 0, 0.5);
      "></div>
    `,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -7]
  });
}

function MapController({ facilities, selectedFacility }) {
  const map = useMap();

  useEffect(() => {
    if (selectedFacility && selectedFacility.latitude && selectedFacility.longitude) {
      map.flyTo([selectedFacility.latitude, selectedFacility.longitude], 10, {
        duration: 1.5
      });
    } else if (facilities.length > 0) {
      const validFacilities = facilities.filter(f => f.latitude && f.longitude);
      if (validFacilities.length > 0) {
        const bounds = validFacilities.map(f => [f.latitude, f.longitude]);
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [selectedFacility, facilities, map]);

  return null;
}

export default function MapView() {
  const [facilities, setFacilities] = useState([]);
  const [facilitiesWithCoordinates, setFacilitiesWithCoordinates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [geocoding, setGeocoding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFacility, setSelectedFacility] = useState(null);

  useEffect(() => {
    loadFacilities();
  }, []);

  async function loadFacilities() {
    try {
      setLoading(true);
      const data = await facilitiesService.getAll({});
      setFacilities(data);

      setGeocoding(true);
      const geocoded = await geocodingService.geocodeFacilities(data);
      setFacilitiesWithCoordinates(geocoded);
    } catch (error) {
      console.error('Error loading facilities:', error);
    } finally {
      setLoading(false);
      setGeocoding(false);
    }
  }

  const filteredFacilities = facilities.filter(facility =>
    facility.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    facility.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    facility.state?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    facility.county?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const statusCounts = {
    total: facilities.length,
    live: facilities.filter(f => f.status === 'Live').length,
    inProgress: facilities.filter(f => f.status === 'In Progress').length,
    notStarted: facilities.filter(f => f.status === 'Not Started').length,
    blocked: facilities.filter(f => f.status === 'Blocked').length
  };

  const uniqueStates = [...new Set(facilities.filter(f => f.state).map(f => f.state))].length;

  const statusBadgeColor = (status) => {
    const colors = {
      'Live': 'bg-green-500/20 text-green-400 border-green-500/30',
      'In Progress': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      'Not Started': 'bg-slate-500/20 text-slate-400 border-slate-500/30',
      'Blocked': 'bg-red-500/20 text-red-400 border-red-500/30'
    };
    return colors[status] || 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  };

  return (
    <div className="h-screen flex flex-col bg-slate-950">
      <div className="flex-none bg-slate-900 border-b border-slate-800 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Facility Network Map</h1>
            <p className="text-slate-400 text-sm">Point-of-Care Testing Facilities - Deployment Status</p>
          </div>
          <div className="flex gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-teal-400">{statusCounts.total}</div>
              <div className="text-xs text-slate-400 uppercase tracking-wide">Facilities</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-teal-400">{uniqueStates}</div>
              <div className="text-xs text-slate-400 uppercase tracking-wide">States</div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 items-center">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded text-xs">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-green-400">Live ({statusCounts.live})</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded text-xs">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span className="text-blue-400">In Progress ({statusCounts.inProgress})</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-500/10 border border-slate-500/20 rounded text-xs">
            <div className="w-2 h-2 bg-slate-500 rounded-full"></div>
            <span className="text-slate-400">Not Started ({statusCounts.notStarted})</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded text-xs">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            <span className="text-red-400">Blocked ({statusCounts.blocked})</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col">
          <div className="flex-none p-4 border-b border-slate-800">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search facilities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin mb-3"/>
                <p className="text-slate-400 text-sm">Loading facilities...</p>
              </div>
            ) : geocoding ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <Loader2 className="w-8 h-8 text-teal-500 animate-spin mb-3"/>
                <p className="text-slate-400 text-sm">Geocoding addresses...</p>
                <p className="text-slate-500 text-xs mt-1">This may take a moment</p>
              </div>
            ) : filteredFacilities.length === 0 ? (
              <div className="text-center py-12 px-4">
                <MapPin className="w-12 h-12 mx-auto text-slate-700 mb-3" />
                <p className="text-slate-400 text-sm">No facilities found</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {filteredFacilities.map(facility => (
                  <button
                    key={facility.id}
                    onClick={() => setSelectedFacility(facility)}
                    className={`w-full text-left p-4 transition-colors ${
                      selectedFacility?.id === facility.id
                        ? 'bg-teal-500/10 border-l-2 border-teal-500'
                        : 'hover:bg-slate-800/50 border-l-2 border-transparent'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-medium text-white text-sm pr-2">{facility.name}</h3>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium border ${statusBadgeColor(facility.status)} flex-shrink-0`}>
                        {facility.status || 'N/A'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mb-1">
                      {facility.address || `${facility.city || 'Unknown'}, ${facility.state || 'Unknown'}`}
                    </p>
                    {facility.county && (
                      <p className="text-xs text-slate-500">
                        <MapPin className="w-3 h-3 inline mr-1" />
                        {facility.county}
                      </p>
                    )}
                    {facility.phase && (
                      <div className="mt-2 text-xs text-slate-500">
                        Phase: {facility.phase}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 relative">
          {geocoding ? (
            <div className="flex items-center justify-center h-full bg-slate-950">
              <div className="text-center">
                <Loader2 className="w-16 h-16 mx-auto text-teal-500 animate-spin mb-4" />
                <h3 className="text-white text-lg font-medium mb-2">Geocoding Facilities</h3>
                <p className="text-slate-400 text-sm">
                  Converting addresses to map coordinates...
                </p>
                <p className="text-slate-500 text-xs mt-2">
                  {facilitiesWithCoordinates.length} of {facilities.length} completed
                </p>
              </div>
            </div>
          ) : facilitiesWithCoordinates.length > 0 ? (
            <MapContainer
              center={[39.8283, -98.5795]}
              zoom={4}
              style={{ height: '100%', width: '100%' }}
              className="z-0"
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              />
              <MapController facilities={facilitiesWithCoordinates} selectedFacility={selectedFacility} />
              {facilitiesWithCoordinates.map(facility => (
                <Marker
                  key={facility.id}
                  position={[facility.latitude, facility.longitude]}
                  icon={createCustomIcon(facility.status)}
                >
                  <Popup>
                    <div className="p-2 min-w-[200px]">
                      <h3 className="font-bold text-sm mb-2">{facility.name}</h3>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-600">Status:</span>
                          <span className="font-medium">{facility.status}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">Location:</span>
                          <span>{facility.city}, {facility.state}</span>
                        </div>
                        {facility.county && (
                          <div className="flex justify-between">
                            <span className="text-slate-600">County:</span>
                            <span>{facility.county}</span>
                          </div>
                        )}
                        {facility.phase && (
                          <div className="flex justify-between">
                            <span className="text-slate-600">Phase:</span>
                            <span>{facility.phase}</span>
                          </div>
                        )}
                      </div>
                      <Link
                        to={`/facilities/${facility.id}`}
                        className="mt-3 block w-full text-center px-3 py-1.5 bg-teal-500 hover:bg-teal-600 text-white rounded text-xs font-medium transition-colors"
                      >
                        View Details
                      </Link>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          ) : (
            <div className="flex items-center justify-center h-full bg-slate-950">
              <div className="text-center">
                <MapPin className="w-16 h-16 mx-auto text-slate-700 mb-4" />
                <h3 className="text-white text-lg font-medium mb-2">No Facility Coordinates</h3>
                <p className="text-slate-400 text-sm">
                  Add latitude and longitude coordinates to facilities to display them on the map.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
