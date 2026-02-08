import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { facilitiesService } from '../services/facilitiesService';
import { templatesService } from '../services/templatesService';
import { useAuth } from '../contexts/AuthContext';
import { facilityStatsService } from '../services/facilityStatsService';
import { FileText, X, Check, Loader2, Calendar, MapPin, Navigation, Pencil, TrendingUp, ChevronRight, Building2, Folder, ArrowRightLeft, Search, Flag } from 'lucide-react';
import { projectsService } from '../services/projectsService';
import TabContainer from './facility-tabs/TabContainer';
import RegulatoryTab from './facility-tabs/RegulatoryTab';
import PersonnelTrainingTab from './facility-tabs/PersonnelTrainingTab';
import EquipmentIntegrationTab from './facility-tabs/EquipmentIntegrationTab';
import FacilityReadinessTab from './facility-tabs/FacilityReadinessTab';
import MilestonesTab from './facility-tabs/MilestonesTab';
import DocumentsTab from './facility-tabs/DocumentsTab';
import ActivityLogTab from './facility-tabs/ActivityLogTab';
import LabOrdersTab from './facility-tabs/LabOrdersTab';
import FacilityMapEmbed from './maps/FacilityMapEmbed';

export default function FacilityDetail() {
  const { id } = useParams();
  const { isEditor } = useAuth();
  const [facility, setFacility] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [applyingTemplate, setApplyingTemplate] = useState(false);
  const [editingDates, setEditingDates] = useState(false);
  const [editingLocation, setEditingLocation] = useState(false);
  const [dateForm, setDateForm] = useState({});
  const [locationForm, setLocationForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);

  useEffect(() => {
    loadFacility();
  }, [id]);

  async function loadFacility() {
    try {
      setLoading(true);
      setError(null);
      console.log('Loading facility with ID:', id);
      const data = await facilitiesService.getById(id);
      console.log('Facility loaded:', data);
      setFacility(data);
    } catch (err) {
      console.error('Error loading facility:', err);
      setError(err.message || 'Failed to load facility');
    } finally {
      setLoading(false);
    }
  }

  async function openTemplateModal() {
    setShowTemplateModal(true);
    try {
      const data = await templatesService.getDeploymentTemplates();
      setTemplates(data);
    } catch (err) {
      console.error('Error loading templates:', err);
    }
  }

  async function applyTemplate() {
    if (!selectedTemplateId) return;

    setApplyingTemplate(true);
    try {
      await templatesService.applyTemplateToFacility(id, selectedTemplateId);
      setShowTemplateModal(false);
      setSelectedTemplateId('');
      loadFacility();
    } catch (err) {
      console.error('Error applying template:', err);
      alert('Failed to apply template: ' + err.message);
    } finally {
      setApplyingTemplate(false);
    }
  }

  function startEditingDates() {
    setDateForm({
      projected_deployment_date: facility.projected_deployment_date || '',
      actual_deployment_date: facility.actual_deployment_date || '',
      projected_go_live_date: facility.projected_go_live_date || '',
      actual_go_live_date: facility.actual_go_live_date || '',
    });
    setEditingDates(true);
  }

  function startEditingLocation() {
    setLocationForm({
      address: facility.address || '',
      city: facility.city || '',
      state: facility.state || '',
      county: facility.county || '',
      latitude: facility.latitude || '',
      longitude: facility.longitude || '',
    });
    setEditingLocation(true);
  }

  async function saveDates() {
    setSaving(true);
    try {
      await facilitiesService.update(id, dateForm);
      await loadFacility();
      setEditingDates(false);
    } catch (err) {
      console.error('Error saving dates:', err);
      alert('Failed to save dates: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveLocation() {
    setSaving(true);
    try {
      await facilitiesService.update(id, locationForm);
      await loadFacility();
      setEditingLocation(false);
    } catch (err) {
      console.error('Error saving location:', err);
      alert('Failed to save location: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  function cancelEditingDates() {
    setEditingDates(false);
    setDateForm({});
  }

  function cancelEditingLocation() {
    setEditingLocation(false);
    setLocationForm({});
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading facility details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6 max-w-md mx-auto">
          <p className="text-red-400 font-medium mb-2">Error Loading Facility</p>
          <p className="text-slate-400 text-sm mb-4">{error}</p>
          <Link to="/facilities" className="text-teal-400 hover:text-teal-300 inline-block">
            ← Back to Facilities
          </Link>
        </div>
      </div>
    );
  }

  if (!facility) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">Facility not found</p>
        <Link to="/facilities" className="text-teal-400 hover:text-teal-300 mt-4 inline-block">
          ← Back to Facilities
        </Link>
      </div>
    );
  }

  const overallStatus = facilityStatsService.calculateOverallStatus(facility);
  const statusColor = facilityStatsService.getStatusBadgeColor(overallStatus);
  const statusTextColor = facilityStatsService.getStatusTextColor(overallStatus);
  const completionPercentage = facilityStatsService.calculateCompletionPercentage(facility.milestones);

  const tabs = [
    { label: 'Regulatory', component: <RegulatoryTab facility={facility} isEditor={isEditor} /> },
    { label: 'Personnel & Training', component: <PersonnelTrainingTab facility={facility} isEditor={isEditor} /> },
    { label: 'Equipment & Integration', component: <EquipmentIntegrationTab facility={facility} isEditor={isEditor} onUpdate={loadFacility} /> },
    { label: 'Facility Readiness', component: <FacilityReadinessTab facility={facility} isEditor={isEditor} /> },
    { label: 'Milestones', component: <MilestonesTab facility={facility} isEditor={isEditor} onUpdate={loadFacility} /> },
    { label: 'Lab Orders', component: <LabOrdersTab facility={facility} /> },
    { label: 'Documents', component: <DocumentsTab facility={facility} isEditor={isEditor} /> },
    { label: 'Activity Log', component: <ActivityLogTab facility={facility} /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm">
        {facility.organization && (
          <>
            <Link to={`/organizations/${facility.organization.id}`} className="flex items-center gap-1.5 text-slate-400 hover:text-teal-400 transition-colors">
              <Building2 className="w-3.5 h-3.5" />
              {facility.organization.name}
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
          </>
        )}
        {facility.project && (
          <>
            <Link to={`/projects/${facility.project.id}`} className="flex items-center gap-1.5 text-slate-400 hover:text-teal-400 transition-colors">
              <Folder className="w-3.5 h-3.5" />
              {facility.project.name}
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
          </>
        )}
        <span className="text-slate-300">{facility.name}</span>
      </div>

      <div className="flex items-start gap-6">
        <Link to="/facilities" className="text-slate-400 hover:text-white mt-1">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold text-white mb-1">{facility.name}</h1>
          <p className="text-slate-400">{facility.address}, {facility.city}, {facility.state}</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="bg-slate-800 rounded-lg px-4 py-3 border-2 border-teal-500/30 shadow-lg shadow-teal-500/10">
            <p className="text-slate-400 text-xs font-medium mb-1">Configuration</p>
            <p className="text-white font-semibold text-sm whitespace-nowrap">
              {facility.deployment_template?.template_name || 'No template applied'}
            </p>
          </div>
          <div className="bg-slate-800 rounded-lg px-4 py-3 border-2 border-teal-500/30 shadow-lg shadow-teal-500/10">
            <p className="text-slate-400 text-xs font-medium mb-1">Overall Status</p>
            <span className={`inline-block px-3 py-1 rounded text-sm font-bold ${statusColor} ${statusTextColor}`}>
              {overallStatus.charAt(0).toUpperCase() + overallStatus.slice(1).replace('_', ' ')}
            </span>
          </div>
        </div>
        {isEditor && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setShowReassignModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              <ArrowRightLeft className="w-4 h-4" />
              Reassign Project
            </button>
            <button
              onClick={openTemplateModal}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              <FileText className="w-4 h-4" />
              Apply Template
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-3 bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-teal-400" />
                Key Dates
              </h2>
              {isEditor && !editingDates && (
                <button
                  onClick={startEditingDates}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}
            </div>
            {editingDates ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-slate-400 text-xs mb-1">Projected Deployment</label>
                  <input
                    type="date"
                    value={dateForm.projected_deployment_date}
                    onChange={(e) => setDateForm({ ...dateForm, projected_deployment_date: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1">Actual Deployment</label>
                  <input
                    type="date"
                    value={dateForm.actual_deployment_date}
                    onChange={(e) => setDateForm({ ...dateForm, actual_deployment_date: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1">Projected Go-Live</label>
                  <input
                    type="date"
                    value={dateForm.projected_go_live_date}
                    onChange={(e) => setDateForm({ ...dateForm, projected_go_live_date: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1">Actual Go-Live</label>
                  <input
                    type="date"
                    value={dateForm.actual_go_live_date}
                    onChange={(e) => setDateForm({ ...dateForm, actual_go_live_date: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    onClick={cancelEditingDates}
                    className="px-4 py-2 text-slate-300 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg transition-colors text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveDates}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-slate-900 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Save
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-slate-400 text-xs mb-1">Projected Deployment</p>
                  <p className="text-white text-sm">
                    {facility.projected_deployment_date
                      ? new Date(facility.projected_deployment_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                      : 'Not set'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs mb-1">Actual Deployment</p>
                  <p className="text-white text-sm">
                    {facility.actual_deployment_date
                      ? new Date(facility.actual_deployment_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                      : 'Not set'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs mb-1">Projected Go-Live</p>
                  <p className="text-white text-sm">
                    {facility.projected_go_live_date
                      ? new Date(facility.projected_go_live_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                      : 'Not set'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400 text-xs mb-1">Actual Go-Live</p>
                  <p className="text-white text-sm">
                    {facility.actual_go_live_date
                      ? new Date(facility.actual_go_live_date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                      : 'Not set'}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-5 bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-teal-400" />
                Progress Overview
              </h2>
              <span className="text-teal-400 font-semibold text-lg">{completionPercentage}%</span>
            </div>
            <div className="space-y-3">
              {facilityStatsService.getUniqueCategoriesWithProgress(facility.milestones).length > 0 ? (
                facilityStatsService.getUniqueCategoriesWithProgress(facility.milestones).map(cat => (
                  <div key={cat.category}>
                    <div className="flex justify-between mb-1">
                      <span className="text-slate-300 text-sm">{cat.label}</span>
                      <span className="text-slate-400 text-xs">
                        {cat.progress}% ({cat.completed}/{cat.total})
                      </span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div
                        className="bg-teal-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${cat.progress}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-slate-400 text-sm">
                  No milestones assigned yet
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-4 bg-slate-800 rounded-lg p-6 border border-slate-700 overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Flag className="w-5 h-5 text-teal-400" />
                Milestone Status
              </h2>
            </div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {(() => {
                const milestones = facility.milestones || [];
                if (milestones.length === 0) {
                  return (
                    <div className="text-center py-8 text-slate-400 text-sm">
                      No milestones assigned yet
                    </div>
                  );
                }

                const today = new Date();
                const sortedMilestones = [...milestones]
                  .sort((a, b) => (a.milestone_order || 0) - (b.milestone_order || 0));

                return sortedMilestones.map((milestone, index) => {
                  let statusColor = 'bg-slate-500';

                  if (milestone.status === 'complete') {
                    statusColor = 'bg-green-500';
                  } else if (milestone.status === 'blocked') {
                    statusColor = 'bg-red-500';
                  } else if (milestone.target_date) {
                    const targetDate = new Date(milestone.target_date);
                    const daysUntil = Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24));

                    if (daysUntil < 0) {
                      statusColor = 'bg-red-500';
                    } else if (daysUntil <= 7) {
                      statusColor = 'bg-yellow-500';
                    } else {
                      statusColor = 'bg-slate-500';
                    }
                  }

                  return (
                    <div
                      key={milestone.id}
                      className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-slate-700/50 transition-colors"
                    >
                      <div className={`w-2.5 h-2.5 ${statusColor} rounded-full flex-shrink-0`}></div>
                      <span className="text-slate-200 text-sm flex-1 leading-tight">
                        {index + 1}. {milestone.name}
                      </span>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <MapPin className="w-5 h-5 text-teal-400" />
                Location
              </h2>
              {isEditor && !editingLocation && (
                <button
                  onClick={startEditingLocation}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}
            </div>
            {editingLocation ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-slate-400 text-xs mb-1">Address</label>
                  <input
                    type="text"
                    value={locationForm.address}
                    onChange={(e) => setLocationForm({ ...locationForm, address: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500"
                    placeholder="Street address"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 text-xs mb-1">City</label>
                    <input
                      type="text"
                      value={locationForm.city}
                      onChange={(e) => setLocationForm({ ...locationForm, city: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500"
                      placeholder="City"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-xs mb-1">State</label>
                    <input
                      type="text"
                      value={locationForm.state}
                      onChange={(e) => setLocationForm({ ...locationForm, state: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500"
                      placeholder="State"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1">County</label>
                  <input
                    type="text"
                    value={locationForm.county}
                    onChange={(e) => setLocationForm({ ...locationForm, county: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500"
                    placeholder="County"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 text-xs mb-1">Latitude</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={locationForm.latitude}
                      onChange={(e) => setLocationForm({ ...locationForm, latitude: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500"
                      placeholder="0.000000"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-xs mb-1">Longitude</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={locationForm.longitude}
                      onChange={(e) => setLocationForm({ ...locationForm, longitude: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-500"
                      placeholder="0.000000"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    onClick={cancelEditingLocation}
                    className="px-4 py-2 text-slate-300 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg transition-colors text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveLocation}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-slate-900 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Save
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-white text-sm">{facility.address || 'No address'}</p>
                  <p className="text-slate-300 text-sm">
                    {[facility.city, facility.state].filter(Boolean).join(', ')}
                  </p>
                  {facility.county && (
                    <p className="text-slate-400 text-xs mt-1">{facility.county} County</p>
                  )}
                </div>

                {facility.latitude && facility.longitude ? (
                  <>
                    <div className="pt-3 border-t border-slate-700">
                      <div className="flex items-center gap-2 mb-2">
                        <Navigation className="w-4 h-4 text-teal-400" />
                        <p className="text-slate-400 text-xs">Coordinates</p>
                      </div>
                      <p className="text-white font-mono text-xs">
                        {parseFloat(facility.latitude).toFixed(6)}, {parseFloat(facility.longitude).toFixed(6)}
                      </p>
                      <a
                        href={`https://www.google.com/maps?q=${facility.latitude},${facility.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-teal-400 hover:text-teal-300 text-xs mt-1 inline-block"
                      >
                        Open in Google Maps →
                      </a>
                    </div>
                    <div className="rounded-lg overflow-hidden border border-slate-700">
                      <FacilityMapEmbed
                        facility={facility}
                        height={200}
                        interactive={false}
                      />
                    </div>
                  </>
                ) : (
                  <div className="pt-3 border-t border-slate-700">
                    <p className="text-slate-400 text-sm">No coordinates set</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-slate-800 rounded-lg overflow-hidden border border-slate-700" style={{ minHeight: '600px' }}>
        <TabContainer tabs={tabs} defaultTab={0} />
      </div>

      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
              <h2 className="text-lg font-semibold text-white">Apply Deployment Template</h2>
              <button
                onClick={() => { setShowTemplateModal(false); setSelectedTemplateId(''); }}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              <p className="text-slate-400 text-sm mb-4">
                Select a template to create milestones and equipment records for this facility.
                This will add items based on the template configuration.
              </p>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {templates.length === 0 ? (
                  <p className="text-slate-400 text-sm text-center py-4">
                    No templates available. Create one in Settings.
                  </p>
                ) : (
                  templates.map(template => (
                    <label
                      key={template.id}
                      className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer border transition-colors ${
                        selectedTemplateId === template.id
                          ? 'border-teal-500 bg-teal-500/10'
                          : 'border-slate-700 hover:border-slate-600 hover:bg-slate-700/30'
                      }`}
                    >
                      <input
                        type="radio"
                        name="template"
                        value={template.id}
                        checked={selectedTemplateId === template.id}
                        onChange={() => setSelectedTemplateId(template.id)}
                        className="mt-1 w-4 h-4 border-slate-600 bg-slate-900 text-teal-500 focus:ring-teal-500 focus:ring-offset-0"
                      />
                      <div>
                        <p className="text-white font-medium">{template.template_name}</p>
                        <p className="text-slate-400 text-xs mt-0.5">
                          {template.template_type} | {template.template_milestones?.length || 0} milestones | {template.template_equipment?.length || 0} equipment
                        </p>
                        {template.description && (
                          <p className="text-slate-500 text-xs mt-1">{template.description}</p>
                        )}
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-700">
              <button
                onClick={() => { setShowTemplateModal(false); setSelectedTemplateId(''); }}
                className="px-4 py-2 text-slate-300 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={applyTemplate}
                disabled={!selectedTemplateId || applyingTemplate}
                className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-600 text-slate-900 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {applyingTemplate ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Apply Template
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showReassignModal && (
        <ReassignProjectModal
          facility={facility}
          onClose={() => setShowReassignModal(false)}
          onReassigned={() => {
            setShowReassignModal(false);
            loadFacility();
          }}
        />
      )}
    </div>
  );
}

function ReassignProjectModal({ facility, onClose, onReassigned }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState(facility.project?.id || '');
  const [reassigning, setReassigning] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    try {
      const data = await projectsService.getAll();
      setProjects(data || []);
    } catch (err) {
      console.error('Error loading projects:', err);
      setError('Failed to load projects');
    } finally {
      setLoading(false);
    }
  }

  async function handleReassign() {
    setReassigning(true);
    setError('');
    try {
      const newProjectId = selectedProjectId || null;
      await facilitiesService.update(facility.id, { project_id: newProjectId });
      onReassigned();
    } catch (err) {
      console.error('Error reassigning facility:', err);
      setError(err.message || 'Failed to reassign facility');
    } finally {
      setReassigning(false);
    }
  }

  const filteredProjects = projects.filter(p => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return p.name?.toLowerCase().includes(term) || p.organization?.name?.toLowerCase().includes(term);
  });

  const hasChanged = selectedProjectId !== (facility.project?.id || '');

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div>
            <h2 className="text-lg font-semibold text-white">Reassign Project</h2>
            <p className="text-slate-400 text-sm mt-0.5">{facility.name}</p>
          </div>
          <button
            onClick={onClose}
            disabled={reassigning}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {facility.project && (
            <div className="p-3 bg-slate-700/30 border border-slate-700 rounded-lg">
              <p className="text-xs text-slate-400 mb-1">Current Project</p>
              <div className="flex items-center gap-2">
                <Folder className="w-4 h-4 text-teal-400" />
                <span className="text-white font-medium text-sm">{facility.project.name}</span>
              </div>
            </div>
          )}

          <div className="relative">
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
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              <button
                onClick={() => setSelectedProjectId('')}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selectedProjectId === ''
                    ? 'border-amber-500 bg-amber-500/10'
                    : 'border-slate-700 hover:border-slate-600 hover:bg-slate-700/30'
                }`}
              >
                <p className={`font-medium text-sm ${selectedProjectId === '' ? 'text-amber-400' : 'text-slate-300'}`}>
                  No Project (Unassigned)
                </p>
                <p className="text-xs text-slate-500 mt-0.5">Remove from current project without assigning to another</p>
              </button>

              {filteredProjects.map(project => {
                const isCurrent = project.id === facility.project?.id;
                const isSelected = selectedProjectId === project.id;

                return (
                  <button
                    key={project.id}
                    onClick={() => setSelectedProjectId(project.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      isSelected
                        ? 'border-teal-500 bg-teal-500/10'
                        : 'border-slate-700 hover:border-slate-600 hover:bg-slate-700/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Folder className={`w-4 h-4 ${isSelected ? 'text-teal-400' : 'text-slate-400'}`} />
                        <span className={`font-medium text-sm ${isSelected ? 'text-teal-400' : 'text-white'}`}>
                          {project.name}
                        </span>
                      </div>
                      {isCurrent && (
                        <span className="px-2 py-0.5 bg-slate-600 text-slate-300 rounded text-[10px] font-semibold uppercase">
                          Current
                        </span>
                      )}
                    </div>
                    {project.organization?.name && (
                      <p className="text-xs text-slate-500 mt-1 pl-6">{project.organization.name}</p>
                    )}
                  </button>
                );
              })}

              {filteredProjects.length === 0 && searchTerm && (
                <p className="text-center text-slate-400 text-sm py-4">No projects match your search</p>
              )}
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700">
          <button
            onClick={onClose}
            disabled={reassigning}
            className="px-4 py-2 text-slate-300 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleReassign}
            disabled={!hasChanged || reassigning}
            className="flex items-center gap-2 px-5 py-2 bg-teal-500 hover:bg-teal-600 text-slate-900 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {reassigning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Reassigning...
              </>
            ) : (
              <>
                <ArrowRightLeft className="w-4 h-4" />
                Reassign
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
