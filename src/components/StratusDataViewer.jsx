import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  searchLabOrders, countLabOrders, getLabOrderById, assignOrderAndResults, LAB_STATUSES,
  bulkAssignByAccession,
  getOrderPanels, getOrderTests, getOrderDiagnosisCodes, getOrderMedications, getOrderInsurance,
  getResultObservations, getOrderResultObservations,
} from '../services/labDataService';
import { stratusMappingService } from '../services/stratusMappingService';
import { organizationsService } from '../services/organizationsService';
import { facilitiesService } from '../services/facilitiesService';
import {
  FlaskConical, Search, Building2, MapPin, X, Save, Link2, Plus,
  ChevronDown, ChevronRight, AlertTriangle, CheckCircle2,
  Loader2, Filter, RefreshCw, ArrowRightCircle,
} from 'lucide-react';
import { format } from 'date-fns';

function extractStratusInfo(record, type) {
  if (type === 'orders') {
    const od = record.order_data || {};
    return {
      facilityName: record.location_name || od.location_name || od.facility_name || od.facility?.name || '',
      orgName: record.organization_name || od.organization_name || od.organization?.name || '',
      accessionId: record.accession_id || record.accession_number || '',
      stratusGuid: record.stratus_guid || '',
    };
  }
  if (type === 'results') {
    const rd = record.result_data || {};
    return {
      facilityName: rd.locationName || rd.location_name || rd.facility_name || rd.facility?.name || '',
      orgName: rd.organizationName || rd.organization_name || rd.organization?.name || '',
      accessionId: record.accession_id || record.accession_number || '',
      stratusGuid: record.stratus_guid || '',
    };
  }
  return { facilityName: '', orgName: '', accessionId: record.accession_number || '', stratusGuid: record.stratus_guid || '' };
}

const PAGE_SIZE = 50;

const LAB_STATUS_STYLES = {
  Pending: 'bg-slate-500/10 text-slate-300 border-slate-500/30',
  'Pending Received': 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  Final: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  Canceled: 'bg-red-500/10 text-red-300 border-red-500/30',
  Rejected: 'bg-red-500/10 text-red-300 border-red-500/30',
};

