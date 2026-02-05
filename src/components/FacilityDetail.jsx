import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { facilitiesService } from '../services/facilitiesService';
import { templatesService } from '../services/templatesService';
import { useAuth } from '../contexts/AuthContext';
import { facilityStatsService } from '../services/facilityStatsService';
import { FileText, X, Check, Loader2, Calendar, MapPin, Navigation, Edit2, TrendingUp } from 'lucide-react';
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
      <div className="flex items-center gap-4">
        <Link to="/facilities" className="text-slate-400 hover:text-white">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-white">{facility.name}</h1>
          <p className="text-slate-400">{facility.address}, {facility.city}, {facility.state}</p>
        </div>
        {isEditor && (
          <button
            onClick={openTemplateModal}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            <FileText className="w-4 h-4" />
            Apply Template
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <p className="text-slate-400 text-xs mb-1">Configuration</p>
          <p className="text-white font-semibold text-sm">
            {facility.deployment_template?.template_name || 'No template applied'}
          </p>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <p className="text-slate-400 text-xs mb-1">Overall Status</p>
          <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${statusColor} ${statusTextColor}`}>
            {overallStatus.charAt(0).toUpperCase() + overallStatus.slice(1).replace('_', ' ')}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
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
                  <Edit2 className="w-4 h-4" />
                </button>
              )}
            </div>
            {editingDates ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
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
              <div className="grid grid-cols-2 gap-4">
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

          <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
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
                  <Edit2 className="w-4 h-4" />
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
    </div>
  );
}
