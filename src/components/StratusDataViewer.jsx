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
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="space-y-3">
        <h4 className="text-slate-300 text-xs font-semibold uppercase tracking-wider">Record Details</h4>
        <DetailRow label="Accession ID" value={info.accessionId} />
        <DetailRow label="Stratus GUID" value={info.stratusGuid} />
        <DetailRow label="StratusDX Facility" value={info.facilityName} />
        <DetailRow label="StratusDX Org" value={info.orgName} />
        {type === 'orders' && (
          <>
            <DetailRow label="Patient Initials" value={record.patient_initials} />
            <DetailRow label="Provider" value={record.provider_name} />
            <DetailRow label="Location" value={record.location_name} />
            <DetailRow label="Order Status" value={record.order_status} />
            {record.panels && record.panels.length > 0 && (
              <div>
                <p className="text-slate-500 text-xs mb-1">Panels</p>
                <div className="flex flex-wrap gap-1">
                  {record.panels.map((p, i) => (
                    <span key={i} className="px-2 py-0.5 bg-slate-700 text-slate-300 rounded text-xs">{p}</span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        {type === 'results' && (
          <>
            <DetailRow label="Result Status" value={record.result_status} />
            <DetailRow label="Result Value" value={record.result_value} />
            <DetailRow label="Units" value={record.units} />
            <DetailRow label="Reference Range" value={record.reference_range} />
            <DetailRow label="Abnormal Flag" value={record.abnormal_flag} />
            {record.test_results && record.test_results.length > 0 && (
              <div>
                <p className="text-slate-500 text-xs mb-1">Test Results ({record.test_results.length})</p>
                <div className="space-y-1">
                  {record.test_results.slice(0, 5).map((tr, i) => (
                    <div key={i} className="text-xs text-slate-300 bg-slate-800 rounded px-2 py-1">
                      {tr.test_name || tr.name}: {tr.value} {tr.units || ''}
                      {tr.abnormal_flag && <span className="text-yellow-400 ml-1">({tr.abnormal_flag})</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        {type === 'confirmations' && (
          <>
            <DetailRow label="Received Time" value={record.received_time} />
            <DetailRow label="HL7 Message" value={record.hl7_message ? record.hl7_message.substring(0, 200) + '...' : null} />
          </>
        )}
        <DetailRow label="Sync Status" value={record.sync_status} />
        {record.sync_error && <DetailRow label="Sync Error" value={record.sync_error} />}
      </div>
      <div className="md:col-span-2">
        <h4 className="text-slate-300 text-xs font-semibold uppercase tracking-wider mb-3">Raw Data (JSON)</h4>
        <pre className="bg-slate-900 border border-slate-700 rounded-lg p-4 text-xs text-slate-300 overflow-auto max-h-80">
          {JSON.stringify(rawData || record, null, 2)}
        </pre>
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
