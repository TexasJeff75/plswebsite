import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  }

  async function updateUserRole(userId, newRole) {
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', userId);

      if (error) throw error;
      await loadUsers();
    } catch (error) {
      console.error('Error updating user role:', error);
      alert('Failed to update user role');
    }
  }

  const roleColors = {
    'Admin': 'bg-purple-600 text-white',
    'Editor': 'bg-blue-600 text-white',
    'Viewer': 'bg-slate-600 text-slate-300'
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"/>
          <p className="text-slate-400">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">User Management</h1>
        <p className="text-slate-400">Manage user roles and permissions</p>
      </div>

      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-slate-900/50 rounded-lg p-4">
            <h3 className="text-slate-400 text-sm mb-2">Total Users</h3>
            <p className="text-2xl font-bold text-white">{users.length}</p>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-4">
            <h3 className="text-slate-400 text-sm mb-2">Admins</h3>
            <p className="text-2xl font-bold text-purple-400">
              {users.filter(u => u.role === 'Admin').length}
            </p>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-4">
            <h3 className="text-slate-400 text-sm mb-2">Editors</h3>
            <p className="text-2xl font-bold text-blue-400">
              {users.filter(u => u.role === 'Editor').length}
            </p>
          </div>
        </div>

        {users.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-400">No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">User</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">Email</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">Role</th>
                  <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">Joined</th>
                  <th className="text-right py-3 px-4 text-slate-400 font-medium text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id} className="border-b border-slate-800 hover:bg-slate-900/50 transition-colors">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-teal-500 rounded-full flex items-center justify-center">
                          <span className="text-slate-900 font-semibold">
                            {(user.display_name || user.email || 'U')[0].toUpperCase()}
                          </span>
                        </div>
                        <span className="text-white font-medium">
                          {user.display_name || 'User'}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-slate-400">
                      {user.email}
                    </td>
                    <td className="py-4 px-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${roleColors[user.role]}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-slate-400">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <select
                        value={user.role}
                        onChange={(e) => updateUserRole(user.user_id, e.target.value)}
                        className="px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white text-sm"
                      >
                        <option value="Viewer">Viewer</option>
                        <option value="Editor">Editor</option>
                        <option value="Admin">Admin</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h3 className="text-white font-semibold mb-4">Role Permissions</h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-600 text-white">Admin</span>
            <p className="text-slate-400 text-sm">Full access - Can manage users, facilities, and all system features</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-600 text-white">Editor</span>
            <p className="text-slate-400 text-sm">Can create and edit facilities, milestones, equipment, and documents</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-600 text-slate-300">Viewer</span>
            <p className="text-slate-400 text-sm">Read-only access - Can view all data but cannot make changes</p>
          </div>
        </div>
      </div>
    </div>
  );
}
