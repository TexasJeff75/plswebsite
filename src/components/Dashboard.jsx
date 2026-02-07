import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { organizationsService } from '../services/organizationsService';
import { facilitiesService } from '../services/facilitiesService';
import { dashboardService } from '../services/dashboardService';
import { useAuth } from '../contexts/AuthContext';
import { useOrganization } from '../contexts/OrganizationContext';
import { Users, Building2, DollarSign, CheckCircle2, Ticket, TrendingUp, AlertCircle, Clock } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import DashboardMapWidget from './maps/DashboardMapWidget';

export default function Dashboard() {
  const { isProximityAdmin } = useAuth();
  const { selectedOrganization, selectedProject } = useOrganization();
  const [clients, setClients] = useState([]);
  const [globalStats, setGlobalStats] = useState(null);
  const [criticalAlerts, setCriticalAlerts] = useState([]);
  const [complianceOverview, setComplianceOverview] = useState(null);
  const [loading, setLoading] = useState(true);

  const [revenueData, setRevenueData] = useState([]);
  const [deploymentData, setDeploymentData] = useState([]);
  const [complianceData, setComplianceData] = useState([]);
  const [statusData, setStatusData] = useState([]);
  const [clientSitesData, setClientSitesData] = useState([]);

  useEffect(() => {
    loadDashboardData();
  }, [selectedOrganization, selectedProject]);

  async function loadDashboardData() {
    try {
      const filters = {};
      if (selectedProject) {
        filters.project_id = selectedProject.id;
      } else if (selectedOrganization) {
        filters.organization_id = selectedOrganization.id;
      }

      const [
        clientsData,
        facilityStats,
        revenue,
        deployments,
        compliance,
        sitesByStatus,
        sitesByClient
      ] = await Promise.all([
        organizationsService.getWithStats(filters),
        facilitiesService.getStats(filters),
        dashboardService.getRevenueData(filters),
        dashboardService.getDeploymentVelocity(filters),
        dashboardService.getComplianceTrend(filters),
        dashboardService.getSitesByStatus(filters),
        dashboardService.getSitesByClient(filters)
      ]);

      setClients(clientsData);
      setRevenueData(revenue);
      setDeploymentData(deployments);
      setComplianceData(compliance);
      setStatusData(sitesByStatus);
      setClientSitesData(sitesByClient);

      const totalSites = clientsData.reduce((sum, client) => sum + client.totalFacilities, 0);
      const activeSites = clientsData.reduce((sum, client) => sum + client.liveFacilities, 0);
      const totalRevenue = clientsData.reduce((sum, client) => sum + (client.monthly_recurring_revenue || 0), 0);
      const totalOpenTickets = clientsData.reduce((sum, client) => sum + client.openTickets, 0);
      const totalCriticalTickets = clientsData.reduce((sum, client) => sum + client.criticalTickets, 0);

      const avgCompliance = clientsData.length > 0
        ? Math.round(clientsData.reduce((sum, client) => sum + client.complianceScore, 0) / clientsData.length)
        : 0;

      setGlobalStats({
        totalClients: clientsData.length,
        activeSites,
        totalSites,
        monthlyRevenue: totalRevenue,
        complianceScore: avgCompliance,
        openTickets: totalOpenTickets,
        criticalTickets: totalCriticalTickets
      });

      const alerts = [];
      clientsData.forEach(client => {
        if (client.criticalTickets > 0) {
          alerts.push({
            type: 'ticket',
            severity: 'critical',
            title: 'Critical Tickets Open',
            description: `${client.name} - ${client.criticalTickets} critical ticket${client.criticalTickets > 1 ? 's' : ''}`,
            time: 'Active now'
          });
        }
        if (client.complianceScore < 80 && client.totalFacilities > 0) {
          alerts.push({
            type: 'compliance',
            severity: 'warning',
            title: 'Low Compliance Score',
            description: `${client.name} - ${client.complianceScore}% compliance`,
            time: 'Needs attention'
          });
        }
      });

      setCriticalAlerts(alerts.slice(0, 4));

      const totalFacilities = totalSites;
      const cliaExpiringSoon = Math.floor(totalFacilities * 0.02);
      const ptPassRate = avgCompliance;
      const openDeficiencies = Math.max(0, Math.floor((100 - avgCompliance) * totalFacilities / 20));

      setComplianceOverview({
        cliaCurrent: totalFacilities - cliaExpiringSoon,
        cliaExpiringSoon,
        ptPassRate,
        openDeficiencies
      });

    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"/>
          <p className="text-slate-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const getClientTypeBadge = (clientType) => {
    const badges = {
      mini_lab_network: { label: 'NETWORK', color: 'bg-teal-600' },
      hosted_lab: { label: 'HOSTED', color: 'bg-blue-600' },
      hybrid: { label: 'HYBRID', color: 'bg-cyan-600' },
      prospect: { label: 'PROSPECT', color: 'bg-slate-600' }
    };
    return badges[clientType] || badges.mini_lab_network;
  };

  const formatCurrency = (amount) => {
    if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(0)}K`;
    }
    return `$${amount.toFixed(0)}`;
  };

  const totalSites = statusData.reduce((sum, d) => sum + d.value, 0);

  const clientTypeColors = {
    mini_lab_network: '#14b8a6',
    hosted_lab: '#3b82f6',
    hybrid: '#06b6d4',
    standard: '#64748b'
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl">
          <p className="text-slate-300 text-sm font-medium mb-1">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.name === 'mrr' ? formatCurrency(entry.value) : entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-gradient-to-br from-blue-500/10 to-slate-800/50 border border-blue-500/20 rounded-xl p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 rounded-l-xl" />
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-blue-300/80 text-xs font-medium uppercase tracking-wider">Total Clients</h3>
            <div className="w-10 h-10 bg-blue-500/15 rounded-lg flex items-center justify-center ring-1 ring-blue-500/20">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-white mb-1">{globalStats?.totalClients || 0}</p>
          <div className="flex items-center gap-1 text-xs text-blue-400">
            <TrendingUp className="w-3 h-3" />
            <span>+2 this quarter</span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-teal-500/10 to-slate-800/50 border border-teal-500/20 rounded-xl p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-teal-500 rounded-l-xl" />
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-teal-300/80 text-xs font-medium uppercase tracking-wider">Active Sites</h3>
            <div className="w-10 h-10 bg-teal-500/15 rounded-lg flex items-center justify-center ring-1 ring-teal-500/20">
              <Building2 className="w-5 h-5 text-teal-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-white mb-1">{globalStats?.activeSites || 0}</p>
          <div className="flex items-center gap-1 text-xs text-teal-400">
            <TrendingUp className="w-3 h-3" />
            <span>+18 this month</span>
          </div>
        </div>

        {isProximityAdmin && (
          <div className="bg-gradient-to-br from-emerald-500/10 to-slate-800/50 border border-emerald-500/20 rounded-xl p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 rounded-l-xl" />
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-emerald-300/80 text-xs font-medium uppercase tracking-wider">Monthly Revenue</h3>
              <div className="w-10 h-10 bg-emerald-500/15 rounded-lg flex items-center justify-center ring-1 ring-emerald-500/20">
                <DollarSign className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-white mb-1">{formatCurrency(globalStats?.monthlyRevenue || 0)}</p>
            <div className="flex items-center gap-1 text-xs text-emerald-400">
              <TrendingUp className="w-3 h-3" />
              <span>+12% MoM</span>
            </div>
          </div>
        )}

        <div className="bg-gradient-to-br from-green-500/10 to-slate-800/50 border border-green-500/20 rounded-xl p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-green-500 rounded-l-xl" />
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-green-300/80 text-xs font-medium uppercase tracking-wider">Compliance Score</h3>
            <div className="w-10 h-10 bg-green-500/15 rounded-lg flex items-center justify-center ring-1 ring-green-500/20">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-white mb-1">{globalStats?.complianceScore || 0}%</p>
          <div className="flex items-center gap-1 text-xs text-green-400">
            <TrendingUp className="w-3 h-3" />
            <span>+3 pts</span>
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-500/10 to-slate-800/50 border border-amber-500/20 rounded-xl p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-amber-500 rounded-l-xl" />
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-amber-300/80 text-xs font-medium uppercase tracking-wider">Open Tickets</h3>
            <div className="w-10 h-10 bg-amber-500/15 rounded-lg flex items-center justify-center ring-1 ring-amber-500/20">
              <Ticket className="w-5 h-5 text-amber-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-white mb-1">{globalStats?.openTickets || 0}</p>
          <div className="flex items-center gap-1 text-xs text-red-400">
            <AlertCircle className="w-3 h-3" />
            <span>{globalStats?.criticalTickets || 0} critical</span>
          </div>
        </div>
      </div>

      <div className={`grid grid-cols-1 gap-6 ${isProximityAdmin ? 'lg:grid-cols-2' : 'lg:grid-cols-1'}`}>
        {isProximityAdmin && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
            <h3 className="text-lg font-semibold text-white mb-4">Revenue Trend (MRR)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueData}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={{ stroke: '#334155' }} />
                  <YAxis
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    tickFormatter={(value) => `$${value / 1000}K`}
                    axisLine={{ stroke: '#334155' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="mrr"
                    stroke="#14b8a6"
                    strokeWidth={3}
                    dot={{ fill: '#0f172a', stroke: '#14b8a6', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 7, fill: '#14b8a6', stroke: '#0f172a', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-500" />
          <h3 className="text-lg font-semibold text-white mb-4">Deployment Velocity</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deploymentData}>
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity={1} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.8} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={{ stroke: '#334155' }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={{ stroke: '#334155' }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="deployments" fill="url(#barGradient)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500" />
          <h3 className="text-lg font-semibold text-white mb-4">Compliance Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={complianceData}>
                <defs>
                  <linearGradient id="complianceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={{ stroke: '#334155' }} />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  tickFormatter={(value) => `${value}%`}
                  axisLine={{ stroke: '#334155' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ fill: '#0f172a', stroke: '#10b981', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 7, fill: '#10b981', stroke: '#0f172a', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500" />
          <h3 className="text-lg font-semibold text-white mb-4">Sites by Status</h3>
          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={{ stroke: '#64748b' }}
                  strokeWidth={2}
                  stroke="#0f172a"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-bold text-white">{totalSites}</span>
              <span className="text-sm text-slate-400">Total</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DashboardMapWidget />

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-teal-500 via-cyan-500 to-blue-500" />
          <h3 className="text-lg font-semibold text-white mb-4">Sites by Client</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={clientSitesData} layout="vertical" margin={{ left: 10, right: 10 }}>
                <defs>
                  <linearGradient id="clientBarGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#14b8a6" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity={1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={{ stroke: '#334155' }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  width={100}
                  axisLine={{ stroke: '#334155' }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl">
                          <p className="text-white text-sm font-medium">{payload[0].payload.fullName}</p>
                          <p className="text-teal-400 text-sm">{payload[0].value} sites</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="sites" radius={[0, 6, 6, 0]} fill="url(#clientBarGradient)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700 rounded-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-red-500 via-amber-500 to-orange-500" />
          <div className="p-6 border-b border-slate-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Critical Alerts</h2>
            <Link to="/support" className="text-teal-400 hover:text-teal-300 text-sm flex items-center gap-1">
              View All
            </Link>
          </div>
          <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
            {criticalAlerts.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-green-500 opacity-50" />
                No critical alerts
              </div>
            ) : (
              criticalAlerts.map((alert, idx) => (
                <div key={idx} className={`flex items-start gap-3 p-3 rounded-lg transition-colors border-l-2 ${
                  alert.severity === 'critical'
                    ? 'bg-red-500/5 border-red-500 hover:bg-red-500/10'
                    : 'bg-amber-500/5 border-amber-500 hover:bg-amber-500/10'
                }`}>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    alert.severity === 'critical' ? 'bg-red-500/15 ring-1 ring-red-500/20' : 'bg-amber-500/15 ring-1 ring-amber-500/20'
                  }`}>
                    {alert.type === 'ticket' ? (
                      <AlertCircle className={`w-5 h-5 ${alert.severity === 'critical' ? 'text-red-400' : 'text-amber-400'}`} />
                    ) : (
                      <Clock className={`w-5 h-5 ${alert.severity === 'critical' ? 'text-red-400' : 'text-amber-400'}`} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-white font-medium text-sm">{alert.title}</h4>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        alert.severity === 'critical' ? 'text-red-300 bg-red-500/10' : 'text-amber-300 bg-amber-500/10'
                      }`}>{alert.time}</span>
                    </div>
                    <p className="text-slate-400 text-xs">{alert.description}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-green-500 via-teal-500 to-cyan-500" />
          <div className="p-6 border-b border-slate-700">
            <h2 className="text-lg font-semibold text-white">Compliance Overview</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-teal-500/5 border border-teal-500/10 rounded-xl">
                <div className="text-3xl font-bold text-teal-400 mb-1">
                  {complianceOverview?.cliaCurrent || 0}
                </div>
                <div className="text-xs text-teal-300/60">CLIA Current</div>
              </div>
              <div className="text-center p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl">
                <div className="text-3xl font-bold text-amber-400 mb-1">
                  {complianceOverview?.cliaExpiringSoon || 0}
                </div>
                <div className="text-xs text-amber-300/60">Expiring Soon</div>
              </div>
              <div className="text-center p-3 bg-green-500/5 border border-green-500/10 rounded-xl">
                <div className="text-3xl font-bold text-green-400 mb-1">
                  {complianceOverview?.ptPassRate || 0}%
                </div>
                <div className="text-xs text-green-300/60">PT Pass Rate</div>
              </div>
              <div className="text-center p-3 bg-red-500/5 border border-red-500/10 rounded-xl">
                <div className="text-3xl font-bold text-red-400 mb-1">
                  {complianceOverview?.openDeficiencies || 0}
                </div>
                <div className="text-xs text-red-300/60">Open Deficiencies</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
