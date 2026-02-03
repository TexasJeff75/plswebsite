import React, { useState, useEffect } from 'react';
import { Search, X, Upload, MapPin, Activity } from 'lucide-react';
import ImportData from './ImportData';
import { supabase } from '../lib/supabase';

const STATUS_CONFIG = {
  'pending': { color: '#fbbf24', label: 'Pending' },
  'in_progress': { color: '#3b82f6', label: 'In Progress' },
  'completed': { color: '#10b981', label: 'Completed' },
  'blocked': { color: '#ef4444', label: 'Blocked' }
};

export default function DeploymentTrackerMap() {
  const [organizations, setOrganizations] = useState([]);
  const [projects, setProjects] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [filteredFacilities, setFilteredFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const loadData = async () => {
    try {
      setLoading(true);

      const { data: orgsData, error: orgsError } = await supabase
        .from('deployment_organizations')
        .select('*')
        .order('name');

      if (orgsError) throw orgsError;

      const { data: projectsData, error: projectsError } = await supabase
        .from('deployment_projects')
        .select('*')
        .order('name');

      if (projectsError) throw projectsError;

      const { data: facilitiesData, error: facilitiesError } = await supabase
        .from('deployment_facilities')
        .select('*')
        .order('name');

      if (facilitiesError) throw facilitiesError;

      setOrganizations(orgsData || []);
      setProjects(projectsData || []);
      setFacilities(facilitiesData || []);
      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    let filtered = facilities;

    if (searchQuery) {
      filtered = filtered.filter(f =>
        f.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.location?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (statusFilter !== 'All') {
      filtered = filtered.filter(f => f.status === statusFilter.toLowerCase().replace(' ', '_'));
    }

    setFilteredFacilities(filtered);
  }, [facilities, searchQuery, statusFilter]);

  const handleFacilitySelect = (facility) => {
    setSelectedFacility(facility);
    setDetailPanelOpen(true);
  };

  const statusCounts = {
    total: facilities.length,
    completed: facilities.filter(f => f.status === 'completed').length,
    inProgress: facilities.filter(f => f.status === 'in_progress').length,
    blocked: facilities.filter(f => f.status === 'blocked').length,
    pending: facilities.filter(f => f.status === 'pending').length
  };

  const facilitiesOnMap = 0;

  return (
    <div className="h-[calc(100vh-3.5rem)] flex flex-col bg-slate-950">



      <div className="flex-none bg-slate-900/95 backdrop-blur-sm border-b border-slate-800 px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img
              src="/deployment_logo_animated.svg"
              alt="Deployment Tracker"
              className="w-10 h-10"
            />
            <div>
              <h1 className="text-lg font-bold text-white">Facility Deployment Tracker</h1>
              <p className="text-slate-400 text-xs">Organization-based deployment management</p>
            </div>
          </div>

          <div className="flex gap-2">
            <div className="text-center bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700/50">
              <div className="font-bold text-white text-lg">{statusCounts.total}</div>
              <div className="text-slate-400 text-[10px] uppercase tracking-wider">Total</div>
            </div>
            <div className="text-center bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/30">
              <div className="font-bold text-emerald-400 text-lg">{statusCounts.completed}</div>
              <div className="text-emerald-300 text-[10px] uppercase tracking-wider">Completed</div>
            </div>
            <div className="text-center bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-500/30">
              <div className="font-bold text-blue-400 text-lg">{statusCounts.inProgress}</div>
              <div className="text-blue-300 text-[10px] uppercase tracking-wider">Progress</div>
            </div>
            <div className="text-center bg-red-500/10 px-3 py-1.5 rounded-lg border border-red-500/30">
              <div className="font-bold text-red-400 text-lg">{statusCounts.blocked}</div>
              <div className="text-red-300 text-[10px] uppercase tracking-wider">Blocked</div>
            </div>
            <div className="text-center bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/30">
              <div className="font-bold text-amber-400 text-lg">{statusCounts.pending}</div>
              <div className="text-amber-300 text-[10px] uppercase tracking-wider">Pending</div>
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
              {['All', 'Completed', 'In Progress', 'Pending', 'Blocked'].map(status => {
                const statusKey = status === 'All' ? null : status.toLowerCase().replace(' ', '_');
                const count = status === 'All' ? facilities.length :
                  status === 'Completed' ? statusCounts.completed :
                  status === 'In Progress' ? statusCounts.inProgress :
                  status === 'Pending' ? statusCounts.pending : statusCounts.blocked;
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
              <div className="space-y-1">
                {organizations.map(org => {
                  const orgProjects = projects.filter(p => p.organization_id === org.id);
                  if (orgProjects.length === 0) return null;

                  return (
                    <div key={org.id} className="border-b border-slate-800/50 last:border-0">
                      <div className="bg-slate-800/50 px-4 py-2.5 border-l-2 border-teal-500/50">
                        <h3 className="font-semibold text-white text-sm flex items-center gap-2">
                          {org.name}
                          {org.abbreviation && (
                            <span className="text-xs text-slate-400 font-normal">({org.abbreviation})</span>
                          )}
                        </h3>
                      </div>

                      {orgProjects.map(project => {
                        const projectFacilities = filteredFacilities.filter(f => f.project_id === project.id);
                        if (projectFacilities.length === 0) return null;

                        return (
                          <div key={project.id} className="ml-4 border-l border-slate-700/50">
                            <div className="bg-slate-800/30 px-4 py-2">
                              <h4 className="font-medium text-slate-300 text-xs flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-blue-400" />
                                {project.name}
                                <span className="text-slate-500">({projectFacilities.length})</span>
                              </h4>
                            </div>

                            <div className="divide-y divide-slate-800/30">
                              {projectFacilities.map(facility => {
                                const statusConfig = STATUS_CONFIG[facility.status] || STATUS_CONFIG.pending;

                                return (
                                  <button
                                    key={facility.id}
                                    onClick={() => handleFacilitySelect(facility)}
                                    className={`w-full text-left pl-8 pr-4 py-3 transition-all border-l-2 ${
                                      selectedFacility?.id === facility.id
                                        ? 'bg-teal-500/10 border-teal-500'
                                        : 'hover:bg-slate-800/20 border-transparent'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <div
                                        className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${facility.status === 'blocked' ? 'animate-pulse' : ''}`}
                                        style={{ backgroundColor: statusConfig.color }}
                                      />
                                      <h5 className="font-medium text-white text-sm">{facility.name}</h5>
                                      <span className="text-xs px-1.5 py-0.5 rounded" style={{
                                        backgroundColor: `${statusConfig.color}20`,
                                        color: statusConfig.color
                                      }}>
                                        {statusConfig.label}
                                      </span>
                                    </div>
                                    {facility.location && (
                                      <p className="text-xs text-slate-400 mt-1 ml-5">
                                        {facility.location}
                                      </p>
                                    )}
                                    {facility.notes && (
                                      <p className="text-xs text-slate-500 mt-1 ml-5 truncate">
                                        {facility.notes}
                                      </p>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 relative bg-slate-950 flex items-center justify-center">
          <div className="text-center max-w-md px-6">
            <div className="w-20 h-20 bg-slate-800/50 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-slate-700/50">
              <Activity className="w-10 h-10 text-teal-400" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-3">Deployment Overview</h3>
            <p className="text-slate-400 mb-6">
              View and manage deployment facilities across multiple organizations and projects.
            </p>

            <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6 space-y-4">
              <h4 className="font-semibold text-white text-sm uppercase tracking-wider mb-3 flex items-center gap-2 justify-center">
                <Activity className="w-3.5 h-3.5 text-teal-400" />
                Status Legend
              </h4>
              <div className="space-y-2">
                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                  <div key={key} className="flex items-center gap-2.5 justify-center">
                    <div
                      className={`w-3.5 h-3.5 rounded-full ${key === 'blocked' ? 'animate-pulse' : ''}`}
                      style={{ backgroundColor: config.color }}
                    />
                    <span className="text-slate-300 text-sm">{config.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {selectedFacility && (
              <div className="mt-6 bg-teal-500/10 border border-teal-500/30 rounded-xl p-4">
                <p className="text-teal-400 text-sm">
                  Selected: <span className="font-semibold">{selectedFacility.name}</span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {detailPanelOpen && selectedFacility && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-slate-900 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Facility Details</h2>
              <button
                onClick={() => {
                  setDetailPanelOpen(false);
                  setSelectedFacility(null);
                }}
                className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Name</label>
                <p className="text-white text-lg font-semibold">{selectedFacility.name}</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Status</label>
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: STATUS_CONFIG[selectedFacility.status]?.color }}
                  />
                  <span className="text-white">{STATUS_CONFIG[selectedFacility.status]?.label}</span>
                </div>
              </div>

              {selectedFacility.location && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Location</label>
                  <p className="text-white">{selectedFacility.location}</p>
                </div>
              )}

              {selectedFacility.deployed_by && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Deployed By</label>
                  <p className="text-white">{selectedFacility.deployed_by}</p>
                </div>
              )}

              {selectedFacility.deployment_date && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Deployment Date</label>
                  <p className="text-white">{new Date(selectedFacility.deployment_date).toLocaleDateString()}</p>
                </div>
              )}

              {selectedFacility.notes && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Notes</label>
                  <p className="text-slate-300 whitespace-pre-wrap">{selectedFacility.notes}</p>
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-slate-700">
                <span className="text-xs text-slate-500">
                  Created {new Date(selectedFacility.created_at).toLocaleDateString()}
                </span>
                <span className="text-xs text-slate-500">
                  Updated {new Date(selectedFacility.updated_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {importOpen && (
        <ImportData
          onImportComplete={loadData}
          onClose={() => setImportOpen(false)}
        />
      )}
    </div>
  );
}
