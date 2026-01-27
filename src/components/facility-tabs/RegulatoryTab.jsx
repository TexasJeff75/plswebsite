import React, { useState, useEffect } from 'react';
import { FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import { regulatoryService } from '../../services/regulatoryService';

export default function RegulatoryTab({ facility, isEditor }) {
  const [regulatory, setRegulatory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    loadRegulatory();
  }, [facility?.id]);

  async function loadRegulatory() {
    try {
      setLoading(true);
      const data = await regulatoryService.getByFacilityId(facility.id);
      setRegulatory(data || {});
    } catch (error) {
      console.error('Error loading regulatory info:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(updates) {
    try {
      await regulatoryService.upsert(facility.id, updates);
      setRegulatory({ ...regulatory, ...updates });
      setEditMode(false);
    } catch (error) {
      console.error('Error saving regulatory info:', error);
    }
  }

  if (loading) {
    return <div className="text-slate-400">Loading regulatory information...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-white">Regulatory Information</h3>
        {isEditor && (
          <button
            onClick={() => setEditMode(!editMode)}
            className="px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded text-sm transition-colors"
          >
            {editMode ? 'Cancel' : 'Edit'}
          </button>
        )}
      </div>

      {/* CLIA Section */}
      <div className="bg-slate-800 rounded-lg p-6 space-y-4">
        <h4 className="text-white font-semibold flex items-center gap-2">
          <FileText className="w-5 h-5 text-teal-400" />
          CLIA Certificate
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-slate-400 text-sm mb-1 block">Application Submitted</label>
            {editMode ? (
              <input
                type="checkbox"
                checked={regulatory.clia_application_submitted || false}
                onChange={(e) => setRegulatory({ ...regulatory, clia_application_submitted: e.target.checked })}
                className="w-4 h-4"
              />
            ) : (
              <div className="flex items-center gap-2">
                {regulatory.clia_application_submitted ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-slate-500" />
                )}
                <span className="text-white">{regulatory.clia_application_submitted ? 'Yes' : 'No'}</span>
              </div>
            )}
          </div>
          <div>
            <label className="text-slate-400 text-sm mb-1 block">Application Date</label>
            <input
              type="date"
              value={regulatory.clia_application_date || ''}
              onChange={(e) => setRegulatory({ ...regulatory, clia_application_date: e.target.value })}
              disabled={!editMode}
              className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="text-slate-400 text-sm mb-1 block">CLIA Number</label>
            <input
              type="text"
              value={regulatory.clia_number || ''}
              onChange={(e) => setRegulatory({ ...regulatory, clia_number: e.target.value })}
              disabled={!editMode}
              className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="text-slate-400 text-sm mb-1 block">Certificate Type</label>
            <select
              value={regulatory.clia_certificate_type || ''}
              onChange={(e) => setRegulatory({ ...regulatory, clia_certificate_type: e.target.value })}
              disabled={!editMode}
              className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 disabled:opacity-50"
            >
              <option value="">Select Type</option>
              <option value="waiver">Waiver</option>
              <option value="compliance">Compliance</option>
            </select>
          </div>
          <div>
            <label className="text-slate-400 text-sm mb-1 block">Certificate Received</label>
            {editMode ? (
              <input
                type="checkbox"
                checked={regulatory.clia_certificate_received || false}
                onChange={(e) => setRegulatory({ ...regulatory, clia_certificate_received: e.target.checked })}
                className="w-4 h-4"
              />
            ) : (
              <div className="flex items-center gap-2">
                {regulatory.clia_certificate_received ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-slate-500" />
                )}
              </div>
            )}
          </div>
          <div>
            <label className="text-slate-400 text-sm mb-1 block">Certificate Date</label>
            <input
              type="date"
              value={regulatory.clia_certificate_date || ''}
              onChange={(e) => setRegulatory({ ...regulatory, clia_certificate_date: e.target.value })}
              disabled={!editMode}
              className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="text-slate-400 text-sm mb-1 block">Expiration Date</label>
            <input
              type="date"
              value={regulatory.clia_certificate_expiration || ''}
              onChange={(e) => setRegulatory({ ...regulatory, clia_certificate_expiration: e.target.value })}
              disabled={!editMode}
              className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 disabled:opacity-50"
            />
          </div>
        </div>
        {editMode && (
          <button
            onClick={() => handleSave({ clia_application_submitted: regulatory.clia_application_submitted, clia_application_date: regulatory.clia_application_date, clia_number: regulatory.clia_number, clia_certificate_type: regulatory.clia_certificate_type, clia_certificate_received: regulatory.clia_certificate_received, clia_certificate_date: regulatory.clia_certificate_date, clia_certificate_expiration: regulatory.clia_certificate_expiration })}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white py-2 rounded font-medium mt-4 transition-colors"
          >
            Save CLIA Information
          </button>
        )}
      </div>

      {/* Proficiency Testing Section */}
      <div className="bg-slate-800 rounded-lg p-6 space-y-4">
        <h4 className="text-white font-semibold">Proficiency Testing (PT)</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-slate-400 text-sm mb-1 block">PT Program Enrolled</label>
            {editMode ? (
              <input
                type="checkbox"
                checked={regulatory.pt_program_enrolled || false}
                onChange={(e) => setRegulatory({ ...regulatory, pt_program_enrolled: e.target.checked })}
                className="w-4 h-4"
              />
            ) : (
              <div className="flex items-center gap-2">
                {regulatory.pt_program_enrolled ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-slate-500" />
                )}
              </div>
            )}
          </div>
          <div>
            <label className="text-slate-400 text-sm mb-1 block">PT Provider</label>
            <select
              value={regulatory.pt_provider || ''}
              onChange={(e) => setRegulatory({ ...regulatory, pt_provider: e.target.value })}
              disabled={!editMode}
              className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 disabled:opacity-50"
            >
              <option value="">Select Provider</option>
              <option value="CAP">CAP (College of American Pathologists)</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="text-slate-400 text-sm mb-1 block">PT Enrollment Date</label>
            <input
              type="date"
              value={regulatory.pt_enrollment_date || ''}
              onChange={(e) => setRegulatory({ ...regulatory, pt_enrollment_date: e.target.value })}
              disabled={!editMode}
              className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 disabled:opacity-50"
            />
          </div>
        </div>
        {editMode && (
          <button
            onClick={() => handleSave({ pt_program_enrolled: regulatory.pt_program_enrolled, pt_provider: regulatory.pt_provider, pt_enrollment_date: regulatory.pt_enrollment_date })}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white py-2 rounded font-medium mt-4 transition-colors"
          >
            Save PT Information
          </button>
        )}
      </div>

      {/* State License Section */}
      <div className="bg-slate-800 rounded-lg p-6 space-y-4">
        <h4 className="text-white font-semibold">State License</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-slate-400 text-sm mb-1 block">License Required</label>
            {editMode ? (
              <input
                type="checkbox"
                checked={regulatory.state_license_required || false}
                onChange={(e) => setRegulatory({ ...regulatory, state_license_required: e.target.checked })}
                className="w-4 h-4"
              />
            ) : (
              <div className="flex items-center gap-2">
                {regulatory.state_license_required ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-slate-500" />
                )}
              </div>
            )}
          </div>
          <div>
            <label className="text-slate-400 text-sm mb-1 block">License Number</label>
            <input
              type="text"
              value={regulatory.state_license_number || ''}
              onChange={(e) => setRegulatory({ ...regulatory, state_license_number: e.target.value })}
              disabled={!editMode}
              className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="text-slate-400 text-sm mb-1 block">License Date</label>
            <input
              type="date"
              value={regulatory.state_license_date || ''}
              onChange={(e) => setRegulatory({ ...regulatory, state_license_date: e.target.value })}
              disabled={!editMode}
              className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 disabled:opacity-50"
            />
          </div>
        </div>
        {editMode && (
          <button
            onClick={() => handleSave({ state_license_required: regulatory.state_license_required, state_license_number: regulatory.state_license_number, state_license_date: regulatory.state_license_date })}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white py-2 rounded font-medium mt-4 transition-colors"
          >
            Save State License Information
          </button>
        )}
      </div>
    </div>
  );
}
