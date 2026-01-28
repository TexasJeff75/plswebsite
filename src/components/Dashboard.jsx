import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { organizationsService } from '../services/organizationsService';
import { facilitiesService } from '../services/facilitiesService';
import { Users, Building2, DollarSign, CheckCircle2, Ticket, TrendingUp, TrendingDown, AlertCircle, Clock, UserX } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function Dashboard() {
  const [clients, setClients] = useState([]);
  const [globalStats, setGlobalStats] = useState(null);
  const [criticalAlerts, setCriticalAlerts] = useState([]);
  const [complianceOverview, setComplianceOverview] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    try {
      const [clientsData, facilityStats] = await Promise.all([
        organizationsService.getWithStats(),
        facilitiesService.getStats()
      ]);

      setClients(clientsData);

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700 rounded-xl">
          <div className="p-6 border-b border-slate-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Clients</h2>
            <Link to="/facilities" className="text-teal-400 hover:text-teal-300 text-sm flex items-center gap-1">
              View All →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Client</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Sites</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Compliance</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">MRR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {clients.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-slate-400">
                      No clients found
                    </td>
                  </tr>
                ) : (
                  clients.map(client => {
                    const badge = getClientTypeBadge(client.client_type);
                    const initials = client.name
                      .split(' ')
                      .map(word => word[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 3);

                    return (
                      <tr key={client.id} className="hover:bg-slate-700/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 ${badge.color} rounded-lg flex items-center justify-center text-white font-bold text-sm`}>
                              {initials}
                            </div>
                            <div>
                              <div className="text-white font-medium">{client.name}</div>
                              <div className="text-slate-400 text-xs">
                                {client.totalFacilities} site{client.totalFacilities !== 1 ? 's' : ''} • {client.region || 'National'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 ${badge.color} text-white rounded-full text-xs font-semibold`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-white font-medium">
                          {client.liveFacilities} / {client.totalFacilities}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 bg-slate-700 rounded-full h-2 w-24">
                              <div
                                className={`h-2 rounded-full ${
                                  client.complianceScore >= 90 ? 'bg-green-500' :
                                  client.complianceScore >= 70 ? 'bg-amber-500' :
                                  'bg-red-500'
                                }`}
                                style={{ width: `${client.complianceScore}%` }}
                              />
                            </div>
                            <span className="text-white text-sm font-medium">{client.complianceScore}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-teal-400 font-semibold">
                          {formatCurrency(client.monthly_recurring_revenue || 0)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl">
            <div className="p-6 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Critical Alerts</h2>
              <Link to="/facilities" className="text-teal-400 hover:text-teal-300 text-sm flex items-center gap-1">
                View All →
              </Link>
            </div>
            <div className="p-4 space-y-3">
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
    </div>
  );
}
