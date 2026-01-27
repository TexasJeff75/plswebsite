import React, { useState, useEffect } from 'react';
import { BookOpen, CheckCircle2 } from 'lucide-react';
import { trainingService } from '../../services/trainingService';

export default function TrainingTab({ facility, isEditor }) {
  const [training, setTraining] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    loadTraining();
  }, [facility?.id]);

  async function loadTraining() {
    try {
      setLoading(true);
      const data = await trainingService.getByFacilityId(facility.id);
      setTraining(data || {});
    } catch (error) {
      console.error('Error loading training:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(updates) {
    try {
      await trainingService.upsert(facility.id, updates);
      setTraining({ ...training, ...updates });
      setEditMode(false);
    } catch (error) {
      console.error('Error saving training:', error);
    }
  }

  if (loading) {
    return <div className="text-slate-400">Loading training information...</div>;
  }

  const trainingScore = trainingService.getTrainingCompletionScore(training);

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
          <BookOpen className="w-5 h-5" />
          Training Management
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

      {/* Training Completion Score */}
      <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-6">
        <div className="text-center">
          <p className="text-slate-400 text-sm mb-2">Training Completion Score</p>
          <p className="text-4xl font-bold text-blue-400">{trainingScore}%</p>
          <div className="w-full bg-slate-700 rounded-full h-2 mt-4">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${trainingScore}%` }}
            />
          </div>
        </div>
      </div>

      {/* Initial Training */}
      <div className="bg-slate-800 rounded-lg p-6 space-y-4">
        <h4 className="text-white font-semibold">Initial Training</h4>
        <div className="space-y-3">
          <CheckboxField
            label="Training Scheduled"
            value={training?.initial_training_scheduled}
            onChange={(e) => setTraining({ ...training, initial_training_scheduled: e.target.checked })}
            disabled={!editMode}
          />
          <div>
            <label className="text-slate-400 text-sm mb-1 block">Training Date</label>
            <input
              type="date"
              value={training?.initial_training_date || ''}
              onChange={(e) => setTraining({ ...training, initial_training_date: e.target.value })}
              disabled={!editMode}
              className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 disabled:opacity-50"
            />
          </div>
          <CheckboxField
            label="Training Complete"
            value={training?.initial_training_complete}
            onChange={(e) => setTraining({ ...training, initial_training_complete: e.target.checked })}
            disabled={!editMode}
          />
          {training?.initial_training_complete && (
            <>
              <div>
                <label className="text-slate-400 text-sm mb-1 block">Trained By (Name)</label>
                <input
                  type="text"
                  value={training?.trained_by_name || ''}
                  onChange={(e) => setTraining({ ...training, trained_by_name: e.target.value })}
                  disabled={!editMode}
                  className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="text-slate-400 text-sm mb-1 block">Trainer Role</label>
                <select
                  value={training?.trained_by_role || ''}
                  onChange={(e) => setTraining({ ...training, trained_by_role: e.target.value })}
                  disabled={!editMode}
                  className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 disabled:opacity-50"
                >
                  <option value="">Select Role</option>
                  <option value="technical_consultant">Technical Consultant</option>
                  <option value="proximity_staff">Proximity Staff</option>
                </select>
              </div>
            </>
          )}
        </div>
        {editMode && (
          <button
            onClick={() => handleSave({ initial_training_scheduled: training.initial_training_scheduled, initial_training_date: training.initial_training_date, initial_training_complete: training.initial_training_complete, trained_by_name: training.trained_by_name, trained_by_role: training.trained_by_role })}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white py-2 rounded font-medium mt-4 transition-colors"
          >
            Save Initial Training
          </button>
        )}
      </div>

      {/* Competency Assessment */}
      <div className="bg-slate-800 rounded-lg p-6 space-y-4">
        <h4 className="text-white font-semibold">Competency Assessment</h4>
        <div className="space-y-3">
          <CheckboxField
            label="Competency Assessment Complete"
            value={training?.competency_assessment_complete}
            onChange={(e) => setTraining({ ...training, competency_assessment_complete: e.target.checked })}
            disabled={!editMode}
          />
          {training?.competency_assessment_complete && (
            <div>
              <label className="text-slate-400 text-sm mb-1 block">Assessment Date</label>
              <input
                type="date"
                value={training?.competency_assessment_date || ''}
                onChange={(e) => setTraining({ ...training, competency_assessment_date: e.target.value })}
                disabled={!editMode}
                className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 disabled:opacity-50"
              />
            </div>
          )}
        </div>
        {editMode && (
          <button
            onClick={() => handleSave({ competency_assessment_complete: training.competency_assessment_complete, competency_assessment_date: training.competency_assessment_date })}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white py-2 rounded font-medium mt-4 transition-colors"
          >
            Save Competency Assessment
          </button>
        )}
      </div>

      {/* Materials Provided */}
      <div className="bg-slate-800 rounded-lg p-6 space-y-4">
        <h4 className="text-white font-semibold">Training Materials Provided</h4>
        <div className="space-y-3">
          <CheckboxField
            label="Procedure Manual Provided"
            value={training?.procedure_manual_provided}
            onChange={(e) => setTraining({ ...training, procedure_manual_provided: e.target.checked })}
            disabled={!editMode}
          />
          <CheckboxField
            label="Emergency Contacts Provided"
            value={training?.emergency_contacts_provided}
            onChange={(e) => setTraining({ ...training, emergency_contacts_provided: e.target.checked })}
            disabled={!editMode}
          />
          <CheckboxField
            label="QC Protocols Provided"
            value={training?.qc_protocols_provided}
            onChange={(e) => setTraining({ ...training, qc_protocols_provided: e.target.checked })}
            disabled={!editMode}
          />
        </div>
        {editMode && (
          <button
            onClick={() => handleSave({ procedure_manual_provided: training.procedure_manual_provided, emergency_contacts_provided: training.emergency_contacts_provided, qc_protocols_provided: training.qc_protocols_provided })}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white py-2 rounded font-medium mt-4 transition-colors"
          >
            Save Materials Provided
          </button>
        )}
      </div>

      {/* Personnel Competency Summary */}
      {facility.trained_personnel && facility.trained_personnel.length > 0 && (
        <div className="bg-slate-800 rounded-lg p-6 space-y-4">
          <h4 className="text-white font-semibold">Personnel Competency Status</h4>
          <div className="space-y-3">
            {facility.trained_personnel.map(person => (
              <div key={person.id} className="bg-slate-700 p-3 rounded text-sm">
                <p className="text-white font-semibold">{person.name}</p>
                <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                  <div className="flex items-center gap-1">
                    {person.initial_training_complete ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-slate-500" />
                    )}
                    <span className="text-slate-300">Initial Training</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {person.competency_assessment_complete ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-slate-500" />
                    )}
                    <span className="text-slate-300">Competency</span>
                  </div>
                </div>
                {person.annual_competency_due && (
                  <p className="text-slate-400 text-xs mt-2">
                    Annual Competency Due: {new Date(person.annual_competency_due).toLocaleDateString()}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
