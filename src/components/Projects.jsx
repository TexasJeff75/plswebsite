import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { projectsService } from '../services/projectsService';
import { organizationsService } from '../services/organizationsService';
import { useOrganization } from '../contexts/OrganizationContext';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Search, FolderOpen, Calendar, User, TrendingUp, X, ChevronDown } from 'lucide-react';
import FormField from './FormField';
import FormError from './FormError';

export default function Projects() {
  const { selectedOrganization, isInternalUser } = useOrganization();
  const { isEditor } = useAuth();
  const [projects, setProjects] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    organization_id: ''
  });
  const [formData, setFormData] = useState({
    organization_id: '',
    name: '',
    description: '',
    status: 'planning',
    start_date: '',
    target_completion_date: '',
    project_manager: ''
  });

  useEffect(() => {
    if (isInternalUser) {
      loadOrganizations();
    }
  }, [isInternalUser]);

  useEffect(() => {
    loadProjects();
  }, [filters, selectedOrganization]);

  async function loadOrganizations() {
    try {
      const data = await organizationsService.getAll();
      setOrganizations(data.filter(org => org.type === 'customer'));
    } catch (error) {
      console.error('Error loading organizations:', error);
    }
  }

  async function loadProjects() {
    try {
      setLoading(true);
      const appliedFilters = { ...filters };

      if (selectedOrganization && !isInternalUser) {
        appliedFilters.organization_id = selectedOrganization.id;
      } else if (selectedOrganization && !appliedFilters.organization_id) {
        appliedFilters.organization_id = selectedOrganization.id;
      }

      const data = await projectsService.getAll(appliedFilters);
      setProjects(data);
    } catch (error) {
      console.error('Error loading projects:', error);
      setError('Failed to load projects');
    } finally {
      setLoading(false);
    }
  }

  const handleOpenModal = (project = null) => {
    if (project) {
      setEditingProject(project);
      setFormData({
        organization_id: project.organization_id,
        name: project.name,
        description: project.description || '',
        status: project.status,
        start_date: project.start_date || '',
        target_completion_date: project.target_completion_date || '',
        project_manager: project.project_manager || ''
      });
    } else {
      setEditingProject(null);
      setFormData({
        organization_id: selectedOrganization?.id || '',
        name: '',
        description: '',
        status: 'planning',
        start_date: '',
        target_completion_date: '',
        project_manager: ''
      });
    }
    setShowAddModal(true);
    setError('');
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setEditingProject(null);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      if (editingProject) {
        await projectsService.update(editingProject.id, formData);
      } else {
        await projectsService.create(formData);
      }
      handleCloseModal();
      loadProjects();
    } catch (error) {
      console.error('Error saving project:', error);
      setError(error.message || 'Failed to save project');
    }
  };

  const handleDelete = async (projectId) => {
    if (!confirm('Are you sure you want to delete this project? This will not delete the facilities within it.')) {
      return;
    }

    try {
      await projectsService.delete(projectId);
      loadProjects();
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('Failed to delete project: ' + error.message);
    }
  };

  const statusColors = {
    planning: 'bg-slate-600 text-white',
    active: 'bg-blue-600 text-white',
    completed: 'bg-green-600 text-white',
    on_hold: 'bg-yellow-600 text-white',
    cancelled: 'bg-red-600 text-white'
  };

  const statusLabels = {
    planning: 'Planning',
    active: 'Active',
    completed: 'Completed',
    on_hold: 'On Hold',
    cancelled: 'Cancelled'
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"/>
          <p className="text-slate-400">Loading projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Projects</h1>
          <p className="text-slate-400 mt-1">Manage project deployments and track progress</p>
        </div>
        {isEditor && (
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Project
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search projects..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option value="">All Statuses</option>
          <option value="planning">Planning</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="on_hold">On Hold</option>
          <option value="cancelled">Cancelled</option>
        </select>

        {isInternalUser && (
          <select
            value={filters.organization_id}
            onChange={(e) => setFilters({ ...filters, organization_id: e.target.value })}
            className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="">All Organizations</option>
            {organizations.map(org => (
              <option key={org.id} value={org.id}>{org.name}</option>
            ))}
          </select>
        )}

        <div className="relative">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="appearance-none pl-4 pr-10 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
          >
            <option value="name">Sort: Name</option>
            <option value="status">Sort: Status</option>
            <option value="newest">Sort: Newest</option>
            <option value="oldest">Sort: Oldest</option>
            <option value="target_date">Sort: Target Date</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-12 bg-slate-800/50 rounded-xl border border-slate-700">
          <FolderOpen className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No projects found</h3>
          <p className="text-slate-400">
            {filters.search || filters.status || filters.organization_id
              ? 'Try adjusting your filters'
              : 'Get started by creating your first project'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...projects].sort((a, b) => {
            switch (sortBy) {
              case 'name':
                return (a.name || '').localeCompare(b.name || '');
              case 'status':
                return (a.status || '').localeCompare(b.status || '');
              case 'newest':
                return new Date(b.created_at || 0) - new Date(a.created_at || 0);
              case 'oldest':
                return new Date(a.created_at || 0) - new Date(b.created_at || 0);
              case 'target_date':
                return new Date(a.target_completion_date || '9999') - new Date(b.target_completion_date || '9999');
              default:
                return 0;
            }
          }).map(project => (
            <div
              key={project.id}
              className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 hover:border-teal-500/50 transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0">
                  <Link
                    to={`/projects/${project.id}`}
                    className="text-lg font-semibold text-white hover:text-teal-400 transition-colors block truncate"
                  >
                    {project.name}
                  </Link>
                  {project.organization && (
                    <p className="text-sm text-slate-400 mt-1">{project.organization.name}</p>
                  )}
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[project.status]}`}>
                  {statusLabels[project.status]}
                </span>
              </div>

              {project.description && (
                <p className="text-slate-400 text-sm mb-4 line-clamp-2">{project.description}</p>
              )}

              <div className="space-y-2 text-sm">
                {project.project_manager && (
                  <div className="flex items-center gap-2 text-slate-400">
                    <User className="w-4 h-4" />
                    <span>{project.project_manager}</span>
                  </div>
                )}
                {project.start_date && (
                  <div className="flex items-center gap-2 text-slate-400">
                    <Calendar className="w-4 h-4" />
                    <span>Started {new Date(project.start_date).toLocaleDateString()}</span>
                  </div>
                )}
                {project.target_completion_date && (
                  <div className="flex items-center gap-2 text-slate-400">
                    <TrendingUp className="w-4 h-4" />
                    <span>Target {new Date(project.target_completion_date).toLocaleDateString()}</span>
                  </div>
                )}
              </div>

              {isEditor && (
                <div className="flex gap-2 mt-4 pt-4 border-t border-slate-700">
                  <button
                    onClick={() => handleOpenModal(project)}
                    className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(project.id)}
                    className="px-3 py-2 bg-red-600/10 hover:bg-red-600/20 text-red-400 rounded-lg text-sm transition-colors"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">
                {editingProject ? 'Edit Project' : 'Add New Project'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && <FormError message={error} />}

              <FormField label="Organization" required>
                <select
                  value={formData.organization_id}
                  onChange={(e) => setFormData({ ...formData, organization_id: e.target.value })}
                  required
                  disabled={!isInternalUser && selectedOrganization}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50"
                >
                  <option value="">Select Organization</option>
                  {organizations.map(org => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
              </FormField>

              <FormField label="Project Name" required>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="Enter project name"
                />
              </FormField>

              <FormField label="Description">
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="Project description"
                />
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Status" required>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    required
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="planning">Planning</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="on_hold">On Hold</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </FormField>

                <FormField label="Project Manager">
                  <input
                    type="text"
                    value={formData.project_manager}
                    onChange={(e) => setFormData({ ...formData, project_manager: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="Name"
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Start Date">
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </FormField>

                <FormField label="Target Completion Date">
                  <input
                    type="date"
                    value={formData.target_completion_date}
                    onChange={(e) => setFormData({ ...formData, target_completion_date: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </FormField>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors"
                >
                  {editingProject ? 'Update Project' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
