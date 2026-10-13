import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  getLabOrders, getLabResults, getLabConfirmations,
  assignOrderToFacility, assignResultToFacility, assignConfirmationToFacility,
  bulkAssignByAccession,
  getOrderPanels, getOrderTests, getOrderDiagnosisCodes, getOrderMedications, getOrderInsurance,
  getResultObservations,
} from '../services/labDataService';
import { stratusMappingService } from '../services/stratusMappingService';
import { organizationsService } from '../services/organizationsService';
import { facilitiesService } from '../services/facilitiesService';
import {
  FlaskConical, Search, Building2, MapPin, X, Save, Link2, Plus,
  ChevronDown, ChevronRight, AlertTriangle, CheckCircle2,
  Loader2, Filter, RefreshCw, ArrowRightCircle, Beaker, FileCheck,
} from 'lucide-react';
import { format } from 'date-fns';

const SYNC_STATUS_COLORS = {
  pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  retrieved: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  acknowledged: 'bg-teal-500/10 text-teal-400 border-teal-500/30',
  synced: 'bg-green-500/10 text-green-400 border-green-500/30',
  error: 'bg-red-500/10 text-red-400 border-red-500/30',
};

function StatusBadge({ status }) {
  const cls = SYNC_STATUS_COLORS[status] || 'bg-slate-700 text-slate-300 border-slate-600';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${cls}`}>
      {status}
    </span>
  );
}

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
      facilityName: rd.location_name || rd.facility_name || rd.facility?.name || '',
      orgName: rd.organization_name || rd.organization?.name || '',
      accessionId: record.accession_id || record.accession_number || '',
      stratusGuid: record.stratus_guid || '',
    };
  }
  const cd = record.confirmation_data || {};
  return {
    facilityName: cd.location_name || cd.facility_name || cd.facility?.name || '',
    orgName: cd.organization_name || cd.organization?.name || '',
    accessionId: record.accession_number || '',
    stratusGuid: record.stratus_guid || '',
  };
}

export default function StratusDataViewer() {
  const [activeTab, setActiveTab] = useState('orders');
  const [orders, setOrders] = useState([]);
  const [results, setResults] = useState([]);
  const [confirmations, setConfirmations] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [mappings, setMappings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterUnmapped, setFilterUnmapped] = useState(false);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [assignModal, setAssignModal] = useState(null);
  const [actionMessage, setActionMessage] = useState(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [o, r, c, orgs, maps] = await Promise.all([
        getLabOrders(),
        getLabResults(),
        getLabConfirmations(),
        organizationsService.getAll(),
        stratusMappingService.getMappings(),
      ]);
      setOrders(o || []);
      setResults(r || []);
      setConfirmations(c || []);
      setOrganizations(orgs || []);
      setMappings(maps || []);
    } catch (err) {
      console.error('Error loading Stratus data:', err);
      setActionMessage({ type: 'error', text: 'Failed to load data: ' + err.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const mappedIdentifiers = useMemo(() => {
    const set = new Set();
    mappings.forEach(m => {
      if (m.is_active) set.add(m.stratus_facility_identifier.toLowerCase());
    });
    return set;
  }, [mappings]);

  const currentData = useMemo(() => {
    let data = activeTab === 'orders' ? orders : activeTab === 'results' ? results : confirmations;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      data = data.filter(item => {
        const info = extractStratusInfo(item, activeTab);
        return (
          info.accessionId?.toLowerCase().includes(q) ||
          info.facilityName?.toLowerCase().includes(q) ||
          info.orgName?.toLowerCase().includes(q) ||
          item.stratus_guid?.toLowerCase().includes(q) ||
          (item.organization?.name || '').toLowerCase().includes(q) ||
          (item.facility?.name || '').toLowerCase().includes(q)
        );
      });
    }
    if (filterUnmapped) {
      data = data.filter(item => !item.facility_id);
    }
    return data;
  }, [activeTab, orders, results, confirmations, searchTerm, filterUnmapped]);

  const stats = useMemo(() => ({
    totalOrders: orders.length,
    unmappedOrders: orders.filter(o => !o.facility_id).length,
    totalResults: results.length,
    unmappedResults: results.filter(r => !r.facility_id).length,
    totalConfirmations: confirmations.length,
    unmappedConfirmations: confirmations.filter(c => !c.facility_id).length,
  }), [orders, results, confirmations]);

  function toggleRow(id) {
    const next = new Set(expandedRows);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpandedRows(next);
  }

  function openAssignModal(record, type) {
    const info = extractStratusInfo(record, type);
    setAssignModal({
      record, type, info,
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

  async function handleAssign() {
    if (!assignModal) return;
    const { record, type, organizationId, facilityId, info, createMapping, mappingType } = assignModal;
    let resolvedOrganizationId = organizationId;
    let resolvedFacilityId = facilityId;
    try {
      if (assignModal.createOrganization) {
        const organizationName = assignModal.newOrganizationName?.trim();
        if (!organizationName) { showMessage('error', 'Enter an organization name'); return; }
        const organization = await organizationsService.create({ name: organizationName, type: 'customer' });
        resolvedOrganizationId = organization.id;
        if (info.facilityName) {
          const facility = await facilitiesService.create({
            name: info.facilityName,
            organization_id: resolvedOrganizationId,
            status: 'Active',
          });
          resolvedFacilityId = facility.id;
        }
      }

      if (!resolvedOrganizationId) { showMessage('error', 'Please select an organization'); return; }
      if (type === 'orders') await assignOrderToFacility(record.id, resolvedOrganizationId, resolvedFacilityId || null);
      else if (type === 'results') await assignResultToFacility(record.id, resolvedOrganizationId, resolvedFacilityId || null);
      else await assignConfirmationToFacility(record.id, resolvedOrganizationId, resolvedFacilityId || null);

      if (createMapping && info.facilityName) {
        try {
          await stratusMappingService.createMapping({
            organization_id: resolvedOrganizationId,
            facility_id: resolvedFacilityId || null,
            stratus_facility_identifier: info.facilityName,
            stratus_organization_identifier: info.orgName || null,
            mapping_type: mappingType,
            is_active: true,
            notes: `Auto-created from Stratus Data Viewer (${type})`,
          });
          showMessage('success', `Record assigned and mapping created for "${info.facilityName}"`);
        } catch (mapErr) {
          showMessage('success', `Record assigned. Mapping already exists for "${info.facilityName}"`);
        }
      } else {
        showMessage('success', 'Record assigned successfully');
      }
      setAssignModal(null);
      loadData();
    } catch (err) {
      showMessage('error', 'Failed to assign: ' + err.message);
    }
  }

  async function handleBulkAssign(accessionId, info) {
    if (!assignModal) return;
    let { organizationId, facilityId, createMapping, mappingType } = assignModal;
    try {
      if (assignModal.createOrganization) {
        const organizationName = assignModal.newOrganizationName?.trim();
        if (!organizationName) { showMessage('error', 'Enter an organization name'); return; }
        const organization = await organizationsService.create({ name: organizationName, type: 'customer' });
        organizationId = organization.id;
        if (info.facilityName) {
          const facility = await facilitiesService.create({
            name: info.facilityName,
            organization_id: organizationId,
            status: 'Active',
          });
          facilityId = facility.id;
        }
      }

      if (!organizationId) { showMessage('error', 'Please select an organization'); return; }
      const counts = await bulkAssignByAccession(accessionId, organizationId, facilityId || null);
      if (createMapping && info.facilityName) {
        try {
          await stratusMappingService.createMapping({
            organization_id: organizationId,
            facility_id: facilityId || null,
            stratus_facility_identifier: info.facilityName,
            stratus_organization_identifier: info.orgName || null,
            mapping_type: mappingType,
            is_active: true,
            notes: 'Auto-created from Stratus Data Viewer (bulk by accession)',
          });
          showMessage('success', `${counts.orders + counts.results + counts.confirmations} records assigned and mapping created for "${info.facilityName}"`);
        } catch (mapErr) {
          showMessage('success', `${counts.orders + counts.results + counts.confirmations} records assigned. Mapping already exists.`);
        }
      } else {
        showMessage('success', `Assigned ${counts.orders} orders, ${counts.results} results, ${counts.confirmations} confirmations`);
      }
      setAssignModal(null);
      loadData();
    } catch (err) {
      showMessage('error', 'Bulk assign failed: ' + err.message);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-white mb-1">StratusDX Data Viewer</h3>
        <p className="text-slate-400 text-sm">
          Browse all synced lab records and assign them to organizations and facilities
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <StatCard label="Orders" value={stats.totalOrders} icon={FlaskConical} color="text-teal-400" />
        <StatCard label="Unmapped" value={stats.unmappedOrders} icon={AlertTriangle} color="text-yellow-400" />
        <StatCard label="Results" value={stats.totalResults} icon={Beaker} color="text-blue-400" />
        <StatCard label="Unmapped" value={stats.unmappedResults} icon={AlertTriangle} color="text-yellow-400" />
        <StatCard label="Confirmations" value={stats.totalConfirmations} icon={FileCheck} color="text-purple-400" />
        <StatCard label="Unmapped" value={stats.unmappedConfirmations} icon={AlertTriangle} color="text-yellow-400" />
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

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 bg-slate-800/50 border border-slate-700 rounded-lg p-1">
          <TabButton active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} icon={FlaskConical} label="Orders" count={stats.totalOrders} />
          <TabButton active={activeTab === 'results'} onClick={() => setActiveTab('results')} icon={Beaker} label="Results" count={stats.totalResults} />
          <TabButton active={activeTab === 'confirmations'} onClick={() => setActiveTab('confirmations')} icon={FileCheck} label="Confirmations" count={stats.totalConfirmations} />
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by accession, facility name, organization..."
            className="w-full bg-slate-800/50 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white text-sm focus:outline-none focus:border-teal-500"
          />
        </div>
        <button
          onClick={() => setFilterUnmapped(!filterUnmapped)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
            filterUnmapped
              ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
              : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:text-white'
          }`}
        >
          <Filter className="w-4 h-4" />
          Unmapped Only
        </button>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 border border-slate-700 text-slate-400 hover:text-white rounded-lg text-sm font-medium transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-900/50 border-b border-slate-700">
              <tr>
                <th className="px-3 py-3 w-8"></th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Accession</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">StratusDX Facility</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Mapped To</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Sync Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {currentData.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-12 text-center">
                    <FlaskConical className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-400">No records found</p>
                  </td>
                </tr>
              ) : (
                currentData.map((record) => {
                  const info = extractStratusInfo(record, activeTab);
                  const isExpanded = expandedRows.has(record.id);
                  const isMapped = !!record.facility_id;
                  const hasMapping = info.facilityName ? mappedIdentifiers.has(info.facilityName.toLowerCase()) : false;
                  return (
                    <React.Fragment key={record.id}>
                      <tr className={`hover:bg-slate-700/30 transition-colors ${!isMapped ? 'bg-yellow-500/[0.03]' : ''}`}>
                        <td className="px-3 py-3">
                          <button onClick={() => toggleRow(record.id)} className="p-1 text-slate-400 hover:text-white">
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-white text-sm font-medium">{info.accessionId || info.stratusGuid}</p>
                          {info.stratusGuid && info.accessionId && (
                            <p className="text-slate-500 text-xs">{info.stratusGuid}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {info.facilityName ? (
                            <div>
                              <p className="text-white text-sm">{info.facilityName}</p>
                              {info.orgName && <p className="text-slate-400 text-xs">{info.orgName}</p>}
                            </div>
                          ) : (
                            <span className="text-slate-500 text-sm">--</span>
                          )}
                          {hasMapping && (
                            <span className="inline-flex items-center gap-1 text-teal-400 text-xs mt-1">
                              <Link2 className="w-3 h-3" /> mapping exists
                            </span>
                          )}
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
                          ) : (
                            <span className="text-yellow-400 text-sm font-medium">Not mapped</span>
                          )}
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={record.sync_status} /></td>
                        <td className="px-4 py-3">
                          <span className="text-slate-400 text-sm">
                            {record.created_at ? format(new Date(record.created_at), 'MMM d, yyyy') : '--'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => openAssignModal(record, activeTab)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-500/10 text-teal-400 hover:bg-teal-500/20 rounded-lg text-xs font-medium transition-colors"
                          >
                            <ArrowRightCircle className="w-3.5 h-3.5" />
                            {isMapped ? 'Reassign' : 'Assign'}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-slate-900/30">
                          <td colSpan="7" className="px-4 py-4">
                            <ExpandedDetail record={record} type={activeTab} info={info} />
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
      </div>

      {assignModal && (
        <AssignModal
          modal={assignModal}
          organizations={organizations}
          onClose={() => setAssignModal(null)}
          onAssign={handleAssign}
          onBulkAssign={handleBulkAssign}
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

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs text-slate-400">{label}</span>
      </div>
      <p className="text-xl font-bold text-white">{value}</p>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label, count }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
        active ? 'bg-teal-500/10 text-teal-400' : 'text-slate-400 hover:text-white'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
      <span className={`text-xs px-1.5 py-0.5 rounded ${active ? 'bg-teal-500/20' : 'bg-slate-700'}`}>{count}</span>
    </button>
  );
}

function ExpandedDetail({ record, type, info }) {
  const rawData = type === 'orders' ? record.order_data : type === 'results' ? record.result_data : record.confirmation_data;
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
          const [p, t, d, m, i] = await Promise.all([
            getOrderPanels(record.id),
            getOrderTests(record.id),
            getOrderDiagnosisCodes(record.id),
            getOrderMedications(record.id),
            getOrderInsurance(record.id),
          ]);
          if (cancelled) return;
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
          {type === 'orders' && <DetailRow label="Order Status" value={record.order_status} />}
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
            <DetailRow label="Collected" value={record.collected_datetime} />
            <DetailRow label="Requisition" value={record.requisition_datetime} />
            <DetailRow label="Received" value={record.received_datetime} />
            <DetailRow label="Finalized" value={record.finalized_datetime} />
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

        {type === 'confirmations' && (
          <InfoCard title="Confirmation Details">
            <DetailRow label="Received Time" value={record.received_time} />
            <DetailRow label="Accession Number" value={record.accession_number} />
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

      {type === 'confirmations' && record.hl7_message && (
        <div>
          <h4 className="text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2">HL7 Message</h4>
          <pre className="bg-slate-900 border border-slate-700 rounded-lg p-4 text-xs text-slate-300 overflow-auto max-h-40 whitespace-pre-wrap">
            {record.hl7_message}
          </pre>
        </div>
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

function AssignModal({ modal, organizations, onClose, onAssign, onBulkAssign, onOrgChange, onFacilityChange, onToggleMapping, onMappingTypeChange, onNewOrganizationNameChange }) {
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
              {type === 'orders' ? 'Lab Order' : type === 'results' ? 'Lab Result' : 'Confirmation'} &middot; {info.accessionId || info.stratusGuid}
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
            className="flex items-center gap-2 px-4 py-2 bg-teal-500 text-slate-900 rounded-lg hover:bg-teal-400 transition-colors font-medium"
          >
            <Save className="w-4 h-4" />
            {mode === 'bulk' ? 'Bulk Assign' : 'Assign Record'}
          </button>
        </div>
      </div>
    </div>
  );
}
