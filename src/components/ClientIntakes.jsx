import React, { useEffect, useMemo, useState } from 'react';
import { Check, ClipboardCopy, ExternalLink, FilePlus2, Link2, Loader2, RefreshCw, Send, X } from 'lucide-react';
import { clientIntakeService } from '../services/clientIntakeService';
import { organizationsService } from '../services/organizationsService';
import { projectsService } from '../services/projectsService';

function getShareUrl(token) {
  return `${window.location.origin}${window.location.pathname}#/client-intake/${token}`;
}

function statusClass(status) {
  return status === 'submitted' ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' : status === 'converted' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-slate-700 text-slate-300 border-slate-600';
}

export default function ClientIntakes() {
  const [intakes, setIntakes] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState({ organizationId: '', projectId: '', expiresAt: '' });
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [createdLink, setCreatedLink] = useState('');
  const [copied, setCopied] = useState(false);

  const customerOrganizations = useMemo(() => organizations.filter((organization) => organization.type === 'customer'), [organizations]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!form.organizationId) {
      setProjects([]);
      setForm((current) => ({ ...current, projectId: '' }));
      return;
    }
    projectsService.getAll({ organization_id: form.organizationId }).then(setProjects).catch(() => setProjects([]));
  }, [form.organizationId]);

  async function loadData() {
    setLoading(true);
    try {
      const [intakeData, organizationData] = await Promise.all([clientIntakeService.list(), organizationsService.getAll()]);
      setIntakes(intakeData);
      setOrganizations(organizationData);
    } catch (loadError) {
      console.error('Unable to load client intakes:', loadError);
      setError('Unable to load client intakes.');
    } finally {
      setLoading(false);
    }
  }

  async function createIntake(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const intake = await clientIntakeService.create(form);
      const shareUrl = getShareUrl(intake.access_token);
      setCreatedLink(shareUrl);
      setNotice('A new intake link is ready to share.');
      setShowCreate(false);
      setForm({ organizationId: '', projectId: '', expiresAt: '' });
      await loadData();
    } catch (createError) {
      console.error('Unable to create client intake:', createError);
      setError('Unable to create the intake link.');
    } finally {
      setSaving(false);
    }
  }

  async function copyLink() {
    await navigator.clipboard.writeText(createdLink);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  }

  async function convertIntake(intake) {
    if (!window.confirm('Convert this completed intake into a new facility and contacts?')) return;
    setError('');
    try {
      await clientIntakeService.convert(intake.id);
      setNotice('The facility and contacts were created from this intake.');
      await loadData();
    } catch (convertError) {
      console.error('Unable to convert client intake:', convertError);
      setError('Unable to convert this intake. Confirm it has been submitted and try again.');
    }
  }

  return (
    <div className="min-h-[calc(100vh-7rem)] space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-400">Deployment Tracker</p><h1 className="mt-2 text-3xl font-bold text-white">New Client Intakes</h1><p className="mt-2 max-w-2xl text-slate-400">Create a private share link, let a new client complete the onboarding form over time, and convert the completed intake into a facility record.</p></div><button type="button" onClick={() => { setShowCreate(true); setCreatedLink(''); }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-teal-400"><FilePlus2 className="h-5 w-5" /> Create intake link</button></div>

      {notice && <div className="flex items-center gap-3 rounded-xl border border-teal-500/30 bg-teal-500/10 px-4 py-3 text-sm text-teal-200"><Check className="h-5 w-5" />{notice}</div>}
      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}

      {createdLink && <div className="rounded-2xl border border-teal-500/30 bg-slate-800 p-5"><div className="flex items-start gap-3"><Link2 className="mt-1 h-5 w-5 shrink-0 text-teal-400" /><div className="min-w-0 flex-1"><p className="font-semibold text-white">Share this intake link</p><p className="mt-1 break-all text-sm text-slate-400">{createdLink}</p><div className="mt-4 flex flex-wrap gap-3"><button type="button" onClick={copyLink} className="inline-flex items-center gap-2 rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-teal-400">{copied ? <Check className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />}{copied ? 'Copied' : 'Copy link'}</button><a href={createdLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700"><ExternalLink className="h-4 w-4" /> Open form</a></div></div><button type="button" onClick={() => setCreatedLink('')} className="text-slate-500 hover:text-white"><X className="h-5 w-5" /></button></div></div>}

      <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-800"><div className="flex items-center justify-between border-b border-slate-700 px-5 py-4"><div><h2 className="font-semibold text-white">Active intake links</h2><p className="mt-1 text-sm text-slate-400">Links remain available until submitted, converted, or expired.</p></div><button type="button" onClick={loadData} className="rounded-lg p-2 text-slate-400 hover:bg-slate-700 hover:text-white" title="Refresh"><RefreshCw className="h-4 w-4" /></button></div>{loading ? <div className="flex justify-center p-12"><Loader2 className="h-7 w-7 animate-spin text-teal-400" /></div> : intakes.length === 0 ? <div className="p-12 text-center"><Send className="mx-auto h-10 w-10 text-slate-600" /><p className="mt-3 text-slate-300">No client intakes yet</p><p className="mt-1 text-sm text-slate-500">Create a link when you are ready to begin a new client onboarding.</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[760px]"><thead className="bg-slate-900/60"><tr className="text-left text-xs uppercase tracking-wider text-slate-500"><th className="px-5 py-3">Client / project</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Last updated</th><th className="px-5 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-slate-700">{intakes.map((intake) => <tr key={intake.id} className="text-sm"><td className="px-5 py-4"><p className="font-medium text-white">{intake.organization?.name || 'Unassigned client'}</p><p className="mt-1 text-slate-500">{intake.project?.name || 'No project selected'}</p></td><td className="px-5 py-4"><span className={`rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${statusClass(intake.status)}`}>{intake.status}</span></td><td className="px-5 py-4 text-slate-400">{new Date(intake.updated_at).toLocaleDateString()}</td><td className="px-5 py-4"><div className="flex justify-end gap-2">{intake.status === 'submitted' && <button type="button" onClick={() => convertIntake(intake)} className="inline-flex items-center gap-2 rounded-lg bg-teal-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-teal-400"><Check className="h-4 w-4" /> Create facility</button>}<button type="button" onClick={() => { setCreatedLink(getShareUrl(intake.access_token)); }} className="rounded-lg border border-slate-600 p-2 text-slate-300 hover:bg-slate-700" title="Copy or open link"><Link2 className="h-4 w-4" /></button></div></td></tr>)}</tbody></table></div>}</div>

      {showCreate && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"><div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-800 shadow-2xl"><div className="flex items-center justify-between border-b border-slate-700 px-6 py-5"><div><h2 className="text-xl font-semibold text-white">Create intake link</h2><p className="mt-1 text-sm text-slate-400">Choose where the completed intake will be assigned.</p></div><button type="button" onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-white"><X className="h-5 w-5" /></button></div><form onSubmit={createIntake} className="space-y-5 p-6"><label className="block"><span className="mb-2 block text-sm font-medium text-slate-300">Client organization</span><select value={form.organizationId} onChange={(event) => setForm((current) => ({ ...current, organizationId: event.target.value, projectId: '' }))} required className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-white"><option value="">Select a client</option>{customerOrganizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label><label className="block"><span className="mb-2 block text-sm font-medium text-slate-300">Deployment project</span><select value={form.projectId} onChange={(event) => setForm((current) => ({ ...current, projectId: event.target.value }))} className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-white"><option value="">No project selected</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><label className="block"><span className="mb-2 block text-sm font-medium text-slate-300">Link expiration (optional)</span><input type="date" value={form.expiresAt} onChange={(event) => setForm((current) => ({ ...current, expiresAt: event.target.value ? `${event.target.value}T23:59:59Z` : '' }))} className="w-full rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-white" /></label><div className="flex justify-end gap-3 border-t border-slate-700 pt-5"><button type="button" onClick={() => setShowCreate(false)} className="rounded-xl px-4 py-2 text-slate-300 hover:bg-slate-700">Cancel</button><button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-teal-500 px-5 py-2.5 font-semibold text-slate-950 hover:bg-teal-400 disabled:opacity-50">{saving && <Loader2 className="h-4 w-4 animate-spin" />} Create link</button></div></form></div></div>}
    </div>
  );
}
