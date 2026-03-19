import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Save, Mail, Loader, CircleCheck as CheckCircle, CircleAlert as AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export default function CommissionSettingsTab() {
  const [ccEmails, setCcEmails] = useState([]);
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsId, setSettingsId] = useState(null);
  const [status, setStatus] = useState(null);
  const [emailError, setEmailError] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('commission_settings')
      .select('id, cc_emails')
      .maybeSingle();
    if (!error && data) {
      setSettingsId(data.id);
      setCcEmails(data.cc_emails || []);
    }
    setLoading(false);
  }

  async function save(emails) {
    setSaving(true);
    setStatus(null);
    const { error } = await supabase
      .from('commission_settings')
      .update({ cc_emails: emails, updated_at: new Date().toISOString() })
      .eq('id', settingsId);
    setSaving(false);
    if (error) {
      setStatus({ type: 'error', message: error.message });
    } else {
      setStatus({ type: 'success', message: 'Settings saved.' });
      setTimeout(() => setStatus(null), 3000);
    }
  }

  function handleAddEmail() {
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed) return;
    if (!isValidEmail(trimmed)) {
      setEmailError('Please enter a valid email address.');
      return;
    }
    if (ccEmails.includes(trimmed)) {
      setEmailError('This email is already in the list.');
      return;
    }
    setEmailError('');
    const updated = [...ccEmails, trimmed];
    setCcEmails(updated);
    setNewEmail('');
    save(updated);
  }

  function handleRemoveEmail(email) {
    const updated = ccEmails.filter(e => e !== email);
    setCcEmails(updated);
    save(updated);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddEmail();
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-lg bg-teal-500/20 border border-teal-500/30 flex items-center justify-center flex-shrink-0">
            <Mail className="w-4 h-4 text-teal-400" />
          </div>
          <h2 className="text-white font-semibold text-base">CC Email Addresses</h2>
        </div>
        <p className="text-slate-400 text-sm mb-6 ml-11">
          These addresses will be copied on every commission report email that is sent.
        </p>

        {loading ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm py-4">
            <Loader className="w-4 h-4 animate-spin" />
            <span>Loading settings...</span>
          </div>
        ) : (
          <>
            <div className="space-y-2 mb-4">
              {ccEmails.length === 0 ? (
                <p className="text-slate-500 text-sm italic py-2">No CC addresses configured.</p>
              ) : (
                ccEmails.map(email => (
                  <div
                    key={email}
                    className="flex items-center justify-between px-4 py-2.5 bg-slate-700/40 border border-slate-600/60 rounded-lg group"
                  >
                    <div className="flex items-center gap-2.5">
                      <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="text-slate-200 text-sm font-mono">{email}</span>
                    </div>
                    <button
                      onClick={() => handleRemoveEmail(email)}
                      disabled={saving}
                      className="p-1.5 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 disabled:pointer-events-none"
                      title="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <input
                  type="email"
                  value={newEmail}
                  onChange={e => { setNewEmail(e.target.value); setEmailError(''); }}
                  onKeyDown={handleKeyDown}
                  placeholder="name@example.com"
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-teal-500 transition-colors"
                />
                {emailError && (
                  <p className="text-red-400 text-xs mt-1">{emailError}</p>
                )}
              </div>
              <button
                onClick={handleAddEmail}
                disabled={!newEmail.trim() || saving}
                className="flex items-center gap-1.5 px-4 py-2 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors flex-shrink-0"
              >
                {saving ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Add
              </button>
            </div>
          </>
        )}

        {status && (
          <div className={`flex items-center gap-2 mt-4 text-sm px-3 py-2 rounded-lg ${
            status.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
              : 'bg-red-500/10 border border-red-500/20 text-red-400'
          }`}>
            {status.type === 'success'
              ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
              : <AlertCircle className="w-4 h-4 flex-shrink-0" />
            }
            {status.message}
          </div>
        )}
      </div>
    </div>
  );
}
