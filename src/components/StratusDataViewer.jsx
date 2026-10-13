import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  getLabOrders, getLabResults, getLabConfirmations,
  assignOrderToFacility, assignResultToFacility, assignConfirmationToFacility,
  bulkAssignByAccession,
} from '../services/labDataService';
import { stratusMappingService } from '../services/stratusMappingService';
import { organizationsService } from '../services/organizationsService';
import { facilitiesService } from '../services/facilitiesService';
import {
  FlaskConical, Search, Building2, MapPin, X, Save, Link2,
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
    });
  }

  function showMessage(type, text) {
    setActionMessage({ type, text });
    setTimeout(() => setActionMessage(null), 4000);
  }

  async function handleAssign() {
    if (!assignModal) return;
    const { record, type, organizationId, facilityId, info, createMapping, mappingType } = assignModal;
    if (!organizationId) { showMessage('error', 'Please select an organization'); return; }
    try {
      if (type === 'orders') await assignOrderToFacility(record.id, organizationId, facilityId || null);
      else if (type === 'results') await assignResultToFacility(record.id, organizationId, facilityId || null);
      else await assignConfirmationToFacility(record.id, organizationId, facilityId || null);

      if (createMapping && info.facilityName) {
        try {
          await stratusMappingService.createMapping({
            organization_id: organizationId,
            facility_id: facilityId || null,
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
    const { organizationId, facilityId, createMapping, mappingType } = assignModal;
    if (!organizationId) { showMessage('error', 'Please select an organization'); return; }
    try {
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
            setAssignModal({ ...assignModal, organizationId: orgId, facilityId: '' });
          }}
          onFacilityChange={(fId) => setAssignModal({ ...assignModal, facilityId: fId })}
          onToggleMapping={() => setAssignModal({ ...assignModal, createMapping: !assignModal.createMapping })}
          onMappingTypeChange={(mt) => setAssignModal({ ...assignModal, mappingType: mt })}
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

  const parsed = useMemo(() => parseRawData(rawData, type), [rawData, type]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <InfoCard title="Identifiers">
          <DetailRow label="Accession ID" value={info.accessionId} />
          <DetailRow label="Stratus GUID" value={info.stratusGuid} />
          {type === 'orders' && <DetailRow label="Order Status" value={record.order_status || parsed.order_status} />}
          {type === 'results' && <DetailRow label="Result Status" value={record.result_status || parsed.result_status} />}
          <DetailRow label="Sync Status" value={record.sync_status} />
          {record.sync_error && <DetailRow label="Sync Error" value={record.sync_error} />}
        </InfoCard>

        <InfoCard title="StratusDX Source">
          <DetailRow label="Facility Name" value={parsed.facility_name || info.facilityName} />
          <DetailRow label="Facility ID" value={parsed.facility_id} />
          <DetailRow label="Organization" value={parsed.organization_name || info.orgName} />
          <DetailRow label="Organization ID" value={parsed.organization_id} />
          <DetailRow label="Location" value={parsed.location_name || record.location_name} />
        </InfoCard>

        {type === 'orders' && (
          <InfoCard title="Patient & Provider">
            <DetailRow label="Patient Initials" value={parsed.patient_initials || record.patient_initials} />
            <DetailRow label="Patient Name" value={parsed.patient_name} />
            <DetailRow label="Date of Birth" value={parsed.patient_dob} />
            <DetailRow label="Gender" value={parsed.patient_gender} />
            <DetailRow label="Provider" value={parsed.provider_name || record.provider_name} />
            <DetailRow label="Provider NPI" value={parsed.provider_npi} />
          </InfoCard>
        )}

        {type === 'results' && (
          <InfoCard title="Result Summary">
            <DetailRow label="Result Value" value={record.result_value || parsed.result_value} />
            <DetailRow label="Units" value={record.units || parsed.units} />
            <DetailRow label="Reference Range" value={record.reference_range || parsed.reference_range} />
            <DetailRow label="Abnormal Flag" value={record.abnormal_flag || parsed.abnormal_flag} />
            <DetailRow label="Resulted At" value={record.resulted_at_utc ? format(new Date(record.resulted_at_utc), 'MMM d, yyyy h:mm a') : parsed.resulted_at} />
          </InfoCard>
        )}

        {type === 'confirmations' && (
          <InfoCard title="Confirmation Details">
            <DetailRow label="Received Time" value={record.received_time || parsed.received_time} />
            <DetailRow label="Accession Number" value={record.accession_number} />
            <DetailRow label="Message Type" value={parsed.message_type} />
            <DetailRow label="Sending Facility" value={parsed.sending_facility} />
          </InfoCard>
        )}
      </div>

      {type === 'orders' && parsed.panels && parsed.panels.length > 0 && (
        <DataTable
          title="Panels Ordered"
          columns={['Panel Name', 'Code', 'Description']}
          rows={parsed.panels.map(p => [
            p.name || p.panel_name || p || '--',
            p.code || p.panel_code || '--',
            p.description || '--',
          ])}
        />
      )}

      {type === 'orders' && parsed.tests && parsed.tests.length > 0 && (
        <DataTable
          title="Tests Ordered"
          columns={['Test Name', 'Code', 'Method']}
          rows={parsed.tests.map(t => [
            t.name || t.test_name || '--',
            t.code || t.test_code || '--',
            t.method || t.test_method || '--',
          ])}
        />
      )}

      {type === 'results' && (
        <>
          {record.test_results && record.test_results.length > 0 && (
            <DataTable
              title="Individual Test Results"
              columns={['Test Name', 'Value', 'Units', 'Reference Range', 'Abnormal']}
              rows={record.test_results.map(tr => [
                tr.test_name || tr.name || '--',
                tr.value || tr.result_value || '--',
                tr.units || '--',
                tr.reference_range || tr.ref_range || '--',
                tr.abnormal_flag || (tr.abnormal ? 'Yes' : ''),
              ])}
              highlightCol={4}
            />
          )}
          {parsed.result_observations && parsed.result_observations.length > 0 && (
            <DataTable
              title="Result Observations"
              columns={['Observation Name', 'Value', 'Units', 'Reference Range', 'Interpretation']}
              rows={parsed.result_observations.map(obs => [
                obs.name || obs.observation_name || obs.test_name || '--',
                obs.value || obs.observation_value || '--',
                obs.units || '--',
                obs.reference_range || obs.ref_range || '--',
                obs.interpretation || obs.abnormal_flag || '',
              ])}
              highlightCol={4}
            />
          )}
        </>
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

function parseRawData(rawData, type) {
  if (!rawData || typeof rawData !== 'object') return {};
  const d = rawData;
  if (type === 'orders') {
    return {
      facility_name: d.facility_name || d.facilityName || d.facility?.name,
      facility_id: d.facility_id || d.facilityId || d.facility?.id,
      organization_name: d.organization_name || d.organizationName || d.organization?.name,
      organization_id: d.organization_id || d.organizationId || d.organization?.id,
      location_name: d.location_name || d.locationName || d.location?.name,
      patient_initials: d.patient_initials || d.patientInitials,
      patient_name: d.patient_name || d.patientName || d.patient?.name,
      patient_dob: d.patient_dob || d.patientDOB || d.patient?.dob || d.patient?.date_of_birth,
      patient_gender: d.patient_gender || d.patientGender || d.patient?.gender || d.patient?.sex,
      provider_name: d.provider_name || d.providerName || d.provider?.name || d.ordering_provider?.name,
      provider_npi: d.provider_npi || d.providerNpi || d.provider?.npi || d.ordering_provider?.npi,
      order_status: d.order_status || d.orderStatus || d.status,
      panels: extractArray(d.panels || d.panel_list || d.ordered_panels),
      tests: extractArray(d.tests || d.test_list || d.ordered_tests),
    };
  }
  if (type === 'results') {
    return {
      facility_name: d.facility_name || d.facilityName || d.facility?.name,
      facility_id: d.facility_id || d.facilityId,
      organization_name: d.organization_name || d.organizationName,
      organization_id: d.organization_id || d.organizationId,
      result_status: d.result_status || d.resultStatus || d.status,
      result_value: d.result_value || d.resultValue || d.value,
      units: d.units || d.unit,
      reference_range: d.reference_range || d.referenceRange || d.ref_range,
      abnormal_flag: d.abnormal_flag || d.abnormalFlag || d.abnormal,
      resulted_at: d.resulted_at || d.resultedAt || d.result_date || d.resultDate,
      result_observations: extractArray(d.observations || d.result_observations || d.results || d.test_results),
    };
  }
  const hl7Segments = typeof d.hl7_message === 'string' ? d.hl7_message.split('|') : [];
  return {
    received_time: d.received_time || d.receivedTime,
    message_type: d.message_type || d.messageType || (hl7Segments[0] ? hl7Segments[0].split('^')[0] : null),
    sending_facility: d.sending_facility || d.sendingFacility || (hl7Segments[3] || null),
    facility_name: d.facility_name || d.facilityName,
    organization_name: d.organization_name || d.organizationName,
  };
}

function extractArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') return val.split(',').map(s => ({ name: s.trim() }));
  return [];
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

function AssignModal({ modal, organizations, onClose, onAssign, onBulkAssign, onOrgChange, onFacilityChange, onToggleMapping, onMappingTypeChange }) {
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
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-300 text-sm font-medium mb-2">Facility</label>
            <select
              value={modal.facilityId}
              onChange={(e) => onFacilityChange(e.target.value)}
              disabled={!modal.organizationId || loadingFacilities}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-teal-500 disabled:opacity-50"
            >
              <option value="">Organization level (all facilities)</option>
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
            {loadingFacilities && <p className="text-slate-500 text-xs mt-1">Loading facilities...</p>}
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
