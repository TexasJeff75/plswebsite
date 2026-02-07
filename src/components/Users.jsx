import React, { useState, useEffect } from 'react';
import { Users as UsersIcon, Edit2, Trash2, Shield, Building2, Plus, X, Check, Mail, Send, Clock, CheckCircle, XCircle, RefreshCw, Search, ChevronDown, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { usersService } from '../services/usersService';
import { organizationsService } from '../services/organizationsService';
import { organizationAssignmentsService } from '../services/organizationAssignmentsService';
import { invitationService } from '../services/invitationService';
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
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [userOrgAssignments, setUserOrgAssignments] = useState([]);
  const [savingAssignments, setSavingAssignments] = useState(false);
  const [activeTab, setActiveTab] = useState('users');
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [newInvitation, setNewInvitation] = useState({
    email: '',
    role: 'Customer Viewer',
    organization_assignments: []
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [usersData, orgsData, invitationsData] = await Promise.all([
        usersService.getAll(),
        organizationsService.getAll(),
        invitationService.getAll(),
      ]);
      setUsers(usersData);
      setOrganizations(orgsData);
      setInvitations(invitationsData);
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

  async function handleSendInvitation() {
    try {
      if (!newInvitation.email || !newInvitation.role) {
        alert('Please fill in all required fields');
        return;
      }

      setSavingAssignments(true);

      const invitation = await invitationService.create(newInvitation);

      try {
        await invitationService.sendInvitationEmail(invitation);
      } catch (emailError) {
        console.error('Failed to send invitation email:', emailError);
      }

      setShowInviteModal(false);
      setNewInvitation({
        email: '',
        role: 'Customer Viewer',
        organization_assignments: []
      });
      loadData();
      alert('Invitation sent successfully!');
    } catch (error) {
      console.error('Error sending invitation:', error);
      alert(error.message || 'Failed to send invitation');
    } finally {
      setSavingAssignments(false);
    }
  }

  async function handleResendInvitation(invitationId) {
    try {
      const invitation = await invitationService.resend(invitationId);

      try {
        await invitationService.sendInvitationEmail(invitation);
      } catch (emailError) {
        console.error('Failed to send invitation email:', emailError);
      }

      loadData();
      alert('Invitation resent successfully!');
    } catch (error) {
      console.error('Error resending invitation:', error);
      alert(error.message || 'Failed to resend invitation');
    }
  }

  async function handleCancelInvitation(invitationId) {
    if (!confirm('Are you sure you want to cancel this invitation?')) return;

    try {
      await invitationService.cancel(invitationId);
      loadData();
    } catch (error) {
      console.error('Error canceling invitation:', error);
      alert('Failed to cancel invitation');
    }
  }

  function addInviteOrgAssignment() {
    const availableOrgs = organizations.filter(
      org => org.type === 'customer' && !newInvitation.organization_assignments.find(a => a.organization_id === org.id)
    );
    if (availableOrgs.length === 0) return;

    setNewInvitation(prev => ({
      ...prev,
      organization_assignments: [
        ...prev.organization_assignments,
        {
          organization_id: availableOrgs[0].id,
          role: 'viewer'
        }
      ]
    }));
  }

  function removeInviteOrgAssignment(orgId) {
    setNewInvitation(prev => ({
      ...prev,
      organization_assignments: prev.organization_assignments.filter(a => a.organization_id !== orgId)
    }));
  }

  function updateInviteOrgAssignment(orgId, field, value) {
    setNewInvitation(prev => ({
      ...prev,
      organization_assignments: prev.organization_assignments.map(a =>
        a.organization_id === orgId ? { ...a, [field]: value } : a
      )
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

  const filteredUsers = React.useMemo(() => {
    let result = [...users];

    if (userSearch) {
      const term = userSearch.toLowerCase();
      result = result.filter(u =>
        u.display_name?.toLowerCase().includes(term) ||
        u.email?.toLowerCase().includes(term) ||
        u.organization?.name?.toLowerCase().includes(term)
      );
    }

    if (roleFilter !== 'all') {
      result = result.filter(u => u.role === roleFilter);
    }

    if (sortConfig.key) {
      result.sort((a, b) => {
        let aVal, bVal;
        switch (sortConfig.key) {
          case 'name':
            aVal = a.display_name?.toLowerCase() || a.email?.toLowerCase() || '';
            bVal = b.display_name?.toLowerCase() || b.email?.toLowerCase() || '';
            break;
          case 'role':
            aVal = a.role || '';
            bVal = b.role || '';
            break;
          case 'organization':
            aVal = a.organization?.name?.toLowerCase() || '';
            bVal = b.organization?.name?.toLowerCase() || '';
            break;
          case 'joined':
            aVal = a.created_at ? new Date(a.created_at).getTime() : 0;
            bVal = b.created_at ? new Date(b.created_at).getTime() : 0;
            break;
          default:
            return 0;
        }
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [users, userSearch, roleFilter, sortConfig]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />;
    return sortConfig.direction === 'asc'
      ? <ArrowUp className="w-3.5 h-3.5 text-teal-400" />
      : <ArrowDown className="w-3.5 h-3.5 text-teal-400" />;
  };

  const isCustomerRole = editingUser && CUSTOMER_ROLES.includes(editingUser.role);
  const isInviteCustomerRole = CUSTOMER_ROLES.includes(newInvitation.role);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">User Management</h1>
          <p className="text-slate-400">Manage user roles and organization access</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium transition-colors"
          >
            <Mail className="w-4 h-4" />
            Invite User
          </button>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <UsersIcon className="w-5 h-5" />
            <span>{users.length} total users</span>
          </div>
        </div>
      </div>

      <div className="border-b border-slate-700">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-3 font-medium transition-colors border-b-2 ${
              activeTab === 'users'
                ? 'border-teal-500 text-white'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Active Users ({users.length})
          </button>
          <button
            onClick={() => setActiveTab('invitations')}
            className={`px-4 py-3 font-medium transition-colors border-b-2 ${
              activeTab === 'invitations'
                ? 'border-teal-500 text-white'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Pending Invitations ({invitations.filter(i => i.status === 'pending').length})
          </button>
        </div>
      </div>

      {activeTab === 'users' ? (
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-700 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search users..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-400 focus:outline-none focus:border-teal-500"
              />
            </div>
            <div className="relative">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="appearance-none pl-4 pr-10 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-teal-500 cursor-pointer"
              >
                <option value="all">All Roles</option>
                {ALL_ROLES.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
          <table className="w-full">
            <thead className="bg-slate-900 border-b border-slate-700">
              <tr>
                {[
                  { key: 'name', label: 'User' },
                  { key: 'role', label: 'Role' },
                  { key: 'organization', label: 'Organization(s)' },
                  { key: 'joined', label: 'Joined' },
                ].map(col => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className="text-left px-6 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer hover:text-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      {col.label}
                      {getSortIcon(col.key)}
                    </div>
                  </th>
                ))}
                <th className="text-right px-6 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-slate-400">
                    {userSearch || roleFilter !== 'all' ? 'No users match your filters' : 'No users found'}
                  </td>
                </tr>
              ) : filteredUsers.map(user => (
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
      ) : (
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-900 border-b border-slate-700">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wider">Email</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wider">Role</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wider">Status</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wider">Invited By</th>
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wider">Expires</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {invitations.map(invitation => {
                const isExpired = new Date(invitation.expires_at) < new Date();
                const isPending = invitation.status === 'pending' && !isExpired;

                return (
                  <tr key={invitation.id} className="hover:bg-slate-750 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-white font-medium">{invitation.email}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium border ${getRoleBadge(invitation.role)}`}>
                        {invitation.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {invitation.status === 'pending' ? (
                        isExpired ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border bg-slate-500/20 text-slate-400 border-slate-500/30">
                            <XCircle className="w-3 h-3" />
                            Expired
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                            <Clock className="w-3 h-3" />
                            Pending
                          </span>
                        )
                      ) : invitation.status === 'accepted' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border bg-green-500/20 text-green-400 border-green-500/30">
                          <CheckCircle className="w-3 h-3" />
                          Accepted
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border bg-slate-500/20 text-slate-400 border-slate-500/30">
                          <XCircle className="w-3 h-3" />
                          {invitation.status}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-sm">
                      {invitation.invited_by_user?.display_name || invitation.invited_by_user?.email || 'System'}
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-sm">
                      {new Date(invitation.expires_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {isPending && (
                          <button
                            onClick={() => handleResendInvitation(invitation.id)}
                            className="p-2 text-slate-400 hover:text-teal-400 hover:bg-slate-700 rounded transition-colors"
                            title="Resend invitation"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        )}
                        {isPending && (
                          <button
                            onClick={() => handleCancelInvitation(invitation.id)}
                            className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded transition-colors"
                            title="Cancel invitation"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {invitations.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-400">
                    No invitations sent yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

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

      {showInviteModal && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setShowInviteModal(false)} />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-lg border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="px-6 py-4 border-b border-slate-700 sticky top-0 bg-slate-800 z-10">
                <h2 className="text-xl font-semibold text-white">Invite New User</h2>
                <p className="text-slate-400 text-sm mt-1">Send an invitation to join the platform. They will sign in with their Microsoft account.</p>
              </div>
              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2">Email Address *</label>
                  <input
                    type="email"
                    value={newInvitation.email}
                    onChange={(e) => setNewInvitation({ ...newInvitation, email: e.target.value })}
                    placeholder="user@example.com"
                    className="w-full bg-slate-700 text-white px-4 py-2 rounded border border-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <p className="text-slate-500 text-xs mt-1">User will receive an invitation email to sign in with Microsoft</p>
                </div>

                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2">Role *</label>
                  <select
                    value={newInvitation.role}
                    onChange={(e) => setNewInvitation({ ...newInvitation, role: e.target.value })}
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
                    {INTERNAL_ROLES.includes(newInvitation.role)
                      ? 'Internal users have access to all organizations'
                      : 'Customer users only see their assigned organizations'}
                  </p>
                </div>

                {isInviteCustomerRole && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-slate-300 text-sm font-medium">Organization Access</label>
                      <button
                        onClick={addInviteOrgAssignment}
                        disabled={newInvitation.organization_assignments.length >= organizations.filter(o => o.type === 'customer').length}
                        className="flex items-center gap-1 px-3 py-1 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded text-sm transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Add Organization
                      </button>
                    </div>

                    {newInvitation.organization_assignments.length === 0 ? (
                      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-3">
                        <p className="text-yellow-300 text-sm">Customer users must be assigned to at least one organization.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {newInvitation.organization_assignments.map((assignment) => (
                          <div key={assignment.organization_id} className="flex items-center gap-3 bg-slate-700/50 p-3 rounded-lg">
                            <div className="flex-1">
                              <select
                                value={assignment.organization_id}
                                onChange={(e) => updateInviteOrgAssignment(assignment.organization_id, 'organization_id', e.target.value)}
                                className="w-full bg-slate-700 text-white px-3 py-1.5 rounded border border-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                              >
                                {organizations.filter(org =>
                                  org.type === 'customer' &&
                                  (org.id === assignment.organization_id || !newInvitation.organization_assignments.find(a => a.organization_id === org.id))
                                ).map(org => (
                                  <option key={org.id} value={org.id}>{org.name}</option>
                                ))}
                              </select>
                            </div>
                            <div className="w-32">
                              <select
                                value={assignment.role}
                                onChange={(e) => updateInviteOrgAssignment(assignment.organization_id, 'role', e.target.value)}
                                className="w-full bg-slate-700 text-white px-3 py-1.5 rounded border border-slate-600 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                              >
                                {ORG_ROLES.map(role => (
                                  <option key={role.value} value={role.value}>{role.label}</option>
                                ))}
                              </select>
                            </div>
                            <button
                              onClick={() => removeInviteOrgAssignment(assignment.organization_id)}
                              className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-600 rounded transition-colors"
                              title="Remove"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {INTERNAL_ROLES.includes(newInvitation.role) && (
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded p-3">
                    <p className="text-blue-300 text-sm">Internal users can access all organizations and facilities.</p>
                  </div>
                )}

                <div className="bg-slate-700/50 border border-slate-600 rounded p-4">
                  <h3 className="text-white font-medium mb-2 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-teal-400" />
                    What happens next?
                  </h3>
                  <ul className="space-y-2 text-slate-300 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="text-teal-400 mt-0.5">1.</span>
                      <span>An invitation email will be sent to <strong>{newInvitation.email || '(email)'}</strong></span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-teal-400 mt-0.5">2.</span>
                      <span>They click the link and sign in with their Microsoft account</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-teal-400 mt-0.5">3.</span>
                      <span>Their permissions are automatically configured as <strong>{newInvitation.role}</strong></span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-teal-400 mt-0.5">4.</span>
                      <span>Invitation expires in 7 days</span>
                    </li>
                  </ul>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-slate-700 flex justify-end gap-3 sticky bottom-0 bg-slate-800">
                <button
                  onClick={() => {
                    setShowInviteModal(false);
                    setNewInvitation({
                      email: '',
                      role: 'Customer Viewer',
                      organization_assignments: []
                    });
                  }}
                  className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendInvitation}
                  disabled={savingAssignments || !newInvitation.email || (isInviteCustomerRole && newInvitation.organization_assignments.length === 0)}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded font-medium transition-colors flex items-center gap-2"
                >
                  {savingAssignments ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send Invitation
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
