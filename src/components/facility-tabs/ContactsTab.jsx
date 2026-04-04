import React, { useState, useEffect } from 'react';
import { Phone, Mail, User, Star, CreditCard as Edit2, Trash2, Plus, Save, X, Truck, Check } from 'lucide-react';
import { facilityContactsService } from '../../services/facilityContactsService';
import { courierAssignmentService } from '../../services/courierAssignmentService';
import { useAuth } from '../../contexts/AuthContext';

export default function ContactsTab({ facility }) {
  const { isStaff, user } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [contactRoles, setContactRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingContact, setEditingContact] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState(null);
  const [couriers, setCouriers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selectedCourierId, setSelectedCourierId] = useState('');
  const [courierSaving, setCourierSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    phone: '',
    email: '',
    is_primary: false,
    notes: ''
  });

  useEffect(() => {
    loadContacts();
    loadContactRoles();
    if (isStaff) {
      loadCourierData();
    }
  }, [facility.id, isStaff]);

  async function loadContacts() {
    try {
      setLoading(true);
      const data = await facilityContactsService.getContactsByFacility(facility.id);
      setContacts(data);
    } catch (err) {
      console.error('Error loading contacts:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadContactRoles() {
    try {
      const roles = await facilityContactsService.getContactRoles();
      setContactRoles(roles);
    } catch (err) {
      console.error('Error loading contact roles:', err);
    }
  }

  async function loadCourierData() {
    try {
      const [allCouriers, facilityAssignments] = await Promise.all([
        courierAssignmentService.getAllCouriers(),
        courierAssignmentService.getByFacility(facility.id),
      ]);
      setCouriers(allCouriers);
      setAssignments(facilityAssignments);
    } catch (err) {
      console.error('Error loading courier data:', err);
    }
  }

  async function handleAssignCourier() {
    if (!selectedCourierId) return;
    try {
      setCourierSaving(true);
      await courierAssignmentService.assignCourier(facility.id, selectedCourierId, user?.id);
      setSelectedCourierId('');
      await loadCourierData();
    } catch (err) {
      alert(err.message);
    } finally {
      setCourierSaving(false);
    }
  }

  async function handleDeactivateCourier(assignmentId) {
    try {
      await courierAssignmentService.deactivate(assignmentId);
      await loadCourierData();
    } catch (err) {
      alert(err.message);
    }
  }

  function handleEdit(contact) {
    setEditingContact(contact.id);
    setFormData({
      name: contact.name,
      role: contact.role,
      phone: contact.phone || '',
      email: contact.email || '',
      is_primary: contact.is_primary,
      notes: contact.notes || ''
    });
    setShowAddForm(false);
  }

  function handleCancelEdit() {
    setEditingContact(null);
    setShowAddForm(false);
    setFormData({
      name: '',
      role: '',
      phone: '',
      email: '',
      is_primary: false,
      notes: ''
    });
  }

  function handleAddNew() {
    setShowAddForm(true);
    setEditingContact(null);
    setFormData({
      name: '',
      role: '',
      phone: '',
      email: '',
      is_primary: false,
      notes: ''
    });
  }

  async function handleSave() {
    try {
      setError(null);

      if (!formData.name.trim() || !formData.role) {
        setError('Name and role are required');
        return;
      }

      if (editingContact) {
        await facilityContactsService.updateContact(editingContact, formData);
      } else {
        await facilityContactsService.createContact({
          ...formData,
          facility_id: facility.id
        });
      }

      await loadContacts();
      handleCancelEdit();
      setShowAddForm(false);
    } catch (err) {
      console.error('Error saving contact:', err);
      setError(err.message);
    }
  }

  async function handleDelete(contactId) {
    if (!confirm('Are you sure you want to delete this contact?')) return;

    try {
      setError(null);
      await facilityContactsService.deleteContact(contactId);
      await loadContacts();
    } catch (err) {
      console.error('Error deleting contact:', err);
      setError(err.message);
    }
  }

  async function handleSetPrimary(contactId) {
    try {
      setError(null);
      await facilityContactsService.setPrimaryContact(contactId, facility.id);
      await loadContacts();
    } catch (err) {
      console.error('Error setting primary contact:', err);
      setError(err.message);
    }
  }

  const getRoleName = (roleCode) => {
    const role = contactRoles.find(r => r.code === roleCode);
    return role ? role.display_name : roleCode;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Loading contacts...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 text-red-400">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Facility Contacts</h3>
          <p className="text-sm text-slate-400">Manage contacts for this facility</p>
        </div>
        <button
          onClick={handleAddNew}
          disabled={showAddForm || editingContact}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Contact
        </button>
      </div>

      {(showAddForm || editingContact) && (
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h4 className="text-white font-medium mb-4">
            {editingContact ? 'Edit Contact' : 'Add New Contact'}
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter contact name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Role <span className="text-red-400">*</span>
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a role</option>
                {contactRoles.map((role) => (
                  <option key={role.id} value={role.code}>
                    {role.display_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Phone
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="(555) 123-4567"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="contact@example.com"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Additional notes about this contact..."
              />
            </div>

            <div className="md:col-span-2">
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_primary}
                  onChange={(e) => setFormData({ ...formData, is_primary: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-blue-600 focus:ring-2 focus:ring-blue-500"
                />
                Set as primary contact
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <button
              onClick={handleCancelEdit}
              className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Save className="w-4 h-4" />
              Save Contact
            </button>
          </div>
        </div>
      )}

      {isStaff && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Truck className="w-5 h-5 text-amber-400" />
            <h3 className="text-white font-semibold">Courier Assignment</h3>
          </div>

          {assignments.filter(a => a.is_active).length > 0 ? (
            <div className="space-y-2 mb-4">
              {assignments.filter(a => a.is_active).map(a => (
                <div key={a.id} className="flex items-center justify-between bg-amber-500/10 border border-amber-500/20 rounded-lg px-4 py-3">
                  <div>
                    <p className="text-white font-medium text-sm">{a.courier?.display_name || a.courier?.email}</p>
                    <p className="text-slate-400 text-xs">{a.courier?.email} &mdash; Active Courier</p>
                  </div>
                  <button
                    onClick={() => handleDeactivateCourier(a.id)}
                    className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                    title="Remove courier assignment"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-400 text-sm mb-4">No courier currently assigned to this facility.</p>
          )}

          <div className="flex items-center gap-3">
            <select
              value={selectedCourierId}
              onChange={e => setSelectedCourierId(e.target.value)}
              className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-teal-500"
            >
              <option value="">Select a courier to assign...</option>
              {couriers.map(c => (
                <option key={c.user_id} value={c.user_id}>{c.display_name || c.email}</option>
              ))}
            </select>
            <button
              onClick={handleAssignCourier}
              disabled={!selectedCourierId || courierSaving}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors text-sm"
            >
              <Check className="w-4 h-4" />
              Assign
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {contacts.length === 0 ? (
          <div className="col-span-2 text-center py-12 text-slate-400">
            <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No contacts added yet</p>
            <p className="text-sm mt-2">Click "Add Contact" to create the first contact</p>
          </div>
        ) : (
          contacts.map((contact) => (
            <div
              key={contact.id}
              className="bg-slate-800 rounded-lg p-6 border border-slate-700 hover:border-slate-600 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center text-slate-300 flex-shrink-0">
                    <User className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-white font-medium truncate">{contact.name}</h4>
                      {contact.is_primary && (
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                      )}
                    </div>
                    <p className="text-sm text-slate-400">{getRoleName(contact.role)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-2">
                  {!contact.is_primary && (
                    <button
                      onClick={() => handleSetPrimary(contact.id)}
                      title="Set as primary contact"
                      className="p-2 text-slate-400 hover:text-yellow-500 hover:bg-slate-700 rounded transition-colors"
                    >
                      <Star className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleEdit(contact)}
                    disabled={editingContact || showAddForm}
                    className="p-2 text-slate-400 hover:text-blue-500 hover:bg-slate-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(contact.id)}
                    disabled={editingContact || showAddForm}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-slate-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {contact.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-slate-500 flex-shrink-0" />
                    <a
                      href={`tel:${contact.phone}`}
                      className="text-slate-300 hover:text-blue-400 transition-colors"
                    >
                      {contact.phone}
                    </a>
                  </div>
                )}
                {contact.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-slate-500 flex-shrink-0" />
                    <a
                      href={`mailto:${contact.email}`}
                      className="text-slate-300 hover:text-blue-400 transition-colors truncate"
                    >
                      {contact.email}
                    </a>
                  </div>
                )}
                {contact.notes && (
                  <div className="mt-3 pt-3 border-t border-slate-700">
                    <p className="text-sm text-slate-400">{contact.notes}</p>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
