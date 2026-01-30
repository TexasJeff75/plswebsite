import React, { useState, useEffect } from 'react';
import { Users, Plus, Trash2, BookOpen, CheckCircle2, Award, Loader2, Pencil, X, Check } from 'lucide-react';
import { personnelService } from '../../services/personnelService';
import { trainingService } from '../../services/trainingService';
import { certificateService } from '../../services/certificateService';

export default function PersonnelTrainingTab({ facility, isEditor }) {
  const [personnel, setPersonnel] = useState(null);
  const [trainedPersonnel, setTrainedPersonnel] = useState([]);
  const [training, setTraining] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [newPerson, setNewPerson] = useState({
    name: '',
    title: '',
    email: '',
    instruments_certified: [],
  });
  const [generatingCertificate, setGeneratingCertificate] = useState(null);
  const [editingPerson, setEditingPerson] = useState(null);
  const [editPersonData, setEditPersonData] = useState(null);

  useEffect(() => {
    loadData();
  }, [facility?.id]);

  async function loadData() {
    try {
      setLoading(true);
      const [personnelData, trainedData, trainingData] = await Promise.all([
        personnelService.getByFacilityId(facility.id),
        personnelService.getTrainedPersonnel(facility.id),
        trainingService.getByFacilityId(facility.id),
      ]);
      setPersonnel(personnelData || {});
      setTrainedPersonnel(trainedData || []);
      setTraining(trainingData || {});
    } catch (error) {
      console.error('Error loading personnel and training data:', error);
      setPersonnel({});
      setTrainedPersonnel([]);
      setTraining({});
    } finally {
      setLoading(false);
    }
  }

  async function handleSavePersonnelInfo(updates) {
    try {
      await personnelService.upsert(facility.id, updates);
      setPersonnel({ ...personnel, ...updates });
      setEditMode(false);
    } catch (error) {
      console.error('Error saving personnel info:', error);
    }
  }

  async function handleSaveTraining(updates) {
    try {
      await trainingService.upsert(facility.id, updates);
      setTraining({ ...training, ...updates });
      setEditMode(false);
    } catch (error) {
      console.error('Error saving training:', error);
    }
  }

  async function handleAddPerson() {
    try {
      const person = await personnelService.addTrainedPerson(facility.id, newPerson);
      setTrainedPersonnel([...trainedPersonnel, person]);
      setNewPerson({ name: '', title: '', email: '', instruments_certified: [] });
      setShowAddPerson(false);
    } catch (error) {
      console.error('Error adding trained person:', error);
    }
  }

  async function handleDeletePerson(personId) {
    try {
      await personnelService.deleteTrainedPerson(personId);
      setTrainedPersonnel(trainedPersonnel.filter(p => p.id !== personId));
    } catch (error) {
      console.error('Error deleting person:', error);
    }
  }

  function startEditPerson(person) {
    setEditingPerson(person.id);
    setEditPersonData({ ...person });
  }

  function cancelEditPerson() {
    setEditingPerson(null);
    setEditPersonData(null);
  }

  async function handleSavePerson() {
    if (!editPersonData) return;
    try {
      const updated = await personnelService.updateTrainedPerson(editPersonData.id, {
        name: editPersonData.name,
        title: editPersonData.title,
        email: editPersonData.email,
        instruments_certified: editPersonData.instruments_certified,
      });
      setTrainedPersonnel(trainedPersonnel.map(p => p.id === updated.id ? updated : p));
      setEditingPerson(null);
      setEditPersonData(null);
    } catch (error) {
      console.error('Error updating person:', error);
    }
  }

  function handleGenerateCertificate(person) {
    if (!person.instruments_certified?.length) return;

    setGeneratingCertificate(person.id);
    try {
      const technicalConsultantName = personnel?.technical_consultant_name || '';
      certificateService.generateCertificate(person, facility, person.instruments_certified, technicalConsultantName);
    } catch (error) {
      console.error('Error generating certificate:', error);
    } finally {
      setTimeout(() => setGeneratingCertificate(null), 500);
    }
  }

  if (loading) {
    return <div className="text-slate-400">Loading personnel and training information...</div>;
  }

  const instruments = ['genexpert', 'clarity', 'epoc', 'abacus'];
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
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold text-white flex items-center gap-2">
          <Users className="w-6 h-6 text-teal-400" />
          Personnel & Training Management
        </h3>
        {isEditor && (
          <button
            onClick={() => setEditMode(!editMode)}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {editMode ? 'Done Editing' : 'Edit'}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <div className="bg-slate-900/50 rounded-lg p-1 border border-teal-600/30">
            <h4 className="text-lg font-semibold text-teal-400 px-5 pt-4 pb-2 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Personnel Information
            </h4>
            <div className="space-y-4 p-4">
              <div className="bg-slate-800 rounded-lg p-5 space-y-4">
                <h5 className="text-white font-semibold text-sm">Facility Administrator</h5>
                <div className="space-y-3">
                  <div>
                    <label className="text-slate-400 text-xs mb-1 block">Name</label>
                    <input
                      type="text"
                      value={personnel?.facility_admin_name || ''}
                      onChange={(e) => setPersonnel({ ...personnel, facility_admin_name: e.target.value })}
                      disabled={!editMode}
                      className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 disabled:opacity-50 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-400 text-xs mb-1 block">Email</label>
                      <input
                        type="email"
                        value={personnel?.facility_admin_email || ''}
                        onChange={(e) => setPersonnel({ ...personnel, facility_admin_email: e.target.value })}
                        disabled={!editMode}
                        className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 disabled:opacity-50 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 text-xs mb-1 block">Phone</label>
                      <input
                        type="tel"
                        value={personnel?.facility_admin_phone || ''}
                        onChange={(e) => setPersonnel({ ...personnel, facility_admin_phone: e.target.value })}
                        disabled={!editMode}
                        className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 disabled:opacity-50 text-sm"
                      />
                    </div>
                  </div>
                  {editMode && (
                    <button
                      onClick={() => handleSavePersonnelInfo({
                        facility_admin_name: personnel.facility_admin_name,
                        facility_admin_email: personnel.facility_admin_email,
                        facility_admin_phone: personnel.facility_admin_phone
                      })}
                      className="w-full bg-teal-600 hover:bg-teal-700 text-white py-2 rounded font-medium transition-colors text-sm"
                    >
                      Save Administrator
                    </button>
                  )}
                </div>
              </div>

              {facility.site_configuration === 'moderate' && (
                <div className="bg-slate-800 rounded-lg p-5 space-y-4">
                  <h5 className="text-white font-semibold text-sm">Laboratory Director</h5>
                  <div className="space-y-3">
                    <div>
                      <label className="text-slate-400 text-xs mb-1 block">Name</label>
                      <input
                        type="text"
                        value={personnel?.lab_director_name || ''}
                        onChange={(e) => setPersonnel({ ...personnel, lab_director_name: e.target.value })}
                        disabled={!editMode}
                        className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 disabled:opacity-50 text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-slate-400 text-xs mb-1 block">Credentials</label>
                        <input
                          type="text"
                          value={personnel?.lab_director_credentials || ''}
                          onChange={(e) => setPersonnel({ ...personnel, lab_director_credentials: e.target.value })}
                          disabled={!editMode}
                          className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 disabled:opacity-50 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-slate-400 text-xs mb-1 block">NPI Number</label>
                        <input
                          type="text"
                          value={personnel?.lab_director_npi_number || ''}
                          onChange={(e) => setPersonnel({ ...personnel, lab_director_npi_number: e.target.value })}
                          disabled={!editMode}
                          className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 disabled:opacity-50 text-sm"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-slate-400 text-xs mb-1 block">Agreement Signed</label>
                        <input
                          type="checkbox"
                          checked={personnel?.lab_director_agreement_signed || false}
                          onChange={(e) => setPersonnel({ ...personnel, lab_director_agreement_signed: e.target.checked })}
                          disabled={!editMode}
                          className="w-4 h-4"
                        />
                      </div>
                      <div>
                        <label className="text-slate-400 text-xs mb-1 block">Agreement Date</label>
                        <input
                          type="date"
                          value={personnel?.lab_director_agreement_date || ''}
                          onChange={(e) => setPersonnel({ ...personnel, lab_director_agreement_date: e.target.value })}
                          disabled={!editMode}
                          className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 disabled:opacity-50 text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-slate-400 text-xs mb-1 block">Other Labs Supervised (Max 5)</label>
                      <input
                        type="number"
                        min="0"
                        max="5"
                        value={personnel?.lab_director_other_labs_supervised || 0}
                        onChange={(e) => setPersonnel({ ...personnel, lab_director_other_labs_supervised: parseInt(e.target.value) })}
                        disabled={!editMode}
                        className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 disabled:opacity-50 text-sm"
                      />
                    </div>
                    {editMode && (
                      <button
                        onClick={() => handleSavePersonnelInfo({
                          lab_director_name: personnel.lab_director_name,
                          lab_director_credentials: personnel.lab_director_credentials,
                          lab_director_npi_number: personnel.lab_director_npi_number,
                          lab_director_agreement_signed: personnel.lab_director_agreement_signed,
                          lab_director_agreement_date: personnel.lab_director_agreement_date,
                          lab_director_other_labs_supervised: personnel.lab_director_other_labs_supervised
                        })}
                        className="w-full bg-teal-600 hover:bg-teal-700 text-white py-2 rounded font-medium transition-colors text-sm"
                      >
                        Save Lab Director
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="bg-slate-800 rounded-lg p-5 space-y-4">
                <h5 className="text-white font-semibold text-sm">Technical Consultant (Proximity)</h5>
                <div className="space-y-3">
                  <div>
                    <label className="text-slate-400 text-xs mb-1 block">Consultant Assigned</label>
                    <input
                      type="checkbox"
                      checked={personnel?.technical_consultant_assigned || false}
                      onChange={(e) => setPersonnel({ ...personnel, technical_consultant_assigned: e.target.checked })}
                      disabled={!editMode}
                      className="w-4 h-4"
                    />
                  </div>
                  {personnel?.technical_consultant_assigned && (
                    <>
                      <div>
                        <label className="text-slate-400 text-xs mb-1 block">Consultant Name</label>
                        <input
                          type="text"
                          value={personnel?.technical_consultant_name || ''}
                          onChange={(e) => setPersonnel({ ...personnel, technical_consultant_name: e.target.value })}
                          disabled={!editMode}
                          className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 disabled:opacity-50 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-slate-400 text-xs mb-1 block">Region</label>
                        <select
                          value={personnel?.technical_consultant_region || ''}
                          onChange={(e) => setPersonnel({ ...personnel, technical_consultant_region: e.target.value })}
                          disabled={!editMode}
                          className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 disabled:opacity-50 text-sm"
                        >
                          <option value="">Select Region</option>
                          <option value="east">East</option>
                          <option value="west">West</option>
                        </select>
                      </div>
                    </>
                  )}
                  {editMode && (
                    <button
                      onClick={() => handleSavePersonnelInfo({
                        technical_consultant_assigned: personnel.technical_consultant_assigned,
                        technical_consultant_name: personnel.technical_consultant_name,
                        technical_consultant_region: personnel.technical_consultant_region
                      })}
                      className="w-full bg-teal-600 hover:bg-teal-700 text-white py-2 rounded font-medium transition-colors text-sm"
                    >
                      Save Technical Consultant
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-slate-800 rounded-lg p-5 space-y-4">
                <div className="flex justify-between items-center">
                  <h5 className="text-white font-semibold text-sm">Trained Personnel</h5>
                  {isEditor && (
                    <button
                      onClick={() => setShowAddPerson(!showAddPerson)}
                      className="px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded text-xs flex items-center gap-2 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      Add
                    </button>
                  )}
                </div>

                {showAddPerson && isEditor && (
                  <div className="bg-slate-700 p-4 rounded space-y-3 border border-teal-600">
                    <div>
                      <label className="text-slate-400 text-xs mb-1 block">Name</label>
                      <input
                        type="text"
                        value={newPerson.name}
                        onChange={(e) => setNewPerson({ ...newPerson, name: e.target.value })}
                        placeholder="Enter name"
                        className="w-full bg-slate-600 text-white px-3 py-2 rounded border border-slate-500 text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-slate-400 text-xs mb-1 block">Title</label>
                        <input
                          type="text"
                          value={newPerson.title}
                          onChange={(e) => setNewPerson({ ...newPerson, title: e.target.value })}
                          placeholder="e.g., Lab Tech"
                          className="w-full bg-slate-600 text-white px-3 py-2 rounded border border-slate-500 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-slate-400 text-xs mb-1 block">Email</label>
                        <input
                          type="email"
                          value={newPerson.email}
                          onChange={(e) => setNewPerson({ ...newPerson, email: e.target.value })}
                          placeholder="Email"
                          className="w-full bg-slate-600 text-white px-3 py-2 rounded border border-slate-500 text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-slate-400 text-xs mb-2 block">Instruments Certified</label>
                      <div className="grid grid-cols-2 gap-2">
                        {instruments.map(inst => (
                          <label key={inst} className="flex items-center gap-2 text-slate-300 text-xs">
                            <input
                              type="checkbox"
                              checked={newPerson.instruments_certified.includes(inst)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setNewPerson({
                                    ...newPerson,
                                    instruments_certified: [...newPerson.instruments_certified, inst],
                                  });
                                } else {
                                  setNewPerson({
                                    ...newPerson,
                                    instruments_certified: newPerson.instruments_certified.filter(i => i !== inst),
                                  });
                                }
                              }}
                              className="w-4 h-4"
                            />
                            {inst.charAt(0).toUpperCase() + inst.slice(1)}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleAddPerson}
                        className="flex-1 bg-teal-600 hover:bg-teal-700 text-white py-2 rounded font-medium transition-colors text-sm"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => setShowAddPerson(false)}
                        className="flex-1 bg-slate-600 hover:bg-slate-500 text-white py-2 rounded font-medium transition-colors text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {trainedPersonnel.map(person => (
                    <div key={person.id} className="bg-slate-700 p-3 rounded">
                      {editingPerson === person.id ? (
                        <div className="space-y-3">
                          <div>
                            <label className="text-slate-400 text-xs mb-1 block">Name</label>
                            <input
                              type="text"
                              value={editPersonData?.name || ''}
                              onChange={(e) => setEditPersonData({ ...editPersonData, name: e.target.value })}
                              className="w-full bg-slate-600 text-white px-3 py-2 rounded border border-slate-500 text-sm"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-slate-400 text-xs mb-1 block">Title</label>
                              <input
                                type="text"
                                value={editPersonData?.title || ''}
                                onChange={(e) => setEditPersonData({ ...editPersonData, title: e.target.value })}
                                className="w-full bg-slate-600 text-white px-3 py-2 rounded border border-slate-500 text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-slate-400 text-xs mb-1 block">Email</label>
                              <input
                                type="email"
                                value={editPersonData?.email || ''}
                                onChange={(e) => setEditPersonData({ ...editPersonData, email: e.target.value })}
                                className="w-full bg-slate-600 text-white px-3 py-2 rounded border border-slate-500 text-sm"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-slate-400 text-xs mb-2 block">Instruments Certified</label>
                            <div className="grid grid-cols-2 gap-2">
                              {instruments.map(inst => (
                                <label key={inst} className="flex items-center gap-2 text-slate-300 text-xs">
                                  <input
                                    type="checkbox"
                                    checked={editPersonData?.instruments_certified?.includes(inst) || false}
                                    onChange={(e) => {
                                      const current = editPersonData?.instruments_certified || [];
                                      if (e.target.checked) {
                                        setEditPersonData({ ...editPersonData, instruments_certified: [...current, inst] });
                                      } else {
                                        setEditPersonData({ ...editPersonData, instruments_certified: current.filter(i => i !== inst) });
                                      }
                                    }}
                                    className="w-4 h-4"
                                  />
                                  {inst.charAt(0).toUpperCase() + inst.slice(1)}
                                </label>
                              ))}
                            </div>
                          </div>
                          <div className="flex gap-2 pt-2">
                            <button
                              onClick={handleSavePerson}
                              className="flex-1 bg-teal-600 hover:bg-teal-700 text-white py-2 rounded font-medium transition-colors text-sm flex items-center justify-center gap-2"
                            >
                              <Check className="w-4 h-4" />
                              Save
                            </button>
                            <button
                              onClick={cancelEditPerson}
                              className="flex-1 bg-slate-600 hover:bg-slate-500 text-white py-2 rounded font-medium transition-colors text-sm flex items-center justify-center gap-2"
                            >
                              <X className="w-4 h-4" />
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="text-white font-semibold text-sm">{person.name}</p>
                            <p className="text-slate-400 text-xs">{person.title}</p>
                            <p className="text-slate-500 text-xs">{person.email}</p>
                            {person.instruments_certified?.length > 0 && (
                              <p className="text-teal-300 text-xs mt-1">
                                Certified: {person.instruments_certified.join(', ')}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            {person.instruments_certified?.length > 0 && (
                              <button
                                onClick={() => handleGenerateCertificate(person)}
                                disabled={generatingCertificate === person.id}
                                className="p-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded transition-colors disabled:opacity-50"
                                title="Generate Certificate"
                              >
                                {generatingCertificate === person.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Award className="w-4 h-4" />
                                )}
                              </button>
                            )}
                            {isEditor && (
                              <>
                                <button
                                  onClick={() => startEditPerson(person)}
                                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-600 rounded transition-colors"
                                  title="Edit"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeletePerson(person.id)}
                                  className="p-1.5 text-red-400 hover:text-red-300 hover:bg-slate-600 rounded transition-colors"
                                  title="Remove"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {trainedPersonnel.length === 0 && (
                    <p className="text-slate-500 text-center py-4 text-sm">No trained personnel added yet</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900/50 rounded-lg p-1 border border-blue-600/30">
            <h4 className="text-lg font-semibold text-blue-400 px-5 pt-4 pb-2 flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Training Information
            </h4>
            <div className="space-y-4 p-4">
              <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-5">
                <div className="text-center">
                  <p className="text-slate-400 text-xs mb-2">Training Completion Score</p>
                  <p className="text-3xl font-bold text-blue-400">{trainingScore}%</p>
                  <div className="w-full bg-slate-700 rounded-full h-2 mt-4">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${trainingScore}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-slate-800 rounded-lg p-5 space-y-4">
                <h5 className="text-white font-semibold text-sm">Initial Training</h5>
                <div className="space-y-3">
                  <CheckboxField
                    label="Training Scheduled"
                    value={training?.initial_training_scheduled}
                    onChange={(e) => setTraining({ ...training, initial_training_scheduled: e.target.checked })}
                    disabled={!editMode}
                  />
                  <div>
                    <label className="text-slate-400 text-xs mb-1 block">Training Date</label>
                    <input
                      type="date"
                      value={training?.initial_training_date || ''}
                      onChange={(e) => setTraining({ ...training, initial_training_date: e.target.value })}
                      disabled={!editMode}
                      className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 disabled:opacity-50 text-sm"
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
                        <label className="text-slate-400 text-xs mb-1 block">Trained By (Name)</label>
                        <input
                          type="text"
                          value={training?.trained_by_name || ''}
                          onChange={(e) => setTraining({ ...training, trained_by_name: e.target.value })}
                          disabled={!editMode}
                          className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 disabled:opacity-50 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-slate-400 text-xs mb-1 block">Trainer Role</label>
                        <select
                          value={training?.trained_by_role || ''}
                          onChange={(e) => setTraining({ ...training, trained_by_role: e.target.value })}
                          disabled={!editMode}
                          className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 disabled:opacity-50 text-sm"
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
                    onClick={() => handleSaveTraining({
                      initial_training_scheduled: training.initial_training_scheduled,
                      initial_training_date: training.initial_training_date,
                      initial_training_complete: training.initial_training_complete,
                      trained_by_name: training.trained_by_name,
                      trained_by_role: training.trained_by_role
                    })}
                    className="w-full bg-teal-600 hover:bg-teal-700 text-white py-2 rounded font-medium transition-colors text-sm"
                  >
                    Save Initial Training
                  </button>
                )}
              </div>

              <div className="bg-slate-800 rounded-lg p-5 space-y-4">
                <h5 className="text-white font-semibold text-sm">Competency Assessment</h5>
                <div className="space-y-3">
                  <CheckboxField
                    label="Competency Assessment Complete"
                    value={training?.competency_assessment_complete}
                    onChange={(e) => setTraining({ ...training, competency_assessment_complete: e.target.checked })}
                    disabled={!editMode}
                  />
                  {training?.competency_assessment_complete && (
                    <div>
                      <label className="text-slate-400 text-xs mb-1 block">Assessment Date</label>
                      <input
                        type="date"
                        value={training?.competency_assessment_date || ''}
                        onChange={(e) => setTraining({ ...training, competency_assessment_date: e.target.value })}
                        disabled={!editMode}
                        className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 disabled:opacity-50 text-sm"
                      />
                    </div>
                  )}
                </div>
                {editMode && (
                  <button
                    onClick={() => handleSaveTraining({
                      competency_assessment_complete: training.competency_assessment_complete,
                      competency_assessment_date: training.competency_assessment_date
                    })}
                    className="w-full bg-teal-600 hover:bg-teal-700 text-white py-2 rounded font-medium transition-colors text-sm"
                  >
                    Save Competency Assessment
                  </button>
                )}
              </div>

              <div className="bg-slate-800 rounded-lg p-5 space-y-4">
                <h5 className="text-white font-semibold text-sm">Training Materials Provided</h5>
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
                    onClick={() => handleSaveTraining({
                      procedure_manual_provided: training.procedure_manual_provided,
                      emergency_contacts_provided: training.emergency_contacts_provided,
                      qc_protocols_provided: training.qc_protocols_provided
                    })}
                    className="w-full bg-teal-600 hover:bg-teal-700 text-white py-2 rounded font-medium transition-colors text-sm"
                  >
                    Save Materials Provided
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
