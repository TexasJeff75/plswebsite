import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { facilitiesService } from '../services/facilitiesService';
import { templatesService } from '../services/templatesService';
import { useAuth } from '../contexts/AuthContext';
import { facilityStatsService } from '../services/facilityStatsService';
import { FileText, X, Check, Loader2 } from 'lucide-react';
import TabContainer from './facility-tabs/TabContainer';
import OverviewTab from './facility-tabs/OverviewTab';
import RegulatoryTab from './facility-tabs/RegulatoryTab';
import PersonnelTab from './facility-tabs/PersonnelTab';
import EquipmentTab from './facility-tabs/EquipmentTab';
import IntegrationTab from './facility-tabs/IntegrationTab';
import FacilityReadinessTab from './facility-tabs/FacilityReadinessTab';
import TrainingTab from './facility-tabs/TrainingTab';
import MilestonesTab from './facility-tabs/MilestonesTab';
import DocumentsTab from './facility-tabs/DocumentsTab';
import ActivityLogTab from './facility-tabs/ActivityLogTab';

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
  const monthlyCost = facilityStatsService.getMonthlyCost(facility);
  const configLabel = facilityStatsService.getConfigurationLabel(facility.site_configuration);

  const tabs = [
    { label: 'Overview', component: <OverviewTab facility={facility} isEditor={isEditor} /> },
    { label: 'Regulatory', component: <RegulatoryTab facility={facility} isEditor={isEditor} /> },
    { label: 'Personnel', component: <PersonnelTab facility={facility} isEditor={isEditor} /> },
    { label: 'Equipment', component: <EquipmentTab facility={facility} isEditor={isEditor} onUpdate={loadFacility} /> },
    { label: 'Integration', component: <IntegrationTab facility={facility} isEditor={isEditor} /> },
    { label: 'Facility Readiness', component: <FacilityReadinessTab facility={facility} isEditor={isEditor} /> },
    { label: 'Training', component: <TrainingTab facility={facility} isEditor={isEditor} /> },
    { label: 'Milestones', component: <MilestonesTab facility={facility} isEditor={isEditor} /> },
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <p className="text-slate-400 text-xs mb-1">Configuration</p>
          <p className="text-white font-semibold text-sm">{configLabel}</p>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <p className="text-slate-400 text-xs mb-1">Monthly Cost</p>
          <p className="text-white font-semibold text-sm">${monthlyCost}</p>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <p className="text-slate-400 text-xs mb-1">Phase</p>
          <p className="text-white font-semibold text-sm uppercase">{facility.deployment_phase}</p>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <p className="text-slate-400 text-xs mb-1">Overall Status</p>
          <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${statusColor} ${statusTextColor}`}>
            {overallStatus.charAt(0).toUpperCase() + overallStatus.slice(1).replace('_', ' ')}
          </span>
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
