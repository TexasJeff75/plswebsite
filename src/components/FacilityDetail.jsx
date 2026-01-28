import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { facilitiesService } from '../services/facilitiesService';
import { useAuth } from '../contexts/AuthContext';
import { facilityStatsService } from '../services/facilityStatsService';
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
    </div>
  );
}
