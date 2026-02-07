import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useOrganization } from '../contexts/OrganizationContext';
import { supportService } from '../services/supportService';
import NotificationBell from './NotificationBell';

export default function Layout() {
  const { user, profile, signOut } = useAuth();
  const {
    accessibleOrganizations,
    selectedOrganization,
    setSelectedOrganization,
    accessibleProjects,
    selectedProject,
    setSelectedProject,
    isInternalUser,
    hasSingleOrg,
    isLoading: orgLoading
  } = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openTicketsCount, setOpenTicketsCount] = useState(0);

  useEffect(() => {
    loadTicketCount();
  }, [location.pathname]);

  async function loadTicketCount() {
    try {
      const stats = await supportService.getStats();
      setOpenTicketsCount(stats.open);
    } catch (error) {
      console.error('Error loading ticket count:', error);
    }
  }

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const navItems = [
    { path: '/tracker', label: 'Tracker', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
      </svg>
    )},
    { path: '/dashboard', label: 'Dashboard', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
      </svg>
    )},
  ];

  navItems.push({
    path: '/projects',
    label: 'Projects',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
      </svg>
    )
  });

  if (['Proximity Admin', 'Proximity Staff'].includes(profile?.role)) {
    navItems.push({
      path: '/organizations',
      label: 'Organizations',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
        </svg>
      )
    });
  }

  navItems.push(
    { path: '/facilities', label: 'Facilities', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h4a1 1 0 011 1v5m-6 0h6"/>
      </svg>
    )},
    { path: '/support', label: 'Support', badge: openTicketsCount, icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"/>
      </svg>
    )},
    { path: '/reports', label: 'Reports', icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
      </svg>
    )}
  );

  const isAdmin = ['Proximity Admin', 'Proximity Staff', 'Customer Admin'].includes(profile?.role);

  if (isAdmin) {
    navItems.push({
      path: '/documents',
      label: 'Documents',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
        </svg>
      )
    });
    navItems.push({
      path: '/users',
      label: 'Users',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>
        </svg>
      )
    });
  }

  if (['Proximity Admin', 'Proximity Staff'].includes(profile?.role)) {
    navItems.push({
      path: '/settings',
      label: 'Settings',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>
      )
    });
  }

  return (
    <div className="min-h-screen bg-slate-900 flex">
      <aside className={`${sidebarCollapsed ? 'w-16' : 'w-64'} bg-gradient-to-b from-slate-800 to-slate-850 border-r border-slate-700 flex flex-col transition-all duration-300 fixed h-full z-30`}>
        <div className="p-4 border-b border-slate-700/80 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2">
            <img
              src="/deployment_logo_animated.svg"
              alt="Deployment Tracker"
              className="w-8 h-8 flex-shrink-0"
            />
            {!sidebarCollapsed && (
              <span className="text-white font-semibold text-sm">Deployment Tracker</span>
            )}
          </Link>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <svg className={`w-5 h-5 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7"/>
            </svg>
          </button>
        </div>

        {!sidebarCollapsed && selectedOrganization && (
          <div className="px-3 py-2 border-b border-slate-700">
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-700/30 rounded-lg">
              <svg className="w-4 h-4 text-teal-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
              </svg>
              <span className="text-sm text-white truncate">{selectedOrganization.name}</span>
            </div>
          </div>
        )}

        {!sidebarCollapsed && selectedOrganization && accessibleProjects.length > 0 && (
          <div className="px-3 py-2 border-b border-slate-700">
            <div className="relative">
              <button
                onClick={() => setShowProjectMenu(!showProjectMenu)}
                className="w-full flex items-center justify-between px-3 py-2 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
                  </svg>
                  <span className="text-sm text-white truncate">{selectedProject?.name || 'All Projects'}</span>
                </div>
                <svg className={`w-4 h-4 text-slate-400 transition-transform ${showProjectMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
                </svg>
              </button>

              {showProjectMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowProjectMenu(false)} />
                  <div className="absolute left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
                    <button
                      onClick={() => {
                        setSelectedProject(null);
                        setShowProjectMenu(false);
                      }}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-700 transition-colors truncate border-b border-slate-700 ${
                        !selectedProject ? 'bg-teal-500/10 text-teal-400' : 'text-slate-300'
                      }`}
                    >
                      All Projects
                    </button>
                    {accessibleProjects.map(project => (
                      <button
                        key={project.id}
                        onClick={() => {
                          setSelectedProject(project);
                          setShowProjectMenu(false);
                        }}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-700 transition-colors truncate ${
                          selectedProject?.id === project.id ? 'bg-teal-500/10 text-teal-400' : 'text-slate-300'
                        }`}
                      >
                        {project.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(item => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 relative group ${
                  isActive
                    ? 'bg-teal-500/10 text-teal-400 shadow-sm shadow-teal-500/5'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/60'
                }`}
                title={sidebarCollapsed ? item.label : undefined}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-teal-400 rounded-r" />
                )}
                <span className={`flex-shrink-0 transition-transform duration-200 ${isActive ? '' : 'group-hover:scale-110'}`}>{item.icon}</span>
                {!sidebarCollapsed && (
                  <>
                    <span className="text-sm font-medium">{item.label}</span>
                    {item.badge > 0 && (
                      <span className="ml-auto px-1.5 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full min-w-[20px] text-center animate-pulse">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
                {sidebarCollapsed && item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full min-w-[18px] text-center animate-pulse">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-700">
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-700 transition-colors ${sidebarCollapsed ? 'justify-center' : ''}`}
            >
              <div className="w-8 h-8 bg-teal-500 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-slate-900 font-semibold text-sm">
                  {(user?.user_metadata?.full_name || user?.email || 'U')[0].toUpperCase()}
                </span>
              </div>
              {!sidebarCollapsed && (
                <div className="text-left flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {user?.user_metadata?.full_name || user?.email}
                  </p>
                  <p className="text-xs text-slate-400 truncate">{profile?.role || 'User'}</p>
                </div>
              )}
            </button>

            {showUserMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowUserMenu(false)}
                />
                <div className={`absolute ${sidebarCollapsed ? 'left-full ml-2' : 'left-0'} bottom-full mb-2 w-56 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50`}>
                  <div className="p-4 border-b border-slate-700">
                    <p className="text-sm font-medium text-white truncate">
                      {user?.user_metadata?.full_name || user?.email}
                    </p>
                    <p className="text-xs text-slate-400 mt-1 truncate">{user?.email}</p>
                    <p className="text-xs text-teal-400 mt-1">
                      Role: {profile?.role || 'Viewer'}
                    </p>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="w-full px-4 py-3 text-left text-red-400 hover:bg-slate-700 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                    </svg>
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </aside>

      <div className={`flex-1 ${sidebarCollapsed ? 'ml-16' : 'ml-64'} transition-all duration-300`}>
        <header className="bg-slate-800/95 backdrop-blur-sm border-b border-slate-700/80 h-14 flex items-center justify-between px-6 sticky top-0 z-20">
          <div className="flex items-center gap-2">
            {sidebarCollapsed && selectedOrganization && (
              <span className="text-sm text-slate-400">
                {selectedOrganization.name}
              </span>
            )}
          </div>
          <NotificationBell />
        </header>

        <main className={location.pathname === '/tracker' ? '' : 'p-6'}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
