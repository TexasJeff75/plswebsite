import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { organizationsService } from '../services/organizationsService';
import { useAuth } from '../contexts/AuthContext';
import {
  FileText, Shield, Rocket, DollarSign, Wrench, GraduationCap,
  Calendar, Download, Eye, ChevronDown, X, Loader2, Printer
} from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from 'date-fns';

const REPORTS = [
  {
    id: 'compliance',
    title: 'Compliance Report',
    description: 'CLIA status, PT results, deficiencies, and regulatory compliance across all sites',
    icon: Shield,
    color: 'bg-green-500/10 text-green-400',
  },
  {
    id: 'deployment',
    title: 'Deployment Report',
    description: 'Milestone progress, blocked items, timeline tracking, and go-live readiness',
    icon: Rocket,
    color: 'bg-blue-500/10 text-blue-400',
  },
  {
    id: 'financial',
    title: 'Financial Report',
    description: 'MRR by client, revenue forecast, billing status, and contract details',
    icon: DollarSign,
    color: 'bg-emerald-500/10 text-emerald-400',
  },
  {
    id: 'equipment',
    title: 'Equipment Report',
    description: 'Equipment status by type, maintenance due dates, and procurement tracking',
    icon: Wrench,
    color: 'bg-amber-500/10 text-amber-400',
  },
  {
    id: 'training',
    title: 'Training Report',
    description: 'Training completion rates, competency assessments due, and certification status',
    icon: GraduationCap,
    color: 'bg-cyan-500/10 text-cyan-400',
  },
];

