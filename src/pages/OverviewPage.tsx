import { useFacilityMetrics, useFacilities } from '../hooks/useFacilities';
import { Building2, TrendingUp, AlertCircle, Calendar } from 'lucide-react';
import { format, isWithinInterval, startOfMonth, endOfMonth } from 'date-fns';

export default function OverviewPage() {
  const { data: metrics, isLoading: metricsLoading } = useFacilityMetrics();
  const { data: facilities, isLoading: facilitiesLoading } = useFacilities();

  if (metricsLoading || facilitiesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-teal-400">Loading dashboard...</div>
      </div>
    );
  }

  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const upcomingGoLives = facilities?.filter(f => {
    if (!f.projected_go_live) return false;
    const goLiveDate = new Date(f.projected_go_live);
    return isWithinInterval(goLiveDate, { start: monthStart, end: monthEnd });
  }) || [];

  const blockedFacilities = facilities?.filter(f => f.status === 'Blocked') || [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Dashboard Overview</h1>
        <p className="text-slate-400">Facility deployment tracking and metrics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-teal-400/10 rounded-lg flex items-center justify-center">
              <Building2 className="w-6 h-6 text-teal-400" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white mb-1">{metrics?.totalFacilities || 0}</div>
          <div className="text-sm text-slate-400">Total Facilities</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-green-400/10 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-400" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white mb-1">{metrics?.live || 0}</div>
          <div className="text-sm text-slate-400">Live Facilities</div>
          <div className="mt-2">
            <div className="text-xs text-slate-500 mb-1">Network Completion</div>
            <div className="w-full bg-slate-800 rounded-full h-2">
              <div
                className="bg-teal-400 h-2 rounded-full transition-all duration-500"
                style={{ width: `${metrics?.completionPercentage || 0}%` }}
              />
            </div>
            <div className="text-xs text-teal-400 mt-1">{metrics?.completionPercentage || 0}%</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-400/10 rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6 text-blue-400" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white mb-1">{metrics?.goLiveThisMonth || 0}</div>
          <div className="text-sm text-slate-400">Go-Live This Month</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-red-400/10 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-red-400" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white mb-1">{metrics?.blocked || 0}</div>
          <div className="text-sm text-slate-400">Blocked Facilities</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="text-sm text-slate-400 mb-2">Not Started</div>
          <div className="text-2xl font-bold text-slate-300">{metrics?.notStarted || 0}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="text-sm text-slate-400 mb-2">In Progress</div>
          <div className="text-2xl font-bold text-blue-400">{metrics?.inProgress || 0}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="text-sm text-slate-400 mb-2">Live</div>
          <div className="text-2xl font-bold text-green-400">{metrics?.live || 0}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="text-sm text-slate-400 mb-2">Blocked</div>
          <div className="text-2xl font-bold text-red-400">{metrics?.blocked || 0}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-teal-400" />
            Upcoming Go-Lives This Month
          </h2>
          {upcomingGoLives.length === 0 ? (
            <p className="text-slate-400 text-sm">No facilities going live this month</p>
          ) : (
            <div className="space-y-3">
              {upcomingGoLives.map(facility => (
                <div key={facility.id} className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                  <div>
                    <div className="font-medium text-white">{facility.name}</div>
                    <div className="text-sm text-slate-400">{facility.city}, {facility.state}</div>
                  </div>
                  <div className="text-sm text-teal-400">
                    {facility.projected_go_live && format(new Date(facility.projected_go_live), 'MMM d')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-400" />
            Blocked Items Requiring Attention
          </h2>
          {blockedFacilities.length === 0 ? (
            <p className="text-slate-400 text-sm">No blocked facilities</p>
          ) : (
            <div className="space-y-3">
              {blockedFacilities.map(facility => (
                <div key={facility.id} className="flex items-center justify-between p-3 bg-red-500/5 border border-red-500/20 rounded-lg">
                  <div>
                    <div className="font-medium text-white">{facility.name}</div>
                    <div className="text-sm text-slate-400">{facility.region}</div>
                  </div>
                  <div className="px-2 py-1 bg-red-500/10 text-red-400 text-xs font-medium rounded">
                    BLOCKED
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
