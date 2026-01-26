import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { facilitiesService } from '../services/facilitiesService';
import { format, differenceInDays } from 'date-fns';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [upcomingGoLives, setUpcomingGoLives] = useState([]);
  const [blockedFacilities, setBlockedFacilities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      const [statsData, upcomingData, blockedData] = await Promise.all([
        facilitiesService.getStats(),
        facilitiesService.getUpcomingGoLives(),
        facilitiesService.getBlockedFacilities()
      ]);

      setStats(statsData);
      setUpcomingGoLives(upcomingData);
      setBlockedFacilities(blockedData);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"/>
          <p className="text-slate-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const statusColors = {
    'Not Started': 'bg-slate-700 text-slate-300',
    'In Progress': 'bg-blue-600 text-white',
    'Live': 'bg-green-600 text-white',
    'Blocked': 'bg-red-600 text-white'
  };

  const completionPercentage = stats?.total ?
    Math.round((stats.byStatus['Live'] || 0) / stats.total * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
        <p className="text-slate-400">Overview of facility deployment progress</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-400 text-sm font-medium">Total Facilities</h3>
            <div className="w-10 h-10 bg-teal-500/10 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h4a1 1 0 011 1v5m-6 0h6"/>
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-white">{stats?.total || 0}</p>
        </div>

        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-400 text-sm font-medium">Live Facilities</h3>
            <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-white">{stats?.byStatus?.['Live'] || 0}</p>
        </div>

        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-400 text-sm font-medium">In Progress</h3>
            <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-white">{stats?.byStatus?.['In Progress'] || 0}</p>
        </div>

        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-400 text-sm font-medium">Blocked</h3>
            <div className="w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
            </div>
          </div>
          <p className="text-3xl font-bold text-white">{stats?.byStatus?.['Blocked'] || 0}</p>
        </div>
      </div>

      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h3 className="text-white font-semibold mb-4">Overall Completion</h3>
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-slate-400">
            <span>Network-wide Progress</span>
            <span className="text-teal-500 font-medium">{completionPercentage}%</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-teal-500 to-teal-400 h-3 rounded-full transition-all duration-500"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-white font-semibold">Upcoming Go-Lives</h3>
            <span className="text-xs text-slate-400">Next 30 days</span>
          </div>

          {upcomingGoLives.length === 0 ? (
            <p className="text-slate-500 text-center py-8">No upcoming go-lives scheduled</p>
          ) : (
            <div className="space-y-4">
              {upcomingGoLives.slice(0, 5).map(facility => {
                const daysUntil = differenceInDays(new Date(facility.projected_go_live), new Date());
                return (
                  <Link
                    key={facility.id}
                    to={`/facilities/${facility.id}`}
                    className="block bg-slate-900/50 rounded-lg p-4 hover:bg-slate-900 transition-colors border border-slate-700"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-white font-medium">{facility.name}</h4>
                      <span className="text-xs px-2 py-1 bg-teal-500/10 text-teal-400 rounded">
                        {daysUntil} days
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-400">
                      <span>{facility.city}, {facility.state}</span>
                      <span>•</span>
                      <span>{format(new Date(facility.projected_go_live), 'MMM d, yyyy')}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-white font-semibold">Blocked Items</h3>
            <span className="text-xs px-2 py-1 bg-red-500/10 text-red-400 rounded">
              {blockedFacilities.length} items
            </span>
          </div>

          {blockedFacilities.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                </svg>
              </div>
              <p className="text-slate-500">No blocked items</p>
            </div>
          ) : (
            <div className="space-y-4">
              {blockedFacilities.slice(0, 5).map(facility => (
                <Link
                  key={facility.id}
                  to={`/facilities/${facility.id}`}
                  className="block bg-slate-900/50 rounded-lg p-4 hover:bg-slate-900 transition-colors border border-red-800/30"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-white font-medium">{facility.name}</h4>
                    <span className="text-xs px-2 py-1 bg-red-500/10 text-red-400 rounded">
                      Blocked
                    </span>
                  </div>
                  <p className="text-sm text-slate-400">
                    {facility.city}, {facility.state}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
