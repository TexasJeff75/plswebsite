import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Loader2, Save, ShieldCheck } from 'lucide-react';
import { clientIntakeService } from '../services/clientIntakeService';

const SERVICES = {
  'Toxicology': ['Urine Drug Screening (LC-MS/MS)', 'Urine Drug Confirmation (LC-MS/MS)', 'Oral Fluid (Saliva) Toxicology'],
  'Molecular / PCR': ['UTI (Urinary Tract)', 'STI (Sexually Transmitted)', 'RPP (Respiratory Pathogen)', 'Vaginitis', 'HPV', 'Wound', 'Gastrointestinal', 'Nail Fungal'],
  'Blood': ['Routine Blood — Chemistry', 'Routine Blood — Hematology', 'Routine Blood — Immunoassay'],
  'Pharmacogenomics & Allergy': ['Pharmacogenomics (PGx)', 'Alex3 Allergy Testing'],
};

const TESTING_AVERAGES = ['Urine toxicology', 'Oral fluid (saliva) toxicology', 'Molecular / PCR', 'Blood draws (SST / EDTA)', 'Alex3 allergy testing', 'PGx (buccal swab)'];

const emptyPerson = { first_name: '', last_name: '', credentials: '', gender: '', npi: '', phone: '', email: '' };
const emptyStaff = { first_name: '', last_name: '', gender: '', phone: '', email: '' };

function createInitialPayload() {
  return {
    corporate: { name: '', street_address: '', suite: '', city: '', state: '', zip: '', email: '', phone: '' },
    clinic: { name: '', street_address: '', suite: '', city: '', state: '', zip: '', phone: '', fax: '' },
    services: [],
    testing_averages: Object.fromEntries(TESTING_AVERAGES.map(label => [label, ''])),
    providers: [1, 2, 3].map(() => ({ ...emptyPerson })),
    office_staff: [1, 2, 3, 4].map(() => ({ ...emptyStaff })),
  };
}

function Field({ label, value, onChange, type = 'text', placeholder = '', required = false }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}{required && ' *'}</span>
      <input
        type={type}
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
      />
    </label>
  );
}

function SectionTitle({ eyebrow, title, description }) {
  return (
    <div className="mb-6 border-b border-slate-200 pb-4">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-600">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{title}</h2>
      {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>}
    </div>
  );
}

function PersonCard({ person, index, type, onChange }) {
  const isProvider = type === 'provider';
  const update = (field, value) => onChange(index, { ...person, [field]: value });
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">{isProvider ? `Provider ${index + 1}` : `Staff Member ${index + 1}`}</h3>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-400">Optional</span>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="First Name" value={person.first_name} onChange={(value) => update('first_name', value)} />
        <Field label="Last Name" value={person.last_name} onChange={(value) => update('last_name', value)} />
        {isProvider && <Field label="Suffix / Credentials" value={person.credentials} onChange={(value) => update('credentials', value)} placeholder="MD, DO, NP" />}
        {isProvider && <Field label="NPI" value={person.npi} onChange={(value) => update('npi', value)} />}
        <Field label="Gender" value={person.gender} onChange={(value) => update('gender', value)} />
        <Field label="Contact Phone" value={person.phone} onChange={(value) => update('phone', value)} type="tel" />
        <Field label="Contact Email" value={person.email} onChange={(value) => update('email', value)} type="email" />
      </div>
    </div>
  );
}

