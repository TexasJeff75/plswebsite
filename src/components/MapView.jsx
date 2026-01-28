import React, { useEffect, useState, useRef, useCallback, useMemo, memo } from 'react';
import { Link } from 'react-router-dom';
import Map, { Marker, Popup } from 'react-map-gl';
import { MapPin, Search, Loader2, Map as MapIcon, Layers } from 'lucide-react';
import { facilitiesService } from '../services/facilitiesService';
import { geocodingService } from '../services/geocodingService';
import 'maplibre-gl/dist/maplibre-gl.css';

const STATUS_COLORS = {
  'Live': '#10b981',
  'In Progress': '#3b82f6',
  'Not Started': '#f59e0b',
  'Blocked': '#ef4444'
};

const MAP_STYLES = [
  { id: 'positron', name: 'Light Streets', url: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json' },
  { id: 'dark-matter', name: 'Dark Streets', url: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json' },
  { id: 'voyager', name: 'Voyager', url: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json' },
  { id: 'osm', name: 'OpenStreetMap', url: 'https://tiles.openfreemap.org/styles/liberty' }
];

const MarkerDot = memo(function MarkerDot({ color, isSelected }) {
  const size = isSelected ? 20 : 14;
  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: color,
        border: '3px solid rgba(255, 255, 255, 0.95)',
        borderRadius: '50%',
        boxShadow: isSelected
          ? `0 0 20px rgba(0, 0, 0, 0.8), 0 0 10px ${color}, 0 4px 8px rgba(0, 0, 0, 0.4)`
          : `0 0 12px rgba(0, 0, 0, 0.6), 0 2px 4px rgba(0, 0, 0, 0.3)`
      }}
    />
  );
});

const CustomMarker = memo(function CustomMarker({ facility, onClick, isSelected }) {
  const color = STATUS_COLORS[facility.status] || '#6b7280';

  const handleClick = useCallback((e) => {
    e.stopPropagation();
    onClick(facility);
  }, [facility, onClick]);

  return (
    <Marker
      longitude={facility.longitude}
      latitude={facility.latitude}
      offset={[0, 0]}
    >
      <div
        onClick={handleClick}
        style={{
          width: '28px',
          height: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          marginLeft: '-14px',
          marginTop: '-14px'
        }}
      >
        <MarkerDot color={color} isSelected={isSelected} />
      </div>
    </Marker>
  );
});

