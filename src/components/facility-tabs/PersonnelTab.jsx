import React, { useState, useEffect } from 'react';
import { Users, Plus, Trash2, Pencil } from 'lucide-react';
import { personnelService } from '../../services/personnelService';

export default function PersonnelTab({ facility, isEditor }) {
  const [personnel, setPersonnel] = useState(null);
  const [trainedPersonnel, setTrainedPersonnel] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [newPerson, setNewPerson] = useState({
    name: '',
    title: '',
    email: '',
    instruments_certified: [],
  });

  useEffect(() => {
    loadPersonnelData();
  }, [facility?.id]);

  async function loadPersonnelData() {
    try {
      setLoading(true);
      const [personnelData, trainedData] = await Promise.all([
        personnelService.getByFacilityId(facility.id),
        personnelService.getTrainedPersonnel(facility.id),
      ]);
      setPersonnel(personnelData || {});
      setTrainedPersonnel(trainedData || []);
    } catch (error) {
      console.error('Error loading personnel:', error);
      setPersonnel({});
      setTrainedPersonnel([]);
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

  if (loading) {
    return <div className="text-slate-400">Loading personnel information...</div>;
  }

  const instruments = ['genexpert', 'clarity', 'epoc', 'abacus'];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Users className="w-5 h-5" />
          Personnel Management
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

      {/* Facility Administrator */}
      <div className="bg-slate-800 rounded-lg p-6 space-y-4">
        <h4 className="text-white font-semibold">Facility Administrator</h4>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="text-slate-400 text-sm mb-1 block">Name</label>
            <input
              type="text"
              value={personnel?.facility_admin_name || ''}
              onChange={(e) => setPersonnel({ ...personnel, facility_admin_name: e.target.value })}
              disabled={!editMode}
              className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 disabled:opacity-50"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-slate-400 text-sm mb-1 block">Email</label>
              <input
                type="email"
                value={personnel?.facility_admin_email || ''}
                onChange={(e) => setPersonnel({ ...personnel, facility_admin_email: e.target.value })}
                disabled={!editMode}
                className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-slate-400 text-sm mb-1 block">Phone</label>
              <input
                type="tel"
                value={personnel?.facility_admin_phone || ''}
                onChange={(e) => setPersonnel({ ...personnel, facility_admin_phone: e.target.value })}
                disabled={!editMode}
                className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 disabled:opacity-50"
              />
            </div>
          </div>
          {editMode && (
            <button
              onClick={() => handleSavePersonnelInfo({ facility_admin_name: personnel.facility_admin_name, facility_admin_email: personnel.facility_admin_email, facility_admin_phone: personnel.facility_admin_phone })}
              className="bg-teal-600 hover:bg-teal-700 text-white py-2 rounded font-medium transition-colors"
            >
              Save Administrator
            </button>
          )}
        </div>
      </div>

      {/* Lab Director (if Moderate Complexity) */}
      {facility.site_configuration === 'moderate' && (
        <div className="bg-slate-800 rounded-lg p-6 space-y-4">
          <h4 className="text-white font-semibold">Laboratory Director</h4>
          <div className="space-y-4">
            <div>
              <label className="text-slate-400 text-sm mb-1 block">Name</label>
              <input
                type="text"
                value={personnel?.lab_director_name || ''}
                onChange={(e) => setPersonnel({ ...personnel, lab_director_name: e.target.value })}
                disabled={!editMode}
                className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 disabled:opacity-50"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-slate-400 text-sm mb-1 block">Credentials (MD, DO, etc.)</label>
                <input
                  type="text"
                  value={personnel?.lab_director_credentials || ''}
                  onChange={(e) => setPersonnel({ ...personnel, lab_director_credentials: e.target.value })}
                  disabled={!editMode}
                  className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="text-slate-400 text-sm mb-1 block">NPI Number</label>
                <input
                  type="text"
                  value={personnel?.lab_director_npi_number || ''}
                  onChange={(e) => setPersonnel({ ...personnel, lab_director_npi_number: e.target.value })}
                  disabled={!editMode}
                  className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 disabled:opacity-50"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-slate-400 text-sm mb-1 block">Agreement Signed</label>
                <input
                  type="checkbox"
                  checked={personnel?.lab_director_agreement_signed || false}
                  onChange={(e) => setPersonnel({ ...personnel, lab_director_agreement_signed: e.target.checked })}
                  disabled={!editMode}
                  className="w-4 h-4"
                />
              </div>
              <div>
                <label className="text-slate-400 text-sm mb-1 block">Agreement Date</label>
                <input
                  type="date"
                  value={personnel?.lab_director_agreement_date || ''}
                  onChange={(e) => setPersonnel({ ...personnel, lab_director_agreement_date: e.target.value })}
                  disabled={!editMode}
                  className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 disabled:opacity-50"
                />
              </div>
            </div>
            <div>
              <label className="text-slate-400 text-sm mb-1 block">Other Labs Supervised (Max 5)</label>
              <input
                type="number"
                min="0"
                max="5"
                value={personnel?.lab_director_other_labs_supervised || 0}
                onChange={(e) => setPersonnel({ ...personnel, lab_director_other_labs_supervised: parseInt(e.target.value) })}
                disabled={!editMode}
                className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 disabled:opacity-50"
              />
            </div>
            {editMode && (
              <button
                onClick={() => handleSavePersonnelInfo({ lab_director_name: personnel.lab_director_name, lab_director_credentials: personnel.lab_director_credentials, lab_director_npi_number: personnel.lab_director_npi_number, lab_director_agreement_signed: personnel.lab_director_agreement_signed, lab_director_agreement_date: personnel.lab_director_agreement_date, lab_director_other_labs_supervised: personnel.lab_director_other_labs_supervised })}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white py-2 rounded font-medium transition-colors"
              >
                Save Lab Director
              </button>
            )}
          </div>
        </div>
      )}

      {/* Technical Consultant */}
      <div className="bg-slate-800 rounded-lg p-6 space-y-4">
        <h4 className="text-white font-semibold">Technical Consultant (Proximity)</h4>
        <div className="space-y-4">
          <div>
            <label className="text-slate-400 text-sm mb-1 block">Consultant Assigned</label>
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
                <label className="text-slate-400 text-sm mb-1 block">Consultant Name</label>
                <input
                  type="text"
                  value={personnel?.technical_consultant_name || ''}
                  onChange={(e) => setPersonnel({ ...personnel, technical_consultant_name: e.target.value })}
                  disabled={!editMode}
                  className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="text-slate-400 text-sm mb-1 block">Region</label>
                <select
                  value={personnel?.technical_consultant_region || ''}
                  onChange={(e) => setPersonnel({ ...personnel, technical_consultant_region: e.target.value })}
                  disabled={!editMode}
                  className="w-full bg-slate-700 text-white px-3 py-2 rounded border border-slate-600 disabled:opacity-50"
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
              onClick={() => handleSavePersonnelInfo({ technical_consultant_assigned: personnel.technical_consultant_assigned, technical_consultant_name: personnel.technical_consultant_name, technical_consultant_region: personnel.technical_consultant_region })}
              className="w-full bg-teal-600 hover:bg-teal-700 text-white py-2 rounded font-medium transition-colors"
            >
              Save Technical Consultant
            </button>
          )}
        </div>
      </div>

      {/* Trained Personnel */}
      <div className="bg-slate-800 rounded-lg p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h4 className="text-white font-semibold">Trained Personnel</h4>
          {isEditor && (
            <button
              onClick={() => setShowAddPerson(!showAddPerson)}
              className="px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded text-sm flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Person
            </button>
          )}
        </div>

        {showAddPerson && isEditor && (
          <div className="bg-slate-700 p-4 rounded space-y-3 border border-teal-600">
            <div>
              <label className="text-slate-400 text-sm mb-1 block">Name</label>
              <input
                type="text"
                value={newPerson.name}
                onChange={(e) => setNewPerson({ ...newPerson, name: e.target.value })}
                placeholder="Enter name"
                className="w-full bg-slate-600 text-white px-3 py-2 rounded border border-slate-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 text-sm mb-1 block">Title</label>
                <input
                  type="text"
                  value={newPerson.title}
                  onChange={(e) => setNewPerson({ ...newPerson, title: e.target.value })}
                  placeholder="e.g., Lab Tech"
                  className="w-full bg-slate-600 text-white px-3 py-2 rounded border border-slate-500"
                />
              </div>
              <div>
                <label className="text-slate-400 text-sm mb-1 block">Email</label>
                <input
                  type="email"
                  value={newPerson.email}
                  onChange={(e) => setNewPerson({ ...newPerson, email: e.target.value })}
                  placeholder="Email"
                  className="w-full bg-slate-600 text-white px-3 py-2 rounded border border-slate-500"
                />
              </div>
            </div>
            <div>
              <label className="text-slate-400 text-sm mb-2 block">Instruments Certified</label>
              <div className="grid grid-cols-2 gap-2">
                {instruments.map(inst => (
                  <label key={inst} className="flex items-center gap-2 text-slate-300">
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
                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white py-2 rounded font-medium transition-colors"
              >
                Add
              </button>
              <button
                onClick={() => setShowAddPerson(false)}
                className="flex-1 bg-slate-600 hover:bg-slate-500 text-white py-2 rounded font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {trainedPersonnel.map(person => (
            <div key={person.id} className="bg-slate-700 p-4 rounded flex justify-between items-start">
              <div className="flex-1">
                <p className="text-white font-semibold">{person.name}</p>
                <p className="text-slate-400 text-sm">{person.title}</p>
                <p className="text-slate-500 text-xs">{person.email}</p>
                {person.instruments_certified?.length > 0 && (
                  <p className="text-teal-300 text-xs mt-2">
                    Certified: {person.instruments_certified.join(', ')}
                  </p>
                )}
              </div>
              {isEditor && (
                <button
                  onClick={() => handleDeletePerson(person.id)}
                  className="text-red-400 hover:text-red-300 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
          {trainedPersonnel.length === 0 && (
            <p className="text-slate-500 text-center py-4">No trained personnel added yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