const DATE_RANGES = [
  { id: 'this_month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'quarter', label: 'This Quarter' },
  { id: 'year', label: 'This Year' },
  { id: 'custom', label: 'Custom Range' },
];

const FORMATS = [
  { id: 'screen', label: 'View on Screen', icon: Eye },
  { id: 'csv', label: 'Export CSV', icon: Download },
  { id: 'pdf', label: 'Export PDF', icon: Printer },
];

export default function Reports() {
  const { isProximityAdmin } = useAuth();
  const [selectedReport, setSelectedReport] = useState(null);
  const [dateRange, setDateRange] = useState('this_month');
  const [outputFormat, setOutputFormat] = useState('screen');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [generating, setGenerating] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const availableReports = REPORTS.filter(report =>
    report.id !== 'financial' || isProximityAdmin
  );

  const getDateRange = () => {
    const now = new Date();
    switch (dateRange) {
      case 'this_month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'last_month':
        const lastMonth = subMonths(now, 1);
        return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
      case 'quarter':
        return { start: startOfQuarter(now), end: endOfQuarter(now) };
      case 'year':
        return { start: startOfYear(now), end: endOfYear(now) };
      case 'custom':
        return {
          start: customStart ? new Date(customStart) : startOfMonth(now),
          end: customEnd ? new Date(customEnd) : endOfMonth(now)
        };
      default:
        return { start: startOfMonth(now), end: endOfMonth(now) };
    }
  };

  const generateReport = async (reportId) => {
    setGenerating(true);
    setSelectedReport(reportId);

    try {
      const { start, end } = getDateRange();
      let data = null;

      switch (reportId) {
        case 'compliance':
          data = await generateComplianceReport(start, end);
          break;
        case 'deployment':
          data = await generateDeploymentReport(start, end);
          break;
        case 'financial':
          data = await generateFinancialReport(start, end);
          break;
        case 'equipment':
          data = await generateEquipmentReport(start, end);
          break;
        case 'training':
          data = await generateTrainingReport(start, end);
          break;
      }

      setReportData(data);

      if (outputFormat === 'csv') {
        exportToCSV(data, reportId);
      } else if (outputFormat === 'pdf') {
        exportToPDF(data, reportId);
      } else {
        setShowModal(true);
      }
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setGenerating(false);
    }
  };

  const generateComplianceReport = async (start, end) => {
    const { data: facilities } = await supabase
      .from('facilities')
      .select(`
        id, name, city, state,
        organization:organizations(name),
        regulatory_info(
          clia_certificate_received,
          clia_number,
          clia_certificate_expiration,
          pt_program_enrolled,
          pt_provider,
          state_license_required,
          state_license_number,
          state_license_expiration
        )
      `);

    const { data: deficiencies } = await supabase
      .from('deficiencies')
      .select('*, site:facilities(name)')
      .gte('opened_date', start.toISOString())
      .lte('opened_date', end.toISOString());

    return {
      title: 'Compliance Report',
      dateRange: `${format(start, 'MMM d, yyyy')} - ${format(end, 'MMM d, yyyy')}`,
      summary: {
        totalSites: facilities?.length || 0,
        cliaValid: facilities?.filter(f => f.regulatory_info?.clia_certificate_received).length || 0,
        ptEnrolled: facilities?.filter(f => f.regulatory_info?.pt_program_enrolled).length || 0,
        openDeficiencies: deficiencies?.filter(d => d.status === 'open').length || 0,
      },
      facilities: facilities?.map(f => ({
        name: f.name,
        client: f.organization?.name,
        location: `${f.city}, ${f.state}`,
        cliaStatus: f.regulatory_info?.clia_certificate_received ? 'Valid' : 'Pending',
        cliaNumber: f.regulatory_info?.clia_number || '-',
        cliaExpires: f.regulatory_info?.clia_certificate_expiration
          ? format(new Date(f.regulatory_info.clia_certificate_expiration), 'MM/dd/yyyy')
          : '-',
        ptEnrolled: f.regulatory_info?.pt_program_enrolled ? 'Yes' : 'No',
        ptProvider: f.regulatory_info?.pt_provider || '-',
      })) || [],
      deficiencies: deficiencies?.map(d => ({
        site: d.site?.name,
        type: d.deficiency_type,
        severity: d.severity,
        status: d.status,
        openedDate: format(new Date(d.opened_date), 'MM/dd/yyyy'),
        dueDate: d.due_date ? format(new Date(d.due_date), 'MM/dd/yyyy') : '-',
      })) || [],
    };
  };

  const generateDeploymentReport = async (start, end) => {
    const { data: facilities } = await supabase
      .from('facilities')
      .select(`
        id, name, city, state, overall_status, completion_percentage,
        projected_deployment_date, actual_deployment_date, actual_go_live,
        organization:organizations(name)
      `);

    const { data: milestones } = await supabase
      .from('milestones')
      .select('*, facility:facilities(name)')
      .eq('status', 'Blocked');

    return {
      title: 'Deployment Report',
      dateRange: `${format(start, 'MMM d, yyyy')} - ${format(end, 'MMM d, yyyy')}`,
      summary: {
        totalSites: facilities?.length || 0,
        deployed: facilities?.filter(f => f.actual_go_live).length || 0,
        inProgress: facilities?.filter(f => f.overall_status === 'in_progress').length || 0,
        blocked: milestones?.length || 0,
      },
      facilities: facilities?.map(f => ({
        name: f.name,
        client: f.organization?.name,
        location: `${f.city}, ${f.state}`,
        status: f.overall_status || 'not_started',
        progress: `${f.completion_percentage || 0}%`,
        targetDate: f.projected_deployment_date
          ? format(new Date(f.projected_deployment_date), 'MM/dd/yyyy')
          : '-',
        goLiveDate: f.actual_go_live
          ? format(new Date(f.actual_go_live), 'MM/dd/yyyy')
          : '-',
      })) || [],
      blockedItems: milestones?.map(m => ({
        site: m.facility?.name,
        milestone: m.name,
        reason: m.blocked_reason || 'Not specified',
        blockedSince: m.blocked_since
          ? format(new Date(m.blocked_since), 'MM/dd/yyyy')
          : '-',
      })) || [],
    };
  };

  const generateFinancialReport = async (start, end) => {
    const { data: organizations } = await supabase
      .from('organizations')
      .select(`
        id, name, client_type,
        monthly_recurring_revenue, annual_contract_value,
        contract_status, contract_end_date,
        facilities(id, monthly_service_fee, monthly_lis_saas_fee, actual_go_live)
      `)
      .eq('type', 'customer');

    const totalMRR = organizations?.reduce((sum, org) => {
      return sum + (Number(org.monthly_recurring_revenue) || 0);
    }, 0) || 0;

    const totalACV = organizations?.reduce((sum, org) => {
      return sum + (Number(org.annual_contract_value) || 0);
    }, 0) || 0;

    return {
      title: 'Financial Report',
      dateRange: `${format(start, 'MMM d, yyyy')} - ${format(end, 'MMM d, yyyy')}`,
      summary: {
        totalClients: organizations?.length || 0,
        totalMRR: totalMRR,
        totalACV: totalACV,
        avgRevenuePerClient: organizations?.length ? Math.round(totalMRR / organizations.length) : 0,
      },
      clients: organizations?.map(org => {
        const activeSites = org.facilities?.filter(f => f.actual_go_live).length || 0;
        const siteMRR = org.facilities?.filter(f => f.actual_go_live).reduce((sum, f) => {
          return sum + (Number(f.monthly_service_fee) || 750) + (Number(f.monthly_lis_saas_fee) || 78);
        }, 0) || 0;

        return {
          name: org.name,
          type: org.client_type || 'standard',
          activeSites,
          totalSites: org.facilities?.length || 0,
          mrr: Number(org.monthly_recurring_revenue) || siteMRR,
          acv: Number(org.annual_contract_value) || 0,
          contractStatus: org.contract_status || 'active',
          contractEnd: org.contract_end_date
            ? format(new Date(org.contract_end_date), 'MM/dd/yyyy')
            : '-',
        };
      }) || [],
    };
  };

  const generateEquipmentReport = async (start, end) => {
    const { data: equipment } = await supabase
      .from('equipment')
      .select(`
        *,
        facility:facilities(name, organization:organizations(name))
      `);

    const { data: siteEquipment } = await supabase
      .from('site_equipment')
      .select(`
        *,
        site:facilities(name, organization:organizations(name))
      `);

    const allEquipment = [...(equipment || []), ...(siteEquipment || [])];

    const byStatus = allEquipment.reduce((acc, e) => {
      const status = e.equipment_status || e.status || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    return {
      title: 'Equipment Report',
      dateRange: `${format(start, 'MMM d, yyyy')} - ${format(end, 'MMM d, yyyy')}`,
      summary: {
        totalEquipment: allEquipment.length,
        installed: byStatus['installed'] || byStatus['Installed'] || 0,
        pending: byStatus['pending'] || byStatus['Ordered'] || 0,
        maintenanceDue: allEquipment.filter(e => {
          if (!e.last_maintenance_date) return false;
          const lastMaint = new Date(e.last_maintenance_date);
          const daysSince = (new Date() - lastMaint) / (1000 * 60 * 60 * 24);
          return daysSince > 90;
        }).length,
      },
      equipment: allEquipment.slice(0, 100).map(e => ({
        name: e.name || e.equipment_name,
        type: e.equipment_type || '-',
        site: e.facility?.name || e.site?.name || '-',
        client: e.facility?.organization?.name || e.site?.organization?.name || '-',
        status: e.equipment_status || e.status || '-',
        serialNumber: e.serial_number || '-',
        installedDate: e.installed_date || e.installation_date
          ? format(new Date(e.installed_date || e.installation_date), 'MM/dd/yyyy')
          : '-',
      })) || [],
    };
  };

  const generateTrainingReport = async (start, end) => {
    const { data: trainingInfo } = await supabase
      .from('training_info')
      .select(`
        *,
        facility:facilities(name, organization:organizations(name))
      `);

    const { data: trainedPersonnel } = await supabase
      .from('trained_personnel')
      .select(`
        *,
        facility:facilities(name, organization:organizations(name))
      `);

    const completedTraining = trainingInfo?.filter(t => t.initial_training_complete).length || 0;
    const competencyComplete = trainingInfo?.filter(t => t.competency_assessment_complete).length || 0;

    return {
      title: 'Training Report',
      dateRange: `${format(start, 'MMM d, yyyy')} - ${format(end, 'MMM d, yyyy')}`,
      summary: {
        totalSites: trainingInfo?.length || 0,
        trainingComplete: completedTraining,
        competencyComplete: competencyComplete,
        personnelTrained: trainedPersonnel?.filter(p => p.initial_training_complete).length || 0,
      },
      sites: trainingInfo?.map(t => ({
        site: t.facility?.name || '-',
        client: t.facility?.organization?.name || '-',
        trainingComplete: t.initial_training_complete ? 'Yes' : 'No',
        trainingDate: t.initial_training_date
          ? format(new Date(t.initial_training_date), 'MM/dd/yyyy')
          : '-',
        competencyComplete: t.competency_assessment_complete ? 'Yes' : 'No',
        competencyDate: t.competency_assessment_date
          ? format(new Date(t.competency_assessment_date), 'MM/dd/yyyy')
          : '-',
        trainer: t.trained_by_name || '-',
      })) || [],
      personnel: trainedPersonnel?.slice(0, 50).map(p => ({
        name: p.name,
        title: p.title || '-',
        site: p.facility?.name || '-',
        trainingComplete: p.initial_training_complete ? 'Yes' : 'No',
        competencyDue: p.annual_competency_due
          ? format(new Date(p.annual_competency_due), 'MM/dd/yyyy')
          : '-',
      })) || [],
    };
  };

  const exportToCSV = (data, reportId) => {
    let csvContent = '';
    let rows = [];

    const report = REPORTS.find(r => r.id === reportId);
    csvContent = `${report?.title}\n`;
    csvContent += `Date Range: ${data.dateRange}\n\n`;

    switch (reportId) {
      case 'compliance':
        rows = data.facilities.map(f => ({
          Site: f.name,
          Client: f.client,
          Location: f.location,
          'CLIA Status': f.cliaStatus,
          'CLIA Number': f.cliaNumber,
          'CLIA Expires': f.cliaExpires,
          'PT Enrolled': f.ptEnrolled,
          'PT Provider': f.ptProvider,
        }));
        break;
      case 'deployment':
        rows = data.facilities.map(f => ({
          Site: f.name,
          Client: f.client,
          Location: f.location,
          Status: f.status,
          Progress: f.progress,
          'Target Date': f.targetDate,
          'Go-Live Date': f.goLiveDate,
        }));
        break;
      case 'financial':
        rows = data.clients.map(c => ({
          Client: c.name,
          Type: c.type,
          'Active Sites': c.activeSites,
          'Total Sites': c.totalSites,
          MRR: `$${c.mrr}`,
          ACV: `$${c.acv}`,
          'Contract Status': c.contractStatus,
          'Contract End': c.contractEnd,
        }));
        break;
      case 'equipment':
        rows = data.equipment.map(e => ({
          Equipment: e.name,
          Type: e.type,
          Site: e.site,
          Client: e.client,
          Status: e.status,
          'Serial Number': e.serialNumber,
          'Installed Date': e.installedDate,
        }));
        break;
      case 'training':
        rows = data.sites.map(s => ({
          Site: s.site,
          Client: s.client,
          'Training Complete': s.trainingComplete,
          'Training Date': s.trainingDate,
          'Competency Complete': s.competencyComplete,
          'Competency Date': s.competencyDate,
          Trainer: s.trainer,
        }));
        break;
    }

    if (rows.length > 0) {
      const headers = Object.keys(rows[0]);
      csvContent += headers.join(',') + '\n';
      rows.forEach(row => {
        csvContent += headers.map(h => `"${row[h] || ''}"`).join(',') + '\n';
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${reportId}_report_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const exportToPDF = (data, reportId) => {
    setShowModal(true);
    setTimeout(() => {
      window.print();
    }, 500);
  };

  const closeModal = () => {
    setShowModal(false);
    setReportData(null);
    setSelectedReport(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Reports</h1>
        <p className="text-slate-400 text-sm mt-1">Generate and export operational reports</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {availableReports.map(report => {
          const Icon = report.icon;
          return (
            <div key={report.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${report.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white">{report.title}</h3>
                  <p className="text-slate-400 text-sm mt-1">{report.description}</p>
                </div>
              </div>

              <div className="space-y-3 mb-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Date Range</label>
                  <div className="relative">
                    <select
                      value={dateRange}
                      onChange={(e) => setDateRange(e.target.value)}
                      className="w-full appearance-none px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-teal-500 cursor-pointer"
                    >
                      {DATE_RANGES.map(range => (
                        <option key={range.id} value={range.id}>{range.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                {dateRange === 'custom' && (
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-teal-500"
                    />
                    <input
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-teal-500"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Output Format</label>
                  <div className="relative">
                    <select
                      value={outputFormat}
                      onChange={(e) => setOutputFormat(e.target.value)}
                      className="w-full appearance-none px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-teal-500 cursor-pointer"
                    >
                      {FORMATS.map(fmt => (
                        <option key={fmt.id} value={fmt.id}>{fmt.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <button
                onClick={() => generateReport(report.id)}
                disabled={generating && selectedReport === report.id}
                className="w-full py-2.5 bg-teal-500 text-slate-900 rounded-lg hover:bg-teal-400 transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {generating && selectedReport === report.id ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    Generate Report
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {showModal && reportData && (
        <ReportViewerModal data={reportData} onClose={closeModal} />
      )}
    </div>
  );
}

function ReportViewerModal({ data, onClose }) {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusBadge = (status) => {
    const styles = {
      active: 'bg-green-500/10 text-green-400',
      in_progress: 'bg-amber-500/10 text-amber-400',
      blocked: 'bg-red-500/10 text-red-400',
      not_started: 'bg-slate-500/10 text-slate-400',
      completed: 'bg-green-500/10 text-green-400',
      open: 'bg-blue-500/10 text-blue-400',
      closed: 'bg-slate-500/10 text-slate-400',
    };
    return styles[status] || 'bg-slate-500/10 text-slate-400';
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 print:p-0 print:bg-white">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col print:max-w-none print:max-h-none print:rounded-none print:border-none print:bg-white">
        <div className="flex items-center justify-between p-6 border-b border-slate-700 print:border-slate-300">
          <div>
            <h2 className="text-xl font-semibold text-white print:text-slate-900">{data.title}</h2>
            <p className="text-slate-400 text-sm print:text-slate-600">{data.dateRange}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors print:hidden"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 print:overflow-visible">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {Object.entries(data.summary).map(([key, value]) => (
              <div key={key} className="bg-slate-700/30 rounded-lg p-4 print:bg-slate-100">
                <p className="text-2xl font-bold text-white print:text-slate-900">
                  {key.includes('MRR') || key.includes('ACV') || key.includes('Revenue')
                    ? formatCurrency(value)
                    : value}
                </p>
                <p className="text-xs text-slate-400 print:text-slate-600 capitalize">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </p>
              </div>
            ))}
          </div>

          {data.facilities && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white print:text-slate-900 mb-3">Sites</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 print:border-slate-300">
                      {Object.keys(data.facilities[0] || {}).map(key => (
                        <th key={key} className="px-3 py-2 text-left text-xs font-medium text-slate-400 print:text-slate-600 uppercase">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700 print:divide-slate-300">
                    {data.facilities.map((row, idx) => (
                      <tr key={idx}>
                        {Object.entries(row).map(([key, value], i) => (
                          <td key={i} className="px-3 py-2 text-white print:text-slate-900">
                            {key === 'status' ? (
                              <span className={`px-2 py-0.5 rounded text-xs ${getStatusBadge(value)}`}>
                                {value}
                              </span>
                            ) : value}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {data.clients && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white print:text-slate-900 mb-3">Clients</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 print:border-slate-300">
                      {Object.keys(data.clients[0] || {}).map(key => (
                        <th key={key} className="px-3 py-2 text-left text-xs font-medium text-slate-400 print:text-slate-600 uppercase">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700 print:divide-slate-300">
                    {data.clients.map((row, idx) => (
                      <tr key={idx}>
                        {Object.entries(row).map(([key, value], i) => (
                          <td key={i} className="px-3 py-2 text-white print:text-slate-900">
                            {key === 'mrr' || key === 'acv' ? formatCurrency(value) : value}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {data.equipment && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white print:text-slate-900 mb-3">Equipment</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 print:border-slate-300">
                      {Object.keys(data.equipment[0] || {}).map(key => (
                        <th key={key} className="px-3 py-2 text-left text-xs font-medium text-slate-400 print:text-slate-600 uppercase">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700 print:divide-slate-300">
                    {data.equipment.map((row, idx) => (
                      <tr key={idx}>
                        {Object.entries(row).map(([key, value], i) => (
                          <td key={i} className="px-3 py-2 text-white print:text-slate-900">{value}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {data.sites && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white print:text-slate-900 mb-3">Training Status by Site</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 print:border-slate-300">
                      {Object.keys(data.sites[0] || {}).map(key => (
                        <th key={key} className="px-3 py-2 text-left text-xs font-medium text-slate-400 print:text-slate-600 uppercase">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700 print:divide-slate-300">
                    {data.sites.map((row, idx) => (
                      <tr key={idx}>
                        {Object.entries(row).map(([key, value], i) => (
                          <td key={i} className="px-3 py-2 text-white print:text-slate-900">{value}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {data.deficiencies && data.deficiencies.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white print:text-slate-900 mb-3">Deficiencies</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 print:border-slate-300">
                      {Object.keys(data.deficiencies[0] || {}).map(key => (
                        <th key={key} className="px-3 py-2 text-left text-xs font-medium text-slate-400 print:text-slate-600 uppercase">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700 print:divide-slate-300">
                    {data.deficiencies.map((row, idx) => (
                      <tr key={idx}>
                        {Object.entries(row).map(([key, value], i) => (
                          <td key={i} className="px-3 py-2 text-white print:text-slate-900">
                            {key === 'status' ? (
                              <span className={`px-2 py-0.5 rounded text-xs ${getStatusBadge(value)}`}>
                                {value}
                              </span>
                            ) : key === 'severity' ? (
                              <span className={`px-2 py-0.5 rounded text-xs ${
                                value === 'critical' ? 'bg-red-500/10 text-red-400' :
                                value === 'high' ? 'bg-orange-500/10 text-orange-400' :
                                'bg-slate-500/10 text-slate-400'
                              }`}>
                                {value}
                              </span>
                            ) : value}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {data.blockedItems && data.blockedItems.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white print:text-slate-900 mb-3">Blocked Items</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700 print:border-slate-300">
                      {Object.keys(data.blockedItems[0] || {}).map(key => (
                        <th key={key} className="px-3 py-2 text-left text-xs font-medium text-slate-400 print:text-slate-600 uppercase">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700 print:divide-slate-300">
                    {data.blockedItems.map((row, idx) => (
                      <tr key={idx}>
                        {Object.entries(row).map(([key, value], i) => (
                          <td key={i} className="px-3 py-2 text-white print:text-slate-900">{value}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-700 print:hidden">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
          >
            Close
          </button>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-teal-500 text-slate-900 rounded-lg hover:bg-teal-400 transition-colors font-medium flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            Print Report
          </button>
        </div>
      </div>
    </div>
  );
}
