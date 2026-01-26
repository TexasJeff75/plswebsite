import { useFacilities } from '../hooks/useFacilities';
import { Map, Building2, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function MapViewPage() {
  const { data: facilities, isLoading } = useFacilities();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Live':
        return 'bg-green-500';
      case 'In Progress':
        return 'bg-blue-500';
      case 'Not Started':
        return 'bg-slate-500';
      case 'Blocked':
        return 'bg-red-500';
      default:
        return 'bg-slate-500';
    }
  };

  const statusCounts = {
    live: facilities?.filter(f => f.status === 'Live').length || 0,
    inProgress: facilities?.filter(f => f.status === 'In Progress').length || 0,
    notStarted: facilities?.filter(f => f.status === 'Not Started').length || 0,
    blocked: facilities?.filter(f => f.status === 'Blocked').length || 0,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-teal-400">Loading map data...</div>
      </div>
    );
  }

  const groupedByRegion = facilities?.reduce((acc, facility) => {
    if (!acc[facility.region]) {
      acc[facility.region] = [];
    }
    acc[facility.region].push(facility);
    return acc;
  }, {} as Record<string, typeof facilities>);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Map View</h1>
        <p className="text-slate-400">Facilities grouped by geographic region</p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center gap-6 mb-6 pb-6 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-sm text-slate-300">Live ({statusCounts.live})</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span className="text-sm text-slate-300">In Progress ({statusCounts.inProgress})</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-slate-500"></div>
            <span className="text-sm text-slate-300">Not Started ({statusCounts.notStarted})</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-sm text-slate-300">Blocked ({statusCounts.blocked})</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Object.entries(groupedByRegion || {}).map(([region, regionFacilities]) => (
            <div key={region} className="bg-slate-800 rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <Map className="w-5 h-5 text-teal-400" />
                <h3 className="text-lg font-bold text-white">{region}</h3>
              </div>

              <div className="text-sm text-slate-400 mb-4">
                {regionFacilities.length} {regionFacilities.length === 1 ? 'facility' : 'facilities'}
              </div>

              <div className="space-y-2">
                {regionFacilities.map(facility => (
                  <Link
                    key={facility.id}
                    to={`/facilities/${facility.id}`}
                    className="block p-3 bg-slate-900 hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white font-medium text-sm">{facility.name}</span>
                      <div className={`w-2 h-2 rounded-full ${getStatusColor(facility.status)}`}></div>
                    </div>
                    <div className="text-xs text-slate-400">{facility.city}, {facility.state}</div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" />
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">Interactive Map Integration</h3>
            <p className="text-slate-400 text-sm mb-3">
              This view shows facilities grouped by region. For a full interactive map with geocoded locations,
              coordinates can be added to facility records and integrated with mapping services like Mapbox or Google Maps.
            </p>
            <p className="text-slate-400 text-sm">
              Current implementation provides a regional overview for quick navigation and status monitoring.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
