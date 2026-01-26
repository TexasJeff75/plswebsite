import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useFacilities } from '../hooks/useFacilities';
import { Search, Filter, Eye } from 'lucide-react';
import { Facility } from '../types';

export default function FacilitiesPage() {
  const { data: facilities, isLoading } = useFacilities();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [phaseFilter, setPhaseFilter] = useState<string>('all');

  const filteredFacilities = useMemo(() => {
    if (!facilities) return [];

    return facilities.filter(facility => {
      const matchesSearch =
        facility.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        facility.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
        facility.state.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' || facility.status === statusFilter;
      const matchesRegion = regionFilter === 'all' || facility.region === regionFilter;
      const matchesPhase = phaseFilter === 'all' || facility.phase === phaseFilter;

      return matchesSearch && matchesStatus && matchesRegion && matchesPhase;
    });
  }, [facilities, searchTerm, statusFilter, regionFilter, phaseFilter]);

  const regions = useMemo(() => {
    if (!facilities) return [];
    return Array.from(new Set(facilities.map(f => f.region))).sort();
  }, [facilities]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Live':
        return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'In Progress':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'Not Started':
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
      case 'Blocked':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-teal-400">Loading facilities...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Facilities</h1>
          <p className="text-slate-400">Manage and track all facility deployments</p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, city, or state..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
            />
          </div>

          <div className="flex gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-400"
            >
              <option value="all">All Status</option>
              <option value="Not Started">Not Started</option>
              <option value="In Progress">In Progress</option>
              <option value="Live">Live</option>
              <option value="Blocked">Blocked</option>
            </select>

            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-400"
            >
              <option value="all">All Regions</option>
              {regions.map(region => (
                <option key={region} value={region}>{region}</option>
              ))}
            </select>

            <select
              value={phaseFilter}
              onChange={(e) => setPhaseFilter(e.target.value)}
              className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-400"
            >
              <option value="all">All Phases</option>
              <option value="Phase 1">Phase 1</option>
              <option value="Phase 2">Phase 2</option>
              <option value="Phase 3">Phase 3</option>
            </select>
          </div>
        </div>

        <div className="text-sm text-slate-400 mb-4">
          Showing {filteredFacilities.length} of {facilities?.length || 0} facilities
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Name</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">City</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">State</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Region</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Phase</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">Status</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredFacilities.map((facility) => (
                <tr key={facility.id} className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
                  <td className="py-3 px-4 text-white font-medium">{facility.name}</td>
                  <td className="py-3 px-4 text-slate-300">{facility.city}</td>
                  <td className="py-3 px-4 text-slate-300">{facility.state}</td>
                  <td className="py-3 px-4 text-slate-300">{facility.region}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-1 bg-slate-700 text-slate-300 text-xs font-medium rounded">
                      {facility.phase}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 border text-xs font-medium rounded ${getStatusColor(facility.status)}`}>
                      {facility.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Link
                      to={`/facilities/${facility.id}`}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-teal-400/10 hover:bg-teal-400/20 text-teal-400 text-sm font-medium rounded transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredFacilities.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              No facilities found matching your criteria
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
