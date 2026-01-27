import React, { useState, useEffect } from 'react';
import { Building2, CheckCircle2 } from 'lucide-react';
import { facilityReadinessService } from '../../services/facilityReadinessService';

export default function FacilityReadinessTab({ facility, isEditor }) {
  const [readiness, setReadiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    loadReadiness();
  }, [facility?.id]);

  async function loadReadiness() {
    try {
      setLoading(true);
      const data = await facilityReadinessService.getByFacilityId(facility.id);
      setReadiness(data || {});
    } catch (error) {
      console.error('Error loading facility readiness:', error);
      setReadiness({});
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(updates) {
    try {
      await facilityReadinessService.upsert(facility.id, updates);
      setReadiness({ ...readiness, ...updates });
      setEditMode(false);
    } catch (error) {
      console.error('Error saving readiness:', error);
    }
  }

  if (loading) {
    return <div className="text-slate-400">Loading facility readiness information...</div>;
  }

  const readinessScore = facilityReadinessService.getReadinessScore(readiness);

  const CheckboxField = ({ label, value, onChange, disabled }) => (
    <div className="flex items-center gap-3">
      {editMode ? (
        <input
          type="checkbox"
          checked={value || false}
          onChange={onChange}
          className="w-4 h-4"
        />
      ) : (
        <div className="flex items-center gap-2">
          {value ? (
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          ) : (
            <div className="w-5 h-5 rounded-full border-2 border-slate-500" />
          )}
        </div>
      )}
      <span className="text-slate-300">{label}</span>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          Facility Readiness
        </h3>
        {isEditor && (
          <button
            onClick={() => setEditMode(!editMode)}
            className="px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded text-sm transition-colors"
          >
            {editMode ? 'Done' : 'Edit'}
          </button>
        )}
      </div>

      {/* Readiness Score */}
      <div className="bg-teal-900/30 border border-teal-700 rounded-lg p-6">
        <div className="text-center">
          <p className="text-slate-400 text-sm mb-2">Facility Readiness Score</p>
          <p className="text-4xl font-bold text-teal-400">{readinessScore}%</p>
          <div className="w-full bg-slate-700 rounded-full h-2 mt-4">
            <div
              className="bg-teal-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${readinessScore}%` }}
            />
          </div>
        </div>
      </div>

      {/* Space & Infrastructure */}
      <div className="bg-slate-800 rounded-lg p-6 space-y-4">
        <h4 className="text-white font-semibold">Space & Infrastructure</h4>
        <div className="space-y-3">
          <CheckboxField
            label="Dedicated Space Identified"
            value={readiness?.dedicated_space_identified}
            onChange={(e) => setReadiness({ ...readiness, dedicated_space_identified: e.target.checked })}
            disabled={!editMode}
          />
          <CheckboxField
            label="Electrical Outlets Available"
            value={readiness?.electrical_outlets_available}
            onChange={(e) => setReadiness({ ...readiness, electrical_outlets_available: e.target.checked })}
            disabled={!editMode}
          />
          <CheckboxField
            label="Dedicated Circuit Required"
            value={readiness?.dedicated_circuit_required}
            onChange={(e) => setReadiness({ ...readiness, dedicated_circuit_required: e.target.checked })}
            disabled={!editMode}
          />
          {readiness?.dedicated_circuit_required && (
            <div className="ml-8">
              <CheckboxField
                label="Dedicated Circuit Installed"
                value={readiness?.dedicated_circuit_installed}
                onChange={(e) => setReadiness({ ...readiness, dedicated_circuit_installed: e.target.checked })}
                disabled={!editMode}
              />
            </div>
          )}
        </div>
        {editMode && (
          <button
            onClick={() => handleSave({ dedicated_space_identified: readiness.dedicated_space_identified, electrical_outlets_available: readiness.electrical_outlets_available, dedicated_circuit_required: readiness.dedicated_circuit_required, dedicated_circuit_installed: readiness.dedicated_circuit_installed })}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white py-2 rounded font-medium mt-4 transition-colors"
          >
            Save Infrastructure
          </button>
        )}
      </div>

      {/* Network Infrastructure */}
      <div className="bg-slate-800 rounded-lg p-6 space-y-4">
        <h4 className="text-white font-semibold">Network Infrastructure</h4>
        <div className="space-y-3">
          <CheckboxField
            label="Network Available"
            value={readiness?.network_available}
            onChange={(e) => setReadiness({ ...readiness, network_available: e.target.checked })}
            disabled={!editMode}
          />
          {readiness?.network_available && (
            <div className="ml-8">
              <label className="text-slate-400 text-sm mb-2 block">Network Type</label>
              <select
                value={readiness?.network_type || ''}
                onChange={(e) => setReadiness({ ...readiness, network_type: e.target.value })}
                disabled={!editMode}
                className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 disabled:opacity-50"
              >
                <option value="">Select Type</option>
                <option value="wired">Wired</option>
                <option value="wireless">Wireless</option>
              </select>
            </div>
          )}
        </div>
        {editMode && (
          <button
            onClick={() => handleSave({ network_available: readiness.network_available, network_type: readiness.network_type })}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white py-2 rounded font-medium mt-4 transition-colors"
          >
            Save Network Infrastructure
          </button>
        )}
      </div>

      {/* Supplies Storage */}
      <div className="bg-slate-800 rounded-lg p-6 space-y-4">
        <h4 className="text-white font-semibold">Supplies & Storage</h4>
        <div className="space-y-3">
          <CheckboxField
            label="Refrigerator Available (for Reagent Storage)"
            value={readiness?.refrigerator_available}
            onChange={(e) => setReadiness({ ...readiness, refrigerator_available: e.target.checked })}
            disabled={!editMode}
          />
          <CheckboxField
            label="Supply Storage Identified"
            value={readiness?.supply_storage_identified}
            onChange={(e) => setReadiness({ ...readiness, supply_storage_identified: e.target.checked })}
            disabled={!editMode}
          />
        </div>
        {editMode && (
          <button
            onClick={() => handleSave({ refrigerator_available: readiness.refrigerator_available, supply_storage_identified: readiness.supply_storage_identified })}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white py-2 rounded font-medium mt-4 transition-colors"
          >
            Save Storage
          </button>
        )}
      </div>

      {/* Site Assessment */}
      <div className="bg-slate-800 rounded-lg p-6 space-y-4">
        <h4 className="text-white font-semibold">Site Assessment</h4>
        <div className="space-y-3">
          <div>
            <CheckboxField
              label="Site Assessment Complete"
              value={readiness?.site_assessment_complete}
              onChange={(e) => setReadiness({ ...readiness, site_assessment_complete: e.target.checked })}
              disabled={!editMode}
            />
          </div>
          {readiness?.site_assessment_complete && (
            <>
              <div>
                <label className="text-slate-400 text-sm mb-1 block">Assessment Date</label>
                <input
                  type="date"
                  value={readiness?.site_assessment_date || ''}
                  onChange={(e) => setReadiness({ ...readiness, site_assessment_date: e.target.value })}
                  disabled={!editMode}
                  className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="text-slate-400 text-sm mb-1 block">Assessment Notes</label>
                <textarea
                  value={readiness?.site_assessment_notes || ''}
                  onChange={(e) => setReadiness({ ...readiness, site_assessment_notes: e.target.value })}
                  disabled={!editMode}
                  rows="4"
                  className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 disabled:opacity-50 text-sm"
                />
              </div>
            </>
          )}
        </div>
        {editMode && (
          <button
            onClick={() => handleSave({ site_assessment_complete: readiness.site_assessment_complete, site_assessment_date: readiness.site_assessment_date, site_assessment_notes: readiness.site_assessment_notes })}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white py-2 rounded font-medium mt-4 transition-colors"
          >
            Save Site Assessment
          </button>
        )}
      </div>
    </div>
  );
}
