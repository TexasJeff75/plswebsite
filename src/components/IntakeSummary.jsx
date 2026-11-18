import React from 'react';

// Read-only view of a client intake (onboarding form) as the client submitted it.

function joinAddress(section = {}) {
  const line1 = [section.street_address, section.suite].filter(Boolean).join(', ');
  const line2 = [section.city, section.state].filter(Boolean).join(', ') + (section.zip ? ` ${section.zip}` : '');
  return [line1, line2.trim()].filter(Boolean).join('\n');
}

function personName(p = {}) {
  return [p.first_name, p.last_name].filter(Boolean).join(' ') + (p.credentials ? `, ${p.credentials}` : '');
}

function hasPerson(p = {}) {
  return Object.values(p).some((v) => String(v || '').trim());
}

function Item({ label, value }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="mt-1 whitespace-pre-line text-sm text-white">{value || <span className="text-slate-600">Not provided</span>}</dd>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900/40 p-4">
      <h4 className="mb-3 text-sm font-semibold text-teal-300">{title}</h4>
      {children}
    </section>
  );
}

export default function IntakeSummary({ payload }) {
  const p = payload || {};
  const clinic = p.clinic || {};
  const corporate = p.corporate || {};
  const services = Array.isArray(p.services) ? p.services : [];
  const averages = Object.entries(p.testing_averages || {}).filter(([, v]) => String(v || '').trim());
  const providers = (p.providers || []).filter(hasPerson);
  const staff = (p.office_staff || []).filter(hasPerson);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="Clinic / lab">
        <dl className="grid gap-3 sm:grid-cols-2">
          <Item label="Name" value={clinic.name} />
          <Item label="Address" value={joinAddress(clinic)} />
          <Item label="Phone" value={clinic.phone} />
          <Item label="Fax" value={clinic.fax} />
        </dl>
      </Section>
      <Section title="Corporate">
        <dl className="grid gap-3 sm:grid-cols-2">
          <Item label="Corporation name" value={corporate.name} />
          <Item label="EIN" value={corporate.ein} />
          <Item label="Address" value={joinAddress(corporate)} />
          <Item label="Email" value={corporate.email} />
          <Item label="Phone" value={corporate.phone} />
        </dl>
      </Section>
      <Section title="Requested services">
        {services.length ? (
          <ul className="flex flex-wrap gap-2">
            {services.map((s) => <li key={s} className="rounded-full bg-teal-500/10 px-3 py-1 text-xs text-teal-200">{s}</li>)}
          </ul>
        ) : <p className="text-sm text-slate-600">None selected</p>}
      </Section>
      <Section title="Estimated monthly tests">
        {averages.length ? (
          <dl className="grid gap-3 sm:grid-cols-2">
            {averages.map(([label, v]) => <Item key={label} label={label} value={String(v)} />)}
          </dl>
        ) : <p className="text-sm text-slate-600">Not provided</p>}
      </Section>
      <Section title="Providers">
        {providers.length ? (
          <ul className="space-y-3">
            {providers.map((pr, i) => (
              <li key={i} className="text-sm text-white">
                <p className="font-medium">{personName(pr) || 'Unnamed provider'}</p>
                <p className="text-slate-400">{[pr.npi && `NPI ${pr.npi}`, pr.phone, pr.email].filter(Boolean).join(' · ')}</p>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-slate-600">None listed</p>}
      </Section>
      <Section title="Office staff">
        {staff.length ? (
          <ul className="space-y-3">
            {staff.map((s, i) => (
              <li key={i} className="text-sm text-white">
                <p className="font-medium">{personName(s) || 'Unnamed staff member'}</p>
                <p className="text-slate-400">{[s.phone, s.email].filter(Boolean).join(' · ')}</p>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-slate-600">None listed</p>}
      </Section>
    </div>
  );
}

// Organization fields suggested from an intake's corporate section (falls back to the clinic).
export function organizationFieldsFromIntake(payload) {
  const corporate = payload?.corporate || {};
  const clinic = payload?.clinic || {};
  const pick = (k) => (String(corporate[k] || '').trim() ? corporate[k] : clinic[k]) || '';
  const street = [pick('street_address'), pick('suite')].filter(Boolean).join(', ');
  return {
    address: street,
    city: pick('city'),
    state: pick('state'),
    zip: pick('zip'),
    contact_phone: pick('phone'),
    primary_contact_email: corporate.email || '',
  };
}
