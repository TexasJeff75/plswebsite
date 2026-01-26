import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { LayoutDashboard, Building2, Map, Calendar, LogOut, User } from 'lucide-react';

export default function DashboardLayout() {
  const { user, signOut } = useAuth();

  const navigation = [
    { name: 'Overview', to: '/', icon: LayoutDashboard },
    { name: 'Facilities', to: '/facilities', icon: Building2 },
    { name: 'Map View', to: '/map', icon: Map },
    { name: 'Timeline', to: '/timeline', icon: Calendar },
  ];

  return (
    <div className="min-h-screen bg-slate-950">
      <nav className="bg-slate-900 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-teal-400/10 rounded-lg flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-teal-400" />
                </div>
                <span className="text-white font-bold text-lg">Deployment Tracker</span>
              </div>

              <div className="hidden md:flex items-center gap-2">
                {navigation.map((item) => (
                  <NavLink
                    key={item.name}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-teal-400/10 text-teal-400'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`
                    }
                  >
                    <item.icon className="w-4 h-4" />
                    {item.name}
                  </NavLink>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-slate-400">
                <User className="w-4 h-4" />
                <span className="text-sm hidden sm:inline">{user?.email}</span>
              </div>
              <button
                onClick={() => signOut()}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