function LabStatusBadge({ status }) {
  if (!status) return <span className="text-slate-500 text-sm">--</span>;
  const cls = LAB_STATUS_STYLES[status] || 'bg-slate-700 text-slate-300 border-slate-600';
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border whitespace-nowrap ${cls}`}>{status}</span>;
}

// StratusDX clinical times are "yyyyMMddHHmmss" in US Central time.
export function formatCompact(value, withTime = true) {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(String(value || '').trim());
  if (!m) return value || null;
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  return format(d, withTime ? 'MMM d, yyyy h:mm a' : 'MMM d, yyyy');
}

const DATE_PRESETS = [
  { key: '7', label: 'Last 7 days', days: 7 },
  { key: '30', label: 'Last 30 days', days: 30 },
  { key: '90', label: 'Last 90 days', days: 90 },
  { key: 'year', label: 'This year' },
  { key: 'all', label: 'All dates' },
  { key: 'custom', label: 'Custom' },
];

function presetRange(key) {
  const today = new Date();
  const iso = (d) => format(d, 'yyyy-MM-dd');
  if (key === 'all' || key === 'custom') return { from: '', to: '' };
  if (key === 'year') return { from: `${today.getFullYear()}-01-01`, to: iso(today) };
  const days = DATE_PRESETS.find((p) => p.key === key)?.days || 30;
  const from = new Date(today);
  from.setDate(from.getDate() - (days - 1));
  return { from: iso(from), to: iso(today) };
}

export default function StratusDataViewer() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState(null);
  const [page, setPage] = useState(0);
  const [status, setStatus] = useState('');
  const [preset, setPreset] = useState('30');
  const [dateField, setDateField] = useState('ordered');
  const [range, setRange] = useState(presetRange('30'));
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [unmappedOnly, setUnmappedOnly] = useState(false);
  const [organizations, setOrganizations] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [assignModal, setAssignModal] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);
  const [assigning, setAssigning] = useState(false);

  // Search runs a moment after typing stops.
  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => clearTimeout(id);
  }, [searchInput]);

  const filters = useMemo(
    () => ({ search, dateField, from: range.from, to: range.to, unmappedOnly }),
    [search, dateField, range, unmappedOnly],
  );

  // Back to the first page whenever the filters change.
  useEffect(() => { setPage(0); }, [filters, status]);

  useEffect(() => {
    organizationsService.getAll().then((o) => setOrganizations(o || [])).catch(() => {});
    stratusMappingService.getMappings().then((m) => setMappings(m || [])).catch(() => {});
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [list, c] = await Promise.all([
        searchLabOrders({ filters, status: status || null, page, pageSize: PAGE_SIZE }),
        countLabOrders(filters),
      ]);
      setRows(list.rows);
      setTotal(list.total);
      setCounts(c);
    } catch (err) {
      console.error('Error loading Stratus data:', err);
      setActionMessage({ type: 'error', text: 'Failed to load data: ' + err.message });
    } finally {
      setLoading(false);
    }
  }, [filters, status, page]);

  useEffect(() => { loadData(); }, [loadData]);

  const mappedIdentifiers = useMemo(() => {
    const set = new Set();
    mappings.forEach((m) => { if (m.is_active) set.add(m.stratus_facility_identifier.toLowerCase()); });
    return set;
  }, [mappings]);

  function choosePreset(key) {
    setPreset(key);
    if (key !== 'custom') setRange(presetRange(key));
  }

  function openAssignModal(record) {
    const info = extractStratusInfo(record, 'orders');
    setAssignModal({
      record, type: 'orders', info,
      organizationId: record.organization_id || '',
      facilityId: record.facility_id || '',
      createMapping: true,
      mappingType: 'exact',
      createOrganization: false,
      newOrganizationName: info.orgName || '',
    });
  }

  function showMessage(type, text) {
    setActionMessage({ type, text });
    setTimeout(() => setActionMessage(null), 4000);
  }

  async function resolveOrganization(name) {
    const normalizedName = name.trim().toLowerCase();
    const existing = organizations.find((organization) => organization.name?.trim().toLowerCase() === normalizedName);
    if (existing) return existing;
    return organizationsService.create({ name: name.trim(), type: 'customer' });
  }

  async function resolveFacility(name, organizationId) {
    const facilities = await facilitiesService.getAll({ organization_id: organizationId });
    const normalizedName = name.trim().toLowerCase();
    const existing = facilities.find((facility) => facility.name?.trim().toLowerCase() === normalizedName);
    if (existing) return existing;
    return facilitiesService.create({ name: name.trim(), organization_id: organizationId, status: 'Active' });
  }

  async function createMappingFor(info, organizationId, facilityId, mappingType, note) {
    if (!info.facilityName) return '';
    try {
      await stratusMappingService.createMapping({
        organization_id: organizationId,
        facility_id: facilityId || null,
        stratus_facility_identifier: info.facilityName,
        stratus_organization_identifier: info.orgName || null,
        mapping_type: mappingType,
        is_active: true,
        notes: note,
      });
      return ` and mapping created for "${info.facilityName}"`;
    } catch {
      return '. Mapping already exists';
    }
  }

  async function resolveTarget(modal) {
    let organizationId = modal.organizationId;
    let facilityId = modal.facilityId;
    if (modal.createOrganization) {
      const organizationName = modal.newOrganizationName?.trim();
      if (!organizationName) throw new Error('Enter an organization name');
      const organization = await resolveOrganization(organizationName);
      organizationId = organization.id;
      if (modal.info.facilityName) facilityId = (await resolveFacility(modal.info.facilityName, organizationId)).id;
    }
    if (!organizationId || organizationId === '__new__') throw new Error('Please select an organization');
    return { organizationId, facilityId };
  }

  async function handleAssign() {
    if (assigning || !assignModal) return;
    setAssigning(true);
    try {
      const { organizationId, facilityId } = await resolveTarget(assignModal);
      await assignOrderAndResults(assignModal.record.id, organizationId, facilityId || null);
      const extra = assignModal.createMapping
        ? await createMappingFor(assignModal.info, organizationId, facilityId, assignModal.mappingType, 'Auto-created from Stratus Data Viewer')
        : '';
      showMessage('success', `Order assigned${extra}`);
      setAssignModal(null);
      loadData();
    } catch (err) {
      showMessage('error', 'Failed to assign: ' + err.message);
    } finally {
      setAssigning(false);
    }
  }

  async function handleBulkAssign(accessionId, info) {
    if (!assignModal || assigning) return;
    setAssigning(true);
    try {
      const { organizationId, facilityId } = await resolveTarget(assignModal);
      const c = await bulkAssignByAccession(accessionId, organizationId, facilityId || null);
      const extra = assignModal.createMapping
        ? await createMappingFor(info, organizationId, facilityId, assignModal.mappingType, 'Auto-created from Stratus Data Viewer (bulk by accession)')
        : '';
      showMessage('success', `Assigned ${c.orders} orders and ${c.results} results${extra}`);
      setAssignModal(null);
      loadData();
    } catch (err) {
      showMessage('error', 'Bulk assign failed: ' + err.message);
    } finally {
      setAssigning(false);
    }
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const statusChips = [
    { key: '', label: 'All', count: counts?.total },
    ...LAB_STATUSES
      .filter((s) => ['Pending', 'Pending Received', 'Final'].includes(s) || (counts?.byStatus?.[s] || 0) > 0)
      .map((s) => ({ key: s, label: s, count: counts?.byStatus?.[s] })),
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-white mb-1">StratusDX Data Viewer</h3>
          <p className="text-slate-400 text-sm">Lab orders and their results from StratusDX. Expand an order to see its tests and results.</p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 border border-slate-700 text-slate-400 hover:text-white rounded-lg text-sm font-medium transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {actionMessage && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg border text-sm ${
          actionMessage.type === 'error'
            ? 'bg-red-500/10 border-red-500/30 text-red-400'
            : 'bg-green-500/10 border-green-500/30 text-green-400'
        }`}>
          {actionMessage.type === 'error' ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          {actionMessage.text}
        </div>
      )}

      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {statusChips.map((c) => (
            <button
              key={c.key || 'all'}
              onClick={() => setStatus(c.key)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                status === c.key ? 'bg-teal-500/10 text-teal-300 border-teal-500/40' : 'text-slate-400 border-slate-700 hover:text-white'
              }`}
            >
              {c.label}
              <span className="text-xs tabular-nums px-1.5 py-0.5 rounded bg-slate-700/70">{c.count ?? '·'}</span>
            </button>
          ))}
          <button
            onClick={() => setUnmappedOnly(!unmappedOnly)}
            className={`ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              unmappedOnly ? 'bg-yellow-500/10 text-yellow-300 border-yellow-500/40' : 'text-slate-400 border-slate-700 hover:text-white'
            }`}
          >
            <Filter className="w-4 h-4" />
            Unmapped only
            <span className="text-xs tabular-nums px-1.5 py-0.5 rounded bg-slate-700/70">{counts?.unmapped ?? '·'}</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search accession, patient, facility or organization"
              className="w-full bg-slate-900/50 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white text-sm focus:outline-none focus:border-teal-500"
            />
          </div>
          <select
            value={dateField}
            onChange={(e) => setDateField(e.target.value)}
            aria-label="Date to filter on"
            className="bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
          >
            <option value="ordered">Ordered</option>
            <option value="received">Received</option>
            <option value="finalized">Finalized</option>
          </select>
          <select
            value={preset}
            onChange={(e) => choosePreset(e.target.value)}
            aria-label="Date range"
            className="bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
          >
            {DATE_PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          {preset === 'custom' && (
            <>
              <input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })}
                aria-label="From" className="bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" />
              <span className="text-slate-500 text-sm">to</span>
              <input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })}
                aria-label="To" className="bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm" />
            </>
          )}
        </div>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-900/50 border-b border-slate-700">
              <tr>
                <th className="px-3 py-3 w-8"></th>
                {['Accession', 'Status', 'Patient', 'StratusDX Facility', 'Mapped To', 'Ordered', 'Received', 'Finalized'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {!loading && rows.length === 0 ? (
                <tr>
                  <td colSpan="10" className="px-4 py-12 text-center">
                    <FlaskConical className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-400">No orders match these filters</p>
                  </td>
                </tr>
              ) : (
                rows.map((record) => {
                  const info = extractStratusInfo(record, 'orders');
                  const isExpanded = expandedId === record.id;
                  const isMapped = !!record.facility_id;
                  const hasMapping = info.facilityName ? mappedIdentifiers.has(info.facilityName.toLowerCase()) : false;
                  const patient = [record.patient_last_name, record.patient_first_name].filter(Boolean).join(', ');
                  return (
                    <React.Fragment key={record.id}>
                      <tr className={`hover:bg-slate-700/30 transition-colors ${loading ? 'opacity-60' : ''}`}>
                        <td className="px-3 py-3">
                          <button onClick={() => setExpandedId(isExpanded ? null : record.id)} aria-label={isExpanded ? 'Collapse' : 'Expand'} className="p-1 text-slate-400 hover:text-white">
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-white text-sm font-medium whitespace-nowrap">{info.accessionId || info.stratusGuid}</td>
                        <td className="px-4 py-3"><LabStatusBadge status={record.lab_status} /></td>
                        <td className="px-4 py-3 text-slate-200 text-sm">{patient || '--'}</td>
                        <td className="px-4 py-3">
                          {info.facilityName ? (
                            <div>
                              <p className="text-white text-sm">{info.facilityName}</p>
                              {info.orgName && info.orgName !== info.facilityName && <p className="text-slate-400 text-xs">{info.orgName}</p>}
                              {!isMapped && hasMapping && (
                                <span className="inline-flex items-center gap-1 text-teal-400 text-xs mt-0.5"><Link2 className="w-3 h-3" /> mapping exists</span>
                              )}
                            </div>
                          ) : <span className="text-slate-500 text-sm">--</span>}
                        </td>
                        <td className="px-4 py-3">
                          {isMapped ? (
                            <div>
                              <div className="flex items-center gap-1.5">
                                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                                <span className="text-white text-sm">{record.organization?.name || 'Unknown'}</span>
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                <span className="text-slate-300 text-sm">{record.facility?.name || 'Org level'}</span>
                              </div>
                            </div>
                          ) : <span className="text-yellow-400 text-sm font-medium">Not mapped</span>}
                        </td>
                        <td className="px-4 py-3 text-slate-300 text-sm whitespace-nowrap">{formatCompact(record.requisition_datetime, false) || '--'}</td>
                        <td className="px-4 py-3 text-slate-300 text-sm whitespace-nowrap">{formatCompact(record.received_datetime, false) || '--'}</td>
                        <td className="px-4 py-3 text-slate-300 text-sm whitespace-nowrap">{formatCompact(record.finalized_datetime, false) || '--'}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => openAssignModal(record)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-500/10 text-teal-400 hover:bg-teal-500/20 rounded-lg text-xs font-medium transition-colors whitespace-nowrap"
                          >
                            <ArrowRightCircle className="w-3.5 h-3.5" />
                            {isMapped ? 'Reassign' : 'Assign'}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-slate-900/30">
                          <td colSpan="10" className="px-4 py-4">
                            <OrderDetail orderId={record.id} info={info} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-slate-700 text-sm text-slate-400">
          <span>
            {loading ? 'Loading...' : total === 0 ? 'No orders' : `Showing ${page * PAGE_SIZE + 1} to ${Math.min(total, (page + 1) * PAGE_SIZE)} of ${total.toLocaleString()}`}
          </span>
          <div className="flex items-center gap-2">
            <button disabled={page === 0 || loading} onClick={() => setPage(page - 1)}
              className="px-3 py-1.5 rounded-lg border border-slate-700 disabled:opacity-40 hover:text-white">Previous</button>
            <span className="tabular-nums">Page {page + 1} of {pages}</span>
            <button disabled={page + 1 >= pages || loading} onClick={() => setPage(page + 1)}
              className="px-3 py-1.5 rounded-lg border border-slate-700 disabled:opacity-40 hover:text-white">Next</button>
          </div>
        </div>
      </div>

      {assignModal && (
        <AssignModal
          modal={assignModal}
          organizations={organizations}
          onClose={() => setAssignModal(null)}
          onAssign={handleAssign}
          onBulkAssign={handleBulkAssign}
          assigning={assigning}
          onOrgChange={(orgId) => {
            setAssignModal({
              ...assignModal,
              organizationId: orgId === '__new__' ? '__new__' : orgId,
              facilityId: '',
              createOrganization: orgId === '__new__',
            });
          }}
          onFacilityChange={(fId) => setAssignModal({ ...assignModal, facilityId: fId })}
          onToggleMapping={() => setAssignModal({ ...assignModal, createMapping: !assignModal.createMapping })}
          onMappingTypeChange={(mt) => setAssignModal({ ...assignModal, mappingType: mt })}
          onNewOrganizationNameChange={(name) => setAssignModal({ ...assignModal, newOrganizationName: name })}
        />
      )}
    </div>
  );
}

// Loads the full order when a row is expanded.
function OrderDetail({ orderId, info }) {
  const [record, setRecord] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    let cancelled = false;
    getLabOrderById(orderId)
      .then((r) => { if (!cancelled) setRecord(r); })
      .catch((err) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [orderId]);
  if (error) return <p className="text-red-300 text-sm">Could not load this order: {error}</p>;
  if (!record) return <div className="flex items-center gap-2 text-slate-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>;
  return <ExpandedDetail record={record} type="orders" info={info} />;
}

function ExpandedDetail({ record, type, info }) {
  const rawData = type === 'orders' ? record.order_data : record.result_data;
  const [showRaw, setShowRaw] = useState(false);
  const [panels, setPanels] = useState([]);
  const [tests, setTests] = useState([]);
  const [dxCodes, setDxCodes] = useState([]);
  const [medications, setMedications] = useState([]);
  const [insurance, setInsurance] = useState([]);
  const [observations, setObservations] = useState([]);
  const [loadingRel, setLoadingRel] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadRelational() {
      setLoadingRel(true);
      try {
        if (type === 'orders') {
          const [p, t, d, m, i, o] = await Promise.all([
            getOrderPanels(record.id),
            getOrderTests(record.id),
            getOrderDiagnosisCodes(record.id),
            getOrderMedications(record.id),
            getOrderInsurance(record.id),
            getOrderResultObservations(record.id),
          ]);
          if (cancelled) return;
          setObservations(o || []);
          setPanels(p || []);
          setTests(t || []);
          setDxCodes(d || []);
          setMedications(m || []);
          setInsurance(i || []);
        } else if (type === 'results') {
          const obs = await getResultObservations(record.id);
          if (cancelled) return;
          setObservations(obs || []);
        }
      } catch (err) {
        console.error('Error loading relational data:', err);
      } finally {
        if (!cancelled) setLoadingRel(false);
      }
    }
    loadRelational();
    return () => { cancelled = true; };
  }, [record.id, type]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <InfoCard title="Identifiers">
          <DetailRow label="Accession ID" value={info.accessionId} />
          <DetailRow label="Stratus GUID" value={info.stratusGuid} />
          {type === 'orders' && <DetailRow label="Status" value={record.lab_status} />}
          {type === 'orders' && <DetailRow label="StratusDX Status" value={record.order_status} />}
          {type === 'results' && <DetailRow label="Result Status" value={record.result_status} />}
          <DetailRow label="Sync Status" value={record.sync_status} />
          {record.sync_error && <DetailRow label="Sync Error" value={record.sync_error} />}
        </InfoCard>

        <InfoCard title="StratusDX Source">
          <DetailRow label="Facility Name" value={record.location_name || info.facilityName} />
          <DetailRow label="Organization" value={record.organization_name || info.orgName} />
          {type === 'orders' && (
            <>
              <DetailRow label="Lab Name" value={record.lab_name} />
              <DetailRow label="Lab CLIA" value={record.lab_clia} />
              <DetailRow label="Lab Phone" value={record.lab_phone} />
            </>
          )}
        </InfoCard>

        {type === 'orders' && (
          <InfoCard title="Patient & Provider">
            <DetailRow label="Patient Name" value={[record.patient_first_name, record.patient_last_name].filter(Boolean).join(' ')} />
            <DetailRow label="Patient Initials" value={record.patient_initials} />
            <DetailRow label="Date of Birth" value={record.patient_dob} />
            <DetailRow label="Gender" value={record.patient_gender} />
            <DetailRow label="Patient ID" value={record.patient_id} />
            <DetailRow label="Provider" value={[record.provider_first_name, record.provider_last_name].filter(Boolean).join(' ')} />
            <DetailRow label="Provider NPI" value={record.provider_npi} />
          </InfoCard>
        )}

        {type === 'orders' && (
          <InfoCard title="Order Timeline">
            <DetailRow label="Collected" value={formatCompact(record.collected_datetime)} />
            <DetailRow label="Ordered" value={formatCompact(record.requisition_datetime)} />
            <DetailRow label="Received" value={formatCompact(record.received_datetime)} />
            <DetailRow label="Finalized" value={formatCompact(record.finalized_datetime)} />
            <DetailRow label="Canceled" value={formatCompact(record.canceled_at)} />
            <DetailRow label="Rejected" value={formatCompact(record.rejected_at)} />
            <DetailRow label="Requisition By" value={record.requisition_by} />
            <DetailRow label="Comments" value={record.order_comments} />
          </InfoCard>
        )}

        {type === 'results' && (
          <InfoCard title="Result Summary">
            <DetailRow label="Result Value" value={record.result_value} />
            <DetailRow label="Units" value={record.units} />
            <DetailRow label="Reference Range" value={record.reference_range} />
            <DetailRow label="Abnormal Flag" value={record.abnormal_flag} />
            <DetailRow label="Resulted At" value={record.resulted_at_utc ? format(new Date(record.resulted_at_utc), 'MMM d, yyyy h:mm a') : null} />
          </InfoCard>
        )}

      </div>

      {loadingRel && (
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading relational data...
        </div>
      )}

      {!loadingRel && type === 'orders' && panels.length > 0 && (
        <DataTable
          title="Panels Ordered"
          columns={['Panel Name', 'Test Method', 'CPT Code', 'Rapid Order', 'Specimen Type']}
          rows={panels.map(p => [
            p.panel_name || '--',
            p.testmethod_name || '--',
            p.cpt_code || '--',
            p.rapid_order || '--',
            p.specimen_type || '--',
          ])}
        />
      )}

      {!loadingRel && type === 'orders' && tests.length > 0 && (
        <DataTable
          title="Tests Ordered"
          columns={['Test Name', 'Code', 'LOINC', 'UOM']}
          rows={tests.map(t => [
            t.test_name || '--',
            t.test_code || '--',
            t.loinc_code || '--',
            t.test_uom || '--',
          ])}
        />
      )}

      {!loadingRel && type === 'orders' && dxCodes.length > 0 && (
        <DataTable
          title="Diagnosis Codes"
          columns={['Code', 'Name']}
          rows={dxCodes.map(d => [d.code || '--', d.name || '--'])}
        />
      )}

      {!loadingRel && type === 'orders' && medications.length > 0 && (
        <DataTable
          title="Medications"
          columns={['Code', 'Name']}
          rows={medications.map(m => [m.code || '--', m.name || '--'])}
        />
      )}

      {!loadingRel && type === 'orders' && insurance.length > 0 && (
        <DataTable
          title="Insurance"
          columns={['Type', 'Plan Name', 'Policy #', 'Group #', 'Insured Name', 'Payer']}
          rows={insurance.map(ins => [
            ins.insurance_type || '--',
            ins.plan_name || '--',
            ins.policy_number || '--',
            ins.group_number || '--',
            ins.insured_name || '--',
            ins.payer_name || '--',
          ])}
        />
      )}

      {!loadingRel && type === 'orders' && (
        observations.length > 0 ? (
          <DataTable
            title="Results"
            columns={['Panel', 'Test', 'Result', 'Units', 'Flag']}
            rows={observations.map((obs) => [
              panels.find((p) => p.id === obs.order_panel_id)?.panel_name || '--',
              obs.test_name || obs.test_code || '--',
              obs.result_display || obs.result_value || '--',
              obs.result_uom || '--',
              obs.result_flag || '',
            ])}
            highlightCol={4}
          />
        ) : (
          <p className="text-slate-500 text-sm">No results yet.</p>
        )
      )}

      {!loadingRel && type === 'results' && observations.length > 0 && (
        <DataTable
          title="Result Observations"
          columns={['Test', 'Value', 'Display', 'Flag', 'Units', 'Cutoff', 'Abnormal']}
          rows={observations.map(obs => [
            obs.test_name || obs.test_code || '--',
            obs.result_value || '--',
            obs.result_display || '--',
            obs.result_flag || '',
            obs.result_uom || '--',
            obs.result_cutoffvalue || '--',
            obs.is_abnormal ? 'Yes' : '',
          ])}
          highlightCol={6}
        />
      )}

      <div>
        <button
          onClick={() => setShowRaw(!showRaw)}
          className="flex items-center gap-2 text-slate-400 hover:text-white text-xs font-medium transition-colors"
        >
          <ChevronRight className={`w-3 h-3 transition-transform ${showRaw ? 'rotate-90' : ''}`} />
          {showRaw ? 'Hide' : 'Show'} Raw JSON
        </button>
        {showRaw && (
          <pre className="bg-slate-900 border border-slate-700 rounded-lg p-4 text-xs text-slate-300 overflow-auto max-h-60 mt-2">
            {JSON.stringify(rawData || record, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

function InfoCard({ title, children }) {
  return (
    <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
      <h4 className="text-teal-400 text-xs font-semibold uppercase tracking-wider mb-3">{title}</h4>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function DataTable({ title, columns, rows, highlightCol }) {
  if (!rows || rows.length === 0) return null;
  return (
    <div>
      <h4 className="text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">{title}</h4>
      <div className="bg-slate-900/50 border border-slate-700 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-900/80 border-b border-slate-700">
            <tr>
              {columns.map((col, i) => (
                <th key={i} className="px-3 py-2 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {rows.map((row, ri) => (
              <tr key={ri} className="hover:bg-slate-800/30">
                {row.map((cell, ci) => (
                  <td key={ci} className={`px-3 py-2 text-sm ${
                    highlightCol !== undefined && ci === highlightCol && cell
                      ? 'text-yellow-400 font-medium'
                      : 'text-slate-300'
                  }`}>
                    {cell || '--'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DetailRow({ label, value }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-slate-500 text-xs">{label}</p>
      <p className="text-white text-sm">{value}</p>
    </div>
  );
}

function AssignModal({ modal, organizations, onClose, onAssign, onBulkAssign, assigning, onOrgChange, onFacilityChange, onToggleMapping, onMappingTypeChange, onNewOrganizationNameChange }) {
  const { record, type, info } = modal;
  const [facilities, setFacilities] = useState([]);
  const [loadingFacilities, setLoadingFacilities] = useState(false);
  const [mode, setMode] = useState('single');

  useEffect(() => {
    if (modal.organizationId) loadFacilities(modal.organizationId);
    else setFacilities([]);
  }, [modal.organizationId]);

  async function loadFacilities(orgId) {
    if (!orgId) { setFacilities([]); return; }
    setLoadingFacilities(true);
    try {
      const data = await facilitiesService.getAll({ organization_id: orgId });
      setFacilities(data || []);
    } catch (err) {
      console.error('Error loading facilities:', err);
      setFacilities([]);
    } finally {
      setLoadingFacilities(false);
    }
  }

  function handleOrgChange(e) {
    onOrgChange(e.target.value);
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-slate-800 flex items-center justify-between px-6 py-4 border-b border-slate-700 z-10">
          <div>
            <h2 className="text-lg font-semibold text-white">Assign Record</h2>
            <p className="text-slate-400 text-sm mt-0.5">
              {type === 'orders' ? 'Lab Order' : 'Lab Result'} &middot; {info.accessionId || info.stratusGuid}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {info.facilityName && (
            <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
              <p className="text-slate-400 text-xs mb-1">StratusDX Facility Detected</p>
              <p className="text-white font-medium">{info.facilityName}</p>
              {info.orgName && <p className="text-slate-400 text-sm mt-0.5">Org: {info.orgName}</p>}
            </div>
          )}

          {info.accessionId && (
            <div className="flex gap-2">
              <button
                onClick={() => setMode('single')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  mode === 'single' ? 'bg-teal-500/10 text-teal-400 border border-teal-500/30' : 'bg-slate-700 text-slate-400 border border-slate-600'
                }`}
              >
                This record only
              </button>
              <button
                onClick={() => setMode('bulk')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  mode === 'bulk' ? 'bg-teal-500/10 text-teal-400 border border-teal-500/30' : 'bg-slate-700 text-slate-400 border border-slate-600'
                }`}
              >
                All records with accession {info.accessionId}
              </button>
            </div>
          )}

          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">Organization *</label>
            <select
              value={modal.organizationId}
              onChange={handleOrgChange}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
            >
              <option value="">Select organization...</option>
              <option value="__new__">+ Create new organization</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
            {modal.createOrganization && (
              <div className="mt-3">
                <label className="block text-slate-300 text-xs font-medium mb-1">New organization name</label>
                <input
                  type="text"
                  value={modal.newOrganizationName}
                  onChange={(e) => onNewOrganizationNameChange(e.target.value)}
                  placeholder="e.g., Coastal Spine & Pain Institute"
                  className="w-full bg-slate-900 border border-teal-500/40 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500"
                  autoFocus
                />
                <p className="text-slate-400 text-xs mt-1">The detected facility will be created inside this organization.</p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">Facility</label>
            <select
              value={modal.facilityId}
              onChange={(e) => onFacilityChange(e.target.value)}
              disabled={!modal.organizationId || modal.createOrganization || loadingFacilities}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500 disabled:opacity-50"
            >
              <option value="">Organization level (all facilities)</option>
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
            {modal.createOrganization ? (
              <p className="text-teal-400 text-xs mt-1 flex items-center gap-1"><Plus className="w-3 h-3" /> {info.facilityName || 'Detected facility'} will be created automatically.</p>
            ) : loadingFacilities && <p className="text-slate-500 text-xs mt-1">Loading facilities...</p>}
          </div>

          {info.facilityName && (
            <div className="bg-teal-500/5 border border-teal-500/20 rounded-lg p-4 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={modal.createMapping}
                  onChange={onToggleMapping}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-teal-500 focus:ring-teal-500"
                />
                <span className="text-white text-sm font-medium">Create StratusDX mapping for future syncs</span>
              </label>
              {modal.createMapping && (
                <div>
                  <label className="block text-slate-300 text-xs font-medium mb-1">Mapping Type</label>
                  <select
                    value={modal.mappingType}
                    onChange={(e) => onMappingTypeChange(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-teal-500"
                  >
                    <option value="exact">Exact Match</option>
                    <option value="contains">Contains (partial match)</option>
                    <option value="pattern">Pattern (regex)</option>
                  </select>
                  <p className="text-slate-400 text-xs mt-1">
                    Identifier: <span className="text-teal-400">{info.facilityName}</span>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-slate-800 flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-700">
          <button onClick={onClose} className="px-4 py-2 text-slate-300 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg transition-colors">
            Cancel
          </button>
          <button
            onClick={() => mode === 'bulk' && info.accessionId ? onBulkAssign(info.accessionId, info) : onAssign()}
            disabled={assigning}
            className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-slate-900 rounded-lg hover:bg-teal-400 transition-colors font-medium disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {assigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {assigning ? 'Assigning...' : mode === 'bulk' ? 'Bulk Assign' : 'Assign Record'}
          </button>
        </div>
      </div>
    </div>
  );
}
