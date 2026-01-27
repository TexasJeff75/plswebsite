import React, { useState, useEffect } from 'react';
import { Users as UsersIcon, Edit2, Trash2, Shield, Building2 } from 'lucide-react';
import { usersService } from '../services/usersService';
import { organizationsService } from '../services/organizationsService';
import { useAuth } from '../contexts/AuthContext';

export default function Users() {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

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

  async function handleSaveUser() {
    try {
      await usersService.update(editingUser.id, {
        role: editingUser.role,
        user_type: editingUser.user_type,
        organization_id: editingUser.organization_id || null,
        display_name: editingUser.display_name,
      });
      setShowEditModal(false);
      setEditingUser(null);
      loadData();
    } catch (error) {
      console.error('Error updating user:', error);
      alert('Failed to update user');
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

  function openEditModal(user) {
    setEditingUser({ ...user });
    setShowEditModal(true);
  }

  const getUserTypeBadge = (userType) => {
    const colors = {
      admin: 'bg-red-500/20 text-red-400 border-red-500/30',
      staff: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      customer: 'bg-green-500/20 text-green-400 border-green-500/30',
    };
    return colors[userType] || 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  };

  const getRoleBadge = (role) => {
    const colors = {
      Admin: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      Editor: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
      Viewer: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">User Management</h1>
          <p className="text-slate-400">Manage user roles and permissions</p>
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
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wider">Type</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wider">Role</th>
              <th className="text-left px-6 py-3 text-xs font-semibold text-slate-300 uppercase tracking-wider">Organization</th>
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
                  <span className={`inline-block px-2 py-1 rounded text-xs font-medium border ${getUserTypeBadge(user.user_type)}`}>
                    {user.user_type?.charAt(0).toUpperCase() + user.user_type?.slice(1)}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-block px-2 py-1 rounded text-xs font-medium border ${getRoleBadge(user.role)}`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {user.organization ? (
                    <div className="flex items-center gap-2 text-slate-300">
                      <Building2 className="w-4 h-4 text-slate-500" />
                      <span className="text-sm">{user.organization.name}</span>
                    </div>
                  ) : (
                    <span className="text-slate-500 text-sm">All Organizations</span>
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
            <div className="bg-slate-800 rounded-lg border border-slate-700 w-full max-w-lg">
              <div className="px-6 py-4 border-b border-slate-700">
                <h2 className="text-xl font-semibold text-white">Edit User</h2>
              </div>
              <div className="p-6 space-y-4">
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

                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2">User Type</label>
                  <select
                    value={editingUser.user_type}
                    onChange={(e) => setEditingUser({ ...editingUser, user_type: e.target.value })}
                    className="w-full bg-slate-700 text-white px-4 py-2 rounded border border-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="admin">Admin (Full Access)</option>
                    <option value="staff">Staff (Internal User)</option>
                    <option value="customer">Customer (View Only)</option>
                  </select>
                  <p className="text-slate-500 text-xs mt-1">
                    {editingUser.user_type === 'admin' && 'Full system access, can manage users and organizations'}
                    {editingUser.user_type === 'staff' && 'Can view and edit all facilities'}
                    {editingUser.user_type === 'customer' && 'Can only view facilities in their organization'}
                  </p>
                </div>

                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2">Permission Role</label>
                  <select
                    value={editingUser.role}
                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                    className="w-full bg-slate-700 text-white px-4 py-2 rounded border border-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="Admin">Admin</option>
                    <option value="Editor">Editor</option>
                    <option value="Viewer">Viewer</option>
                  </select>
                </div>

                {editingUser.user_type === 'customer' && (
                  <div>
                    <label className="block text-slate-300 text-sm font-medium mb-2">Organization</label>
                    <select
                      value={editingUser.organization_id || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, organization_id: e.target.value || null })}
                      className="w-full bg-slate-700 text-white px-4 py-2 rounded border border-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="">Select Organization</option>
                      {organizations.filter(org => org.type === 'customer').map(org => (
                        <option key={org.id} value={org.id}>{org.name}</option>
                      ))}
                    </select>
                    <p className="text-slate-500 text-xs mt-1">Customer users must be assigned to an organization</p>
                  </div>
                )}

                {editingUser.user_type === 'staff' && (
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded p-3">
                    <p className="text-blue-300 text-sm">Staff users can access all facilities regardless of organization</p>
                  </div>
                )}
              </div>
              <div className="px-6 py-4 border-t border-slate-700 flex justify-end gap-3">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveUser}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded font-medium transition-colors"
                >
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
