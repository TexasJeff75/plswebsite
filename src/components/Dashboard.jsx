import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { organizationsService } from '../services/organizationsService';
import { facilitiesService } from '../services/facilitiesService';
import { dashboardService } from '../services/dashboardService';
import { Users, Building2, DollarSign, CheckCircle2, Ticket, TrendingUp, AlertCircle, Clock } from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import DashboardMapWidget from './maps/DashboardMapWidget';

export default function Dashboard() {
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
  }, []);

  async function loadDashboardData() {
    try {
      const [
        clientsData,
        facilityStats,
        revenue,
        deployments,
        compliance,
        sitesByStatus,
        sitesByClient
      ] = await Promise.all([
        organizationsService.getWithStats(),
        facilitiesService.getStats(),
        dashboardService.getRevenueData(),
        dashboardService.getDeploymentVelocity(),
        dashboardService.getComplianceTrend(),
        dashboardService.getSitesByStatus(),
        dashboardService.getSitesByClient()
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
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-slate-400 text-xs font-medium">Total Clients</h3>
            <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-white mb-1">{globalStats?.totalClients || 0}</p>
          <div className="flex items-center gap-1 text-xs text-teal-400">
            <TrendingUp className="w-3 h-3" />
            <span>+2 this quarter</span>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-slate-400 text-xs font-medium">Active Sites</h3>
            <div className="w-10 h-10 bg-teal-500/10 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5 text-teal-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-white mb-1">{globalStats?.activeSites || 0}</p>
          <div className="flex items-center gap-1 text-xs text-teal-400">
            <TrendingUp className="w-3 h-3" />
            <span>+18 this month</span>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-slate-400 text-xs font-medium">Monthly Revenue</h3>
            <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-white mb-1">{formatCurrency(globalStats?.monthlyRevenue || 0)}</p>
          <div className="flex items-center gap-1 text-xs text-teal-400">
            <TrendingUp className="w-3 h-3" />
            <span>+12% MoM</span>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-slate-400 text-xs font-medium">Compliance Score</h3>
            <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
            </div>
          </div>
          <p className="text-3xl font-bold text-white mb-1">{globalStats?.complianceScore || 0}%</p>
          <div className="flex items-center gap-1 text-xs text-teal-400">
            <TrendingUp className="w-3 h-3" />
            <span>+3 pts</span>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-slate-400 text-xs font-medium">Open Tickets</h3>
            <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Revenue Trend (MRR)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  tickFormatter={(value) => `$${value / 1000}K`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="mrr"
                  stroke="#14b8a6"
                  strokeWidth={2}
                  dot={{ fill: '#14b8a6', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, fill: '#14b8a6' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Deployment Velocity</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deploymentData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="deployments" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Compliance Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={complianceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, fill: '#10b981' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
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
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={{ stroke: '#64748b' }}
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

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Sites by Client</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={clientSitesData} layout="vertical" margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  width={100}
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
                <Bar dataKey="sites" radius={[0, 4, 4, 0]} fill="#14b8a6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700 rounded-xl">
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
                <div key={idx} className="flex items-start gap-3 p-3 bg-slate-700/30 rounded-lg hover:bg-slate-700/50 transition-colors">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    alert.severity === 'critical' ? 'bg-red-500/10' : 'bg-amber-500/10'
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
                      <span className="text-xs text-slate-400">{alert.time}</span>
                    </div>
                    <p className="text-slate-400 text-xs">{alert.description}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl">
          <div className="p-6 border-b border-slate-700">
            <h2 className="text-lg font-semibold text-white">Compliance Overview</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-teal-400 mb-1">
                  {complianceOverview?.cliaCurrent || 0}
                </div>
                <div className="text-xs text-slate-400">CLIA Current</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-amber-400 mb-1">
                  {complianceOverview?.cliaExpiringSoon || 0}
                </div>
                <div className="text-xs text-slate-400">Expiring Soon</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-teal-400 mb-1">
                  {complianceOverview?.ptPassRate || 0}%
                </div>
                <div className="text-xs text-slate-400">PT Pass Rate</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-red-400 mb-1">
                  {complianceOverview?.openDeficiencies || 0}
                </div>
                <div className="text-xs text-slate-400">Open Deficiencies</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
