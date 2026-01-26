import { useFacilities } from '../hooks/useFacilities';
import { Calendar, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, parseISO, isBefore, isAfter, isValid } from 'date-fns';

export default function TimelinePage() {
  const { data: facilities, isLoading } = useFacilities();

  const facilitiesWithDates = facilities?.filter(f => f.projected_go_live) || [];

  const sortedFacilities = [...facilitiesWithDates].sort((a, b) => {
    const dateA = a.projected_go_live ? new Date(a.projected_go_live).getTime() : 0;
    const dateB = b.projected_go_live ? new Date(b.projected_go_live).getTime() : 0;
    return dateA - dateB;
  });

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

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case 'Live':
        return 'text-green-400';
      case 'In Progress':
        return 'text-blue-400';
      case 'Not Started':
        return 'text-slate-400';
      case 'Blocked':
        return 'text-red-400';
      default:
        return 'text-slate-400';
    }
  };

  const groupByQuarter = () => {
    const grouped: Record<string, typeof sortedFacilities> = {};

    sortedFacilities.forEach(facility => {
      if (!facility.projected_go_live) return;

      const date = new Date(facility.projected_go_live);
      const year = date.getFullYear();
      const month = date.getMonth();
      const quarter = Math.floor(month / 3) + 1;
      const key = `Q${quarter} ${year}`;

      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(facility);
    });

    return grouped;
  };

  const quarterGroups = groupByQuarter();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-teal-400">Loading timeline data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Timeline View</h1>
        <p className="text-slate-400">Projected go-live dates for all facilities</p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-6 text-sm text-slate-400">
          <Calendar className="w-4 h-4" />
          <span>{sortedFacilities.length} facilities with projected go-live dates</span>
        </div>

        {Object.keys(quarterGroups).length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            No facilities have projected go-live dates set
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(quarterGroups).map(([quarter, quarterFacilities]) => (
              <div key={quarter} className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="text-lg font-bold text-teal-400">{quarter}</div>
                  <div className="flex-1 h-px bg-slate-800"></div>
                  <div className="text-sm text-slate-400">
                    {quarterFacilities.length} {quarterFacilities.length === 1 ? 'facility' : 'facilities'}
                  </div>
                </div>

                <div className="space-y-3">
                  {quarterFacilities.map(facility => {
                    const isPast = facility.projected_go_live && isBefore(new Date(facility.projected_go_live), new Date());
                    const isLive = facility.status === 'Live';

                    return (
                      <div key={facility.id} className="bg-slate-800 rounded-lg p-4 hover:bg-slate-700 transition-colors">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <Link
                              to={`/facilities/${facility.id}`}
                              className="text-white font-medium hover:text-teal-400 transition-colors"
                            >
                              {facility.name}
                            </Link>
                            <div className="flex items-center gap-4 mt-2 text-sm text-slate-400">
                              <span>{facility.city}, {facility.state}</span>
                              <span className="px-2 py-0.5 bg-slate-700 rounded text-xs">{facility.region}</span>
                              <span className="px-2 py-0.5 bg-slate-700 rounded text-xs">{facility.phase}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="text-sm text-slate-400 mb-1">Projected Go-Live</div>
                              <div className={`text-sm font-medium ${getStatusTextColor(facility.status)}`}>
                                {facility.projected_go_live && format(new Date(facility.projected_go_live), 'MMM d, yyyy')}
                              </div>
                              {isPast && !isLive && (
                                <div className="text-xs text-red-400 mt-1">Overdue</div>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${getStatusColor(facility.status)}`}></div>
                              <span className={`text-sm font-medium ${getStatusTextColor(facility.status)}`}>
                                {facility.status}
                              </span>
                            </div>
                          </div>
                        </div>

                        {facility.actual_go_live && (
                          <div className="mt-3 pt-3 border-t border-slate-700 flex items-center gap-2 text-sm">
                            <ArrowRight className="w-4 h-4 text-green-400" />
                            <span className="text-slate-400">Actually went live:</span>
                            <span className="text-green-400 font-medium">
                              {format(new Date(facility.actual_go_live), 'MMM d, yyyy')}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="text-sm text-slate-400 mb-1">Total Scheduled</div>
          <div className="text-2xl font-bold text-white">{sortedFacilities.length}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="text-sm text-slate-400 mb-1">Live</div>
          <div className="text-2xl font-bold text-green-400">
            {sortedFacilities.filter(f => f.status === 'Live').length}
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="text-sm text-slate-400 mb-1">In Progress</div>
          <div className="text-2xl font-bold text-blue-400">
            {sortedFacilities.filter(f => f.status === 'In Progress').length}
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
          <div className="text-sm text-slate-400 mb-1">Blocked</div>
          <div className="text-2xl font-bold text-red-400">
            {sortedFacilities.filter(f => f.status === 'Blocked').length}
          </div>
        </div>
      </div>
    </div>
  );
}
