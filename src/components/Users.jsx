import React, { useState, useEffect } from 'react';
import { Users as UsersIcon, Edit2, Trash2, Shield, Building2, Plus, X, Check } from 'lucide-react';
import { usersService } from '../services/usersService';
import { organizationsService } from '../services/organizationsService';
import { organizationAssignmentsService } from '../services/organizationAssignmentsService';
import { useAuth } from '../contexts/AuthContext';

const INTERNAL_ROLES = ['Proximity Admin', 'Proximity Staff', 'Account Manager', 'Technical Consultant', 'Compliance Specialist'];
const CUSTOMER_ROLES = ['Customer Admin', 'Customer Viewer'];
const ALL_ROLES = [...INTERNAL_ROLES, ...CUSTOMER_ROLES];

const ORG_ROLES = [
  { value: 'customer_admin', label: 'Admin' },
  { value: 'customer_user', label: 'User' },
  { value: 'viewer', label: 'Viewer' }
];

export default function Users() {
  const { isAdmin, user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [userOrgAssignments, setUserOrgAssignments] = useState([]);
  const [savingAssignments, setSavingAssignments] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [usersData, orgsData] = await Promise.all([
        usersService.getAll(),
        organizationsService.getAll(),
      ]);
      setUsers(usersData);
      setOrganizations(orgsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadUserAssignments(userId) {
    try {
      const assignments = await organizationAssignmentsService.getAssignmentsForUser(userId);
      setUserOrgAssignments(assignments.map(a => ({
        organization_id: a.organization_id,
        role: a.role,
        is_primary: a.is_primary
      })));
    } catch (error) {
      console.error('Error loading user assignments:', error);
      setUserOrgAssignments([]);
    }
  }

  async function handleSaveUser() {
    try {
      setSavingAssignments(true);

      await usersService.update(editingUser.id, {
        role: editingUser.role,
        display_name: editingUser.display_name,
        organization_id: userOrgAssignments.find(a => a.is_primary)?.organization_id || null,
      });

      const isCustomerRole = CUSTOMER_ROLES.includes(editingUser.role);
      if (isCustomerRole) {
        await organizationAssignmentsService.setUserOrganizations(
          editingUser.user_id,
          userOrgAssignments,
          currentUser?.id
        );
      } else {
        await organizationAssignmentsService.setUserOrganizations(editingUser.user_id, [], currentUser?.id);
      }

      setShowEditModal(false);
      setEditingUser(null);
      setUserOrgAssignments([]);
      loadData();
    } catch (error) {
      console.error('Error updating user:', error);
      alert('Failed to update user');
    } finally {
      setSavingAssignments(false);
    }
  }

  async function handleDeleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      await usersService.delete(userId);
      loadData();
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Failed to delete user');
    }
  }

  async function openEditModal(user) {
    setEditingUser({ ...user });
    await loadUserAssignments(user.user_id);
    setShowEditModal(true);
  }

  function addOrgAssignment() {
    const availableOrgs = organizations.filter(
      org => org.type === 'customer' && !userOrgAssignments.find(a => a.organization_id === org.id)
    );
    if (availableOrgs.length === 0) return;

    const newAssignment = {
      organization_id: availableOrgs[0].id,
      role: 'viewer',
      is_primary: userOrgAssignments.length === 0
    };
    setUserOrgAssignments([...userOrgAssignments, newAssignment]);
  }

  function removeOrgAssignment(orgId) {
    const updated = userOrgAssignments.filter(a => a.organization_id !== orgId);
    if (updated.length > 0 && !updated.some(a => a.is_primary)) {
      updated[0].is_primary = true;
    }
    setUserOrgAssignments(updated);
  }

  function updateOrgAssignment(orgId, field, value) {
    setUserOrgAssignments(prev => prev.map(a => {
      if (a.organization_id === orgId) {
        if (field === 'is_primary' && value) {
          return { ...a, is_primary: true };
        }
        return { ...a, [field]: value };
      }
      if (field === 'is_primary' && value) {
        return { ...a, is_primary: false };
      }
      return a;
    }));
  }

  const getRoleBadge = (role) => {
    const colors = {
      'Proximity Admin': 'bg-red-500/20 text-red-400 border-red-500/30',
      'Proximity Staff': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      'Account Manager': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
      'Technical Consultant': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      'Compliance Specialist': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      'Customer Admin': 'bg-green-500/20 text-green-400 border-green-500/30',
      'Customer Viewer': 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    };
    return colors[role] || 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  };

  const isCustomerRole = editingUser && CUSTOMER_ROLES.includes(editingUser.role);

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <Shield className="w-16 h-16 mx-auto text-slate-700 mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Access Denied</h2>
        <p className="text-slate-400">You need administrator privileges to access this page.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">User Management</h1>
          <p className="text-slate-400">Manage user roles and organization access</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <UsersIcon className="w-5 h-5" />
          <span>{users.length} total users</span>
        </div>
      </div>

      <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-900 border-b border-slate-700">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wider">User</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wider">Role</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wider">Organization(s)</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wider">Joined</th>
              <th className="text-right px-6 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {users.map(user => (
              <tr key={user.id} className="hover:bg-slate-750 transition-colors">
                <td className="px-6 py-4">
                  <div>
                    <p className="text-white font-medium">{user.display_name}</p>
                    <p className="text-slate-400 text-sm">{user.email}</p>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-block px-2 py-1 rounded text-xs font-medium border ${getRoleBadge(user.role)}`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {INTERNAL_ROLES.includes(user.role) ? (
                    <span className="text-slate-500 text-sm">All Organizations</span>
                  ) : user.organization ? (
                    <div className="flex items-center gap-2 text-slate-300">
                      <Building2 className="w-4 h-4 text-slate-500" />
                      <span className="text-sm">{user.organization.name}</span>
                    </div>
                  ) : (
                    <span className="text-slate-500 text-sm">No organization</span>
                  )}
                </td>
                <td className="px-6 py-4 text-slate-400 text-sm">
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => openEditModal(user)}
                      className="p-2 text-slate-400 hover:text-teal-400 hover:bg-slate-700 rounded transition-colors"
                      title="Edit user"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded transition-colors"
                      title="Delete user"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showEditModal && editingUser && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setShowEditModal(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-lg border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="px-6 py-4 border-b border-slate-700 sticky top-0 bg-slate-800 z-10">
                <h2 className="text-xl font-semibold text-white">Edit User</h2>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-2">Display Name</label>
                    <input
                      type="text"
                      value={editingUser.display_name}
                      onChange={(e) => setEditingUser({ ...editingUser, display_name: e.target.value })}
                      className="w-full bg-slate-700 text-white px-4 py-2 rounded border border-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-2">Email (read-only)</label>
                    <input
                      type="text"
                      value={editingUser.email}
                      disabled
                      className="w-full bg-slate-900 text-slate-500 px-4 py-2 rounded border border-slate-600 cursor-not-allowed"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2">Role</label>
                  <select
                    value={editingUser.role}
                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                    className="w-full bg-slate-700 text-white px-4 py-2 rounded border border-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <optgroup label="Internal (Proximity)">
                      {INTERNAL_ROLES.map(role => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Customer">
                      {CUSTOMER_ROLES.map(role => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </optgroup>
                  </select>
                  <p className="text-slate-500 text-xs mt-1">
                    {INTERNAL_ROLES.includes(editingUser.role)
                      ? 'Internal users have access to all organizations'
                      : 'Customer users only see their assigned organizations'}
                  </p>
                </div>

                {isCustomerRole && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-slate-300 text-sm font-medium">Organization Access</label>
                      <button
                        onClick={addOrgAssignment}
                        disabled={userOrgAssignments.length >= organizations.filter(o => o.type === 'customer').length}
                        className="flex items-center gap-1 px-3 py-1 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded text-sm transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Add Organization
                      </button>
                    </div>

                    {userOrgAssignments.length === 0 ? (
                      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-3">
                        <p className="text-yellow-300 text-sm">Customer users must be assigned to at least one organization.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {userOrgAssignments.map((assignment, index) => (
                          <div key={assignment.organization_id} className="flex items-center gap-3 bg-slate-700/50 p-3 rounded-lg">
                            <div className="flex-1">
                              <select
                                value={assignment.organization_id}
                                onChange={(e) => updateOrgAssignment(assignment.organization_id, 'organization_id', e.target.value)}
                                className="w-full bg-slate-700 text-white px-3 py-1.5 rounded border border-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                              >
                                {organizations.filter(org =>
                                  org.type === 'customer' &&
                                  (org.id === assignment.organization_id || !userOrgAssignments.find(a => a.organization_id === org.id))
                                ).map(org => (
                                  <option key={org.id} value={org.id}>{org.name}</option>
                                ))}
                              </select>
                            </div>
                            <div className="w-32">
                              <select
                                value={assignment.role}
                                onChange={(e) => updateOrgAssignment(assignment.organization_id, 'role', e.target.value)}
                                className="w-full bg-slate-700 text-white px-3 py-1.5 rounded border border-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                              >
                                {ORG_ROLES.map(role => (
                                  <option key={role.value} value={role.value}>{role.label}</option>
                                ))}
                              </select>
                            </div>
                            <button
                              onClick={() => updateOrgAssignment(assignment.organization_id, 'is_primary', true)}
                              className={`p-2 rounded transition-colors ${
                                assignment.is_primary
                                  ? 'bg-teal-500/20 text-teal-400'
                                  : 'text-slate-400 hover:text-white hover:bg-slate-600'
                              }`}
                              title={assignment.is_primary ? 'Primary organization' : 'Set as primary'}
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => removeOrgAssignment(assignment.organization_id)}
                              className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-600 rounded transition-colors"
                              title="Remove"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-slate-500 text-xs">
                      The primary organization (checkmark) is the default when the user logs in.
                    </p>
                  </div>
                )}

                {INTERNAL_ROLES.includes(editingUser.role) && (
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded p-3">
                    <p className="text-blue-300 text-sm">Internal users can access all organizations and facilities.</p>
                  </div>
                )}
              </div>
              <div className="px-6 py-4 border-t border-slate-700 flex justify-end gap-3 sticky bottom-0 bg-slate-800">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingUser(null);
                    setUserOrgAssignments([]);
                  }}
                  className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveUser}
                  disabled={savingAssignments || (isCustomerRole && userOrgAssignments.length === 0)}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded font-medium transition-colors flex items-center gap-2"
                >
                  {savingAssignments && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
