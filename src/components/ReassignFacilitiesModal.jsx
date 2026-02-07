import React, { useEffect, useState } from 'react';
import { projectsService } from '../services/projectsService';
import { supabase } from '../lib/supabase';
import {
  X, Search, Folder, AlertCircle, Check, Loader2, ArrowRightLeft
} from 'lucide-react';

export default function ReassignFacilitiesModal({
  facilityIds,
  facilities,
  currentProjectId,
  currentProjectName,
  onClose,
  onReassigned
}) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [reassigning, setReassigning] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState(null);

  const selectedFacilities = facilities.filter(f => facilityIds.includes(f.id));

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    try {
      const data = await projectsService.getAll();
      setProjects((data || []).filter(p => p.id !== currentProjectId));
    } catch (err) {
      console.error('Error loading projects:', err);
      setError('Failed to load projects');
    } finally {
      setLoading(false);
    }
  }

  async function handleReassign() {
    if (!selectedProjectId) return;
    setReassigning(true);
    setError('');
    setProgress({ done: 0, total: facilityIds.length });

    const succeeded = [];
    const failed = [];

    for (const facilityId of facilityIds) {
      try {
        const newProjectId = selectedProjectId === '__none__' ? null : selectedProjectId;
        await supabase
          .from('facilities')
          .update({ project_id: newProjectId })
          .eq('id', facilityId);
        succeeded.push(facilityId);
      } catch (err) {
        failed.push({ id: facilityId, error: err.message });
      }
      setProgress(prev => ({ ...prev, done: prev.done + 1 }));
    }

    setReassigning(false);
    setResults({ succeeded, failed });

    if (failed.length === 0) {
      setTimeout(() => onReassigned(), 1200);
    }
  }

  const filteredProjects = projects.filter(p => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return p.name?.toLowerCase().includes(term) || p.organization?.name?.toLowerCase().includes(term);
  });

  const targetProject = projects.find(p => p.id === selectedProjectId);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div>
            <h2 className="text-lg font-semibold text-white">Reassign Facilities</h2>
            <p className="text-slate-400 text-sm mt-0.5">
              {currentProjectName
                ? `Move ${facilityIds.length} facilit${facilityIds.length === 1 ? 'y' : 'ies'} from ${currentProjectName}`
                : `Reassign ${facilityIds.length} facilit${facilityIds.length === 1 ? 'y' : 'ies'} to a project`}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={reassigning}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {results ? (
            <div className="space-y-4">
              {results.succeeded.length > 0 && (
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <div className="flex items-center gap-2 text-green-400 font-medium mb-2">
                    <Check className="w-4 h-4" />
                    {results.succeeded.length} facilit{results.succeeded.length === 1 ? 'y' : 'ies'} reassigned
                  </div>
                  <p className="text-green-300/70 text-sm">
                    {selectedProjectId === '__none__'
                      ? 'Facilities have been unassigned from any project.'
                      : `Facilities have been moved to ${targetProject?.name || 'the selected project'}.`}
                  </p>
                </div>
              )}
              {results.failed.length > 0 && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <div className="flex items-center gap-2 text-red-400 font-medium mb-2">
                    <AlertCircle className="w-4 h-4" />
                    {results.failed.length} failed
                  </div>
                  <ul className="space-y-1 text-sm text-red-300/70">
                    {results.failed.map(f => {
                      const fac = facilities.find(fac => fac.id === f.id);
                      return <li key={f.id}>{fac?.name || 'Unknown'}: {f.error}</li>;
                    })}
                  </ul>
                </div>
              )}
              {results.failed.length > 0 && (
                <button
                  onClick={onReassigned}
                  className="w-full py-2.5 bg-teal-500 text-slate-900 rounded-lg hover:bg-teal-400 transition-colors font-medium"
                >
                  Done
                </button>
              )}
            </div>
          ) : (
            <>
              <div>
                <p className="text-xs text-slate-400 mb-2">Facilities to reassign:</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedFacilities.map(f => (
                    <span key={f.id} className="px-2 py-1 bg-slate-700 text-slate-300 rounded text-xs">
                      {f.name}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Select destination project
                </label>
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search projects..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 text-teal-400 animate-spin" />
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-52 overflow-y-auto">
                    {!currentProjectId && (
                      <button
                        onClick={() => setSelectedProjectId('__none__')}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          selectedProjectId === '__none__'
                            ? 'border-amber-500 bg-amber-500/10'
                            : 'border-slate-700 hover:border-slate-600 hover:bg-slate-700/30'
                        }`}
                      >
                        <p className={`font-medium text-sm ${selectedProjectId === '__none__' ? 'text-amber-400' : 'text-slate-300'}`}>
                          No Project (Unassigned)
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">Remove from current project without assigning to another</p>
                      </button>
                    )}

                    {currentProjectId && (
                      <button
                        onClick={() => setSelectedProjectId('__none__')}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          selectedProjectId === '__none__'
                            ? 'border-amber-500 bg-amber-500/10'
                            : 'border-slate-700 hover:border-slate-600 hover:bg-slate-700/30'
                        }`}
                      >
                        <p className={`font-medium text-sm ${selectedProjectId === '__none__' ? 'text-amber-400' : 'text-slate-300'}`}>
                          No Project (Unassigned)
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">Remove from current project without assigning to another</p>
                      </button>
                    )}

                    {filteredProjects.map(p => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedProjectId(p.id)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          selectedProjectId === p.id
                            ? 'border-teal-500 bg-teal-500/10'
                            : 'border-slate-700 hover:border-slate-600 hover:bg-slate-700/30'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Folder className={`w-4 h-4 ${selectedProjectId === p.id ? 'text-teal-400' : 'text-slate-400'}`} />
                          <span className={`font-medium text-sm ${selectedProjectId === p.id ? 'text-teal-400' : 'text-white'}`}>
                            {p.name}
                          </span>
                        </div>
                        {p.organization?.name && (
                          <p className="text-xs text-slate-500 mt-1 pl-6">{p.organization.name}</p>
                        )}
                      </button>
                    ))}

                    {filteredProjects.length === 0 && searchTerm && (
                      <p className="text-center text-slate-400 text-sm py-4">No projects match your search</p>
                    )}
                  </div>
                )}
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        {!results && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700 bg-slate-800/50">
            <button
              onClick={onClose}
              disabled={reassigning}
              className="px-4 py-2 text-slate-300 hover:text-white transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleReassign}
              disabled={!selectedProjectId || reassigning}
              className="flex items-center gap-2 px-5 py-2 bg-teal-500 text-slate-900 rounded-lg hover:bg-teal-400 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {reassigning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Reassigning ({progress.done}/{progress.total})...
                </>
              ) : (
                <>
                  <ArrowRightLeft className="w-4 h-4" />
                  Reassign {facilityIds.length} Facilit{facilityIds.length === 1 ? 'y' : 'ies'}
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