export default function MapView() {
  const [facilities, setFacilities] = useState([]);
  const [facilitiesWithCoordinates, setFacilitiesWithCoordinates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodingProgress, setGeocodingProgress] = useState({ current: 0, total: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [popupInfo, setPopupInfo] = useState(null);
  const [mapStyle, setMapStyle] = useState(MAP_STYLES[0].url);
  const mapRef = useRef(null);

  const handleMarkerClick = useCallback((facility) => {
    setPopupInfo(facility);
  }, []);

  useEffect(() => {
    loadFacilities();
  }, []);

  useEffect(() => {
    if (mapRef.current && selectedFacility?.latitude && selectedFacility?.longitude) {
      mapRef.current.flyTo({
        center: [selectedFacility.longitude, selectedFacility.latitude],
        zoom: 10,
        duration: 1500
      });
      setPopupInfo(selectedFacility);
    }
  }, [selectedFacility]);

  async function loadFacilities() {
    try {
      setLoading(true);
      console.log('Loading facilities from database...');
      const data = await facilitiesService.getAll({});
      console.log('Loaded facilities:', data);
      setFacilities(data);

      const facilitiesWithCoords = data.filter(f =>
        f.latitude != null && f.longitude != null
      );

      const facilitiesWithoutCoords = data.filter(f =>
        f.latitude == null || f.longitude == null
      );

      console.log(`${facilitiesWithCoords.length} facilities have coordinates`);
      console.log(`${facilitiesWithoutCoords.length} facilities need geocoding`);

      setFacilitiesWithCoordinates(facilitiesWithCoords);
      setLoading(false);

      if (facilitiesWithoutCoords.length > 0) {
        setGeocoding(true);
        setGeocodingProgress({ current: 0, total: facilitiesWithoutCoords.length });

        const geocoded = await geocodingService.geocodeFacilities(
          facilitiesWithoutCoords,
          (current, total) => {
            setGeocodingProgress({ current, total });
          }
        );

        console.log('Geocoded facilities:', geocoded);

        for (const facility of geocoded) {
          if (facility.latitude && facility.longitude) {
            console.log(`Saving coordinates for ${facility.name}:`, facility.latitude, facility.longitude);
            await facilitiesService.update(facility.id, {
              latitude: facility.latitude,
              longitude: facility.longitude
            });
          }
        }

        const allFacilitiesWithCoords = [...facilitiesWithCoords, ...geocoded].filter(f =>
          f.latitude != null &&
          f.longitude != null &&
          !isNaN(f.latitude) &&
          !isNaN(f.longitude)
        );

        console.log('Total facilities with valid coordinates:', allFacilitiesWithCoords.length);
        setFacilitiesWithCoordinates(allFacilitiesWithCoords);
        setGeocoding(false);
      }
    } catch (error) {
      console.error('Error loading facilities:', error);
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
      'Not Started': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      'Blocked': 'bg-red-500/20 text-red-400 border-red-500/30'
    };
    return colors[status] || 'bg-amber-500/20 text-amber-400 border-amber-500/30';
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
            <div className="w-2.5 h-2.5 bg-green-500 rounded-full shadow-lg shadow-green-500/50"></div>
            <span className="text-green-400 font-medium">Live ({statusCounts.live})</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded text-xs">
            <div className="w-2.5 h-2.5 bg-blue-500 rounded-full shadow-lg shadow-blue-500/50"></div>
            <span className="text-blue-400 font-medium">In Progress ({statusCounts.inProgress})</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded text-xs">
            <div className="w-2.5 h-2.5 bg-amber-500 rounded-full shadow-lg shadow-amber-500/50"></div>
            <span className="text-amber-400 font-medium">Not Started ({statusCounts.notStarted})</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded text-xs">
            <div className="w-2.5 h-2.5 bg-red-500 rounded-full shadow-lg shadow-red-500/50"></div>
            <span className="text-red-400 font-medium">Blocked ({statusCounts.blocked})</span>
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
                <p className="text-slate-500 text-xs mt-1">
                  {geocodingProgress.current} / {geocodingProgress.total}
                </p>
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
                  {geocodingProgress.current} of {geocodingProgress.total} processed
                </p>
                <div className="w-64 mx-auto mt-4 bg-slate-800 rounded-full h-2">
                  <div
                    className="bg-teal-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${geocodingProgress.total > 0 ? (geocodingProgress.current / geocodingProgress.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          ) : facilitiesWithCoordinates.length > 0 ? (
            <div className="relative w-full h-full">
              <Map
                ref={mapRef}
                initialViewState={{
                  longitude: -98.5795,
                  latitude: 39.8283,
                  zoom: 4
                }}
                style={{ width: '100%', height: '100%' }}
                mapStyle={mapStyle}
                mapLib={import('maplibre-gl')}
                reuseMaps={false}
              >
              {facilitiesWithCoordinates.map(facility => (
                <CustomMarker
                  key={facility.id}
                  facility={facility}
                  onClick={handleMarkerClick}
                  isSelected={popupInfo?.id === facility.id}
                />
              ))}

              {popupInfo && (
                <Popup
                  longitude={popupInfo.longitude}
                  latitude={popupInfo.latitude}
                  anchor="bottom"
                  onClose={() => setPopupInfo(null)}
                  closeButton={true}
                  closeOnClick={false}
                  className="facility-popup"
                >
                  <div className="p-2 min-w-[200px]">
                    <h3 className="font-bold text-sm mb-2">{popupInfo.name}</h3>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Status:</span>
                        <span className="font-medium">{popupInfo.status}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Location:</span>
                        <span>{popupInfo.city}, {popupInfo.state}</span>
                      </div>
                      {popupInfo.county && (
                        <div className="flex justify-between">
                          <span className="text-slate-600">County:</span>
                          <span>{popupInfo.county}</span>
                        </div>
                      )}
                      {popupInfo.phase && (
                        <div className="flex justify-between">
                          <span className="text-slate-600">Phase:</span>
                          <span>{popupInfo.phase}</span>
                        </div>
                      )}
                    </div>
                    <Link
                      to={`/facilities/${popupInfo.id}`}
                      className="mt-3 block w-full text-center px-3 py-1.5 bg-teal-500 hover:bg-teal-600 text-white rounded text-xs font-medium transition-colors"
                    >
                      View Details
                    </Link>
                  </div>
                </Popup>
              )}
              </Map>

              <div className="absolute top-4 right-4 bg-slate-900/95 backdrop-blur-sm border border-slate-700 rounded-lg shadow-2xl p-3 z-10">
                <div className="flex items-center gap-2 mb-3">
                  <Layers className="w-4 h-4 text-teal-400" />
                  <h3 className="text-white text-xs font-semibold uppercase tracking-wide">Map Style</h3>
                </div>
                <div className="space-y-1.5 mb-3">
                  {MAP_STYLES.map(style => (
                    <button
                      key={style.id}
                      onClick={() => {
                        console.log('Changing map style to:', style.name);
                        setMapStyle(style.url);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-all ${
                        mapStyle === style.url
                          ? 'bg-teal-500 text-white font-medium shadow-lg ring-2 ring-teal-400/50'
                          : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white hover:ring-1 hover:ring-slate-600'
                      }`}
                    >
                      {style.name}
                    </button>
                  ))}
                </div>
                <div className="text-xs text-slate-400 pt-2 border-t border-slate-700">
                  {facilitiesWithCoordinates.length} pins on map
                </div>
              </div>
            </div>
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