export default function PublicClientIntake({ accessToken }) {
  const [payload, setPayload] = useState(createInitialPayload);
  const [status, setStatus] = useState('loading');
  const [intakeStatus, setIntakeStatus] = useState('draft');
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const steps = useMemo(() => ['Clinic details', 'Requested services', 'Testing averages', 'Providers', 'Office staff'], []);

  useEffect(() => {
    let mounted = true;
    clientIntakeService.getPublic(accessToken)
      .then((data) => {
        if (!mounted) return;
        setPayload({ ...createInitialPayload(), ...(data.payload || {}) });
        setIntakeStatus(data.status || 'draft');
        setStatus(data.status === 'submitted' ? 'submitted' : 'ready');
      })
      .catch(() => {
        if (mounted) {
          setStatus('error');
          setError('This intake link is unavailable or has expired. Please ask your Proximity contact for a new link.');
        }
      });
    return () => { mounted = false; };
  }, [accessToken]);

  const save = useCallback(async (submit = false) => {
    setSaving(true);
    setError('');
    try {
      const result = await clientIntakeService.savePublic(accessToken, payload, submit);
      setIntakeStatus(result.status);
      setDirty(false);
      setNotice(submit ? 'Your intake has been submitted.' : 'Progress saved. You can return to this link anytime.');
      if (submit) setStatus('submitted');
      window.setTimeout(() => setNotice(''), 4500);
    } catch (saveError) {
      console.error('Unable to save client intake:', saveError);
      setError('We could not save your progress. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [accessToken, payload]);

  useEffect(() => {
    if (!dirty || status !== 'ready' || intakeStatus === 'submitted') return undefined;
    const timer = window.setTimeout(() => save(false), 20000);
    return () => window.clearTimeout(timer);
  }, [dirty, intakeStatus, save, status]);

  function updateSection(section, value) {
    setPayload((current) => ({ ...current, [section]: value }));
    setDirty(true);
  }

  function updateNested(section, field, value) {
    updateSection(section, { ...payload[section], [field]: value });
  }

  function toggleService(service) {
    const next = payload.services.includes(service)
      ? payload.services.filter((item) => item !== service)
      : [...payload.services, service];
    updateSection('services', next);
  }

  function updatePerson(section, index, person) {
    const next = [...payload[section]];
    next[index] = person;
    updateSection(section, next);
  }

  function canSubmit() {
    return Boolean(payload.clinic.name && payload.clinic.street_address && payload.clinic.city && payload.clinic.state && payload.clinic.zip);
  }

  if (status === 'loading') {
    return <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white"><Loader2 className="h-8 w-8 animate-spin text-teal-400" /></div>;
  }

  if (status === 'error') {
    return <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6"><div className="max-w-lg rounded-3xl bg-white p-8 text-center"><ClipboardList className="mx-auto h-12 w-12 text-teal-600" /><h1 className="mt-5 text-2xl font-bold text-slate-900">Intake link unavailable</h1><p className="mt-3 text-slate-500">{error}</p></div></div>;
  }

  if (status === 'submitted') {
    return <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6"><div className="max-w-xl rounded-3xl bg-white p-10 text-center shadow-2xl"><CheckCircle2 className="mx-auto h-16 w-16 text-teal-600" /><p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-teal-600">Thank you</p><h1 className="mt-3 text-3xl font-bold text-slate-900">Your clinic intake is complete</h1><p className="mt-4 leading-7 text-slate-500">Your information has been securely sent to the Proximity team. Please keep this link if the team asks you to review anything.</p></div></div>;
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-800 bg-slate-950 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3"><div className="rounded-xl bg-teal-500/15 p-2"><ClipboardList className="h-6 w-6 text-teal-400" /></div><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-400">HealthSpan360 Reference Testing</p><h1 className="mt-1 text-lg font-semibold">New Clinic Onboarding</h1></div></div>
          <div className="hidden items-center gap-2 text-sm text-slate-400 sm:flex"><ShieldCheck className="h-4 w-4 text-teal-400" /> Secure progress saving</div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
        <div className="mb-8 rounded-3xl bg-white p-6 shadow-sm sm:p-8"><div className="max-w-3xl"><p className="text-sm font-semibold text-teal-600">New Client Intake</p><h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Let’s prepare your clinic for launch.</h2><p className="mt-4 leading-7 text-slate-500">Complete this form in one sitting or save your progress and return whenever convenient. Fields marked with an asterisk are required to create the clinic record.</p></div></div>

        <div className="mb-6 overflow-x-auto rounded-2xl bg-white p-3 shadow-sm"><div className="flex min-w-[680px] items-center gap-2">{steps.map((label, index) => <button key={label} type="button" onClick={() => setStep(index)} className={`flex flex-1 items-center gap-3 rounded-xl px-3 py-3 text-left transition ${step === index ? 'bg-teal-50 text-teal-800' : 'text-slate-400 hover:bg-slate-50'}`}><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${step === index ? 'bg-teal-600 text-white' : index < step ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-500'}`}>{index + 1}</span><span className="text-sm font-semibold">{label}</span></button>)}</div></div>

        {notice && <div className="mb-6 flex items-center gap-3 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-800"><CheckCircle2 className="h-5 w-5" />{notice}</div>}
        {error && <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        <section className="rounded-3xl bg-white p-6 shadow-sm sm:p-10">
          {step === 0 && <><SectionTitle eyebrow="Step 1 of 5" title="Clinic and corporate information" description="Tell us where testing will be performed and how we should reach your organization." /><div className="space-y-8"><div><h3 className="mb-4 text-lg font-semibold text-slate-900">Clinic / Lab Information</h3><div className="grid gap-4 md:grid-cols-2"><Field label="Clinic / Lab Name" required value={payload.clinic.name} onChange={(value) => updateNested('clinic', 'name', value)} /><Field label="Street Address" required value={payload.clinic.street_address} onChange={(value) => updateNested('clinic', 'street_address', value)} /><Field label="Suite / Unit No." value={payload.clinic.suite} onChange={(value) => updateNested('clinic', 'suite', value)} /><Field label="City" required value={payload.clinic.city} onChange={(value) => updateNested('clinic', 'city', value)} /><Field label="State" required value={payload.clinic.state} onChange={(value) => updateNested('clinic', 'state', value)} /><Field label="ZIP Code" required value={payload.clinic.zip} onChange={(value) => updateNested('clinic', 'zip', value)} /><Field label="Office Phone" value={payload.clinic.phone} onChange={(value) => updateNested('clinic', 'phone', value)} type="tel" /><Field label="Fax" value={payload.clinic.fax} onChange={(value) => updateNested('clinic', 'fax', value)} type="tel" /></div></div><div className="border-t border-slate-200 pt-8"><h3 className="mb-4 text-lg font-semibold text-slate-900">Corporate Information</h3><div className="grid gap-4 md:grid-cols-2"><Field label="Corporation Name" value={payload.corporate.name} onChange={(value) => updateNested('corporate', 'name', value)} /><Field label="Street Address" value={payload.corporate.street_address} onChange={(value) => updateNested('corporate', 'street_address', value)} /><Field label="Suite / Unit No." value={payload.corporate.suite} onChange={(value) => updateNested('corporate', 'suite', value)} /><Field label="City" value={payload.corporate.city} onChange={(value) => updateNested('corporate', 'city', value)} /><Field label="State" value={payload.corporate.state} onChange={(value) => updateNested('corporate', 'state', value)} /><Field label="ZIP Code" value={payload.corporate.zip} onChange={(value) => updateNested('corporate', 'zip', value)} /><Field label="Contact Email" value={payload.corporate.email} onChange={(value) => updateNested('corporate', 'email', value)} type="email" /><Field label="Contact Phone" value={payload.corporate.phone} onChange={(value) => updateNested('corporate', 'phone', value)} type="tel" /></div></div></div></>}

          {step === 1 && <><SectionTitle eyebrow="Step 2 of 5" title="Requested laboratory services" description="Select every capability your clinic anticipates ordering. You can update these selections before submitting." /><div className="space-y-8">{Object.entries(SERVICES).map(([group, services]) => <div key={group}><h3 className="mb-3 text-sm font-bold uppercase tracking-[0.15em] text-teal-700">{group}</h3><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{services.map(service => <label key={service} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${payload.services.includes(service) ? 'border-teal-400 bg-teal-50' : 'border-slate-200 hover:border-teal-200'}`}><input type="checkbox" checked={payload.services.includes(service)} onChange={() => toggleService(service)} className="mt-1 h-4 w-4 accent-teal-600" /><span className="text-sm leading-5 text-slate-700">{service}</span></label>)}</div></div>)}</div></>}

          {step === 2 && <><SectionTitle eyebrow="Step 3 of 5" title="Estimated monthly testing volume" description="Approximate monthly volume helps us recommend the right implementation plan." /><div className="grid gap-4 md:grid-cols-2">{TESTING_AVERAGES.map(label => <Field key={label} label={label} value={payload.testing_averages[label]} onChange={(value) => updateSection('testing_averages', { ...payload.testing_averages, [label]: value })} type="number" placeholder="Monthly tests" />)}</div></>}

          {step === 3 && <><SectionTitle eyebrow="Step 4 of 5" title="Provider information" description="List providers who will be associated with the clinic. Add as much detail as you have available." /><div className="space-y-4">{payload.providers.map((person, index) => <PersonCard key={index} person={person} index={index} type="provider" onChange={(personIndex, value) => updatePerson('providers', personIndex, value)} />)}</div></>}

          {step === 4 && <><SectionTitle eyebrow="Step 5 of 5" title="Office staff information" description="List staff members who may need access to the laboratory system or onboarding communications." /><div className="space-y-4">{payload.office_staff.map((person, index) => <PersonCard key={index} person={person} index={index} type="staff" onChange={(personIndex, value) => updatePerson('office_staff', personIndex, value)} />)}</div></>}

          <div className="mt-10 flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between"><button type="button" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0} className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:invisible"><ChevronLeft className="h-4 w-4" /> Previous</button><div className="flex flex-col gap-3 sm:flex-row"><button type="button" onClick={() => save(false)} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-teal-300 hover:text-teal-700 disabled:opacity-50"><Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save progress'}</button>{step < steps.length - 1 ? <button type="button" onClick={() => setStep((current) => Math.min(steps.length - 1, current + 1))} className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-teal-600/20 transition hover:bg-teal-700">Continue <ChevronRight className="h-4 w-4" /></button> : <button type="button" onClick={() => canSubmit() ? save(true) : setError('Please complete the required clinic name and address fields before submitting.')} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50">Submit intake <ChevronRight className="h-4 w-4" /></button>}</div></div>
        </section>
        <p className="mt-6 text-center text-xs text-slate-400">Your progress is associated with this private link. Anyone with the link can view and edit the intake until it is submitted.</p>
      </main>
    </div>
  );
}
