import React, { Component } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import Login from './components/Login';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Facilities from './components/Facilities';
import FacilityDetail from './components/FacilityDetail';
import DeploymentTrackerMap from './components/DeploymentTrackerMap';
import Users from './components/Users';
import ProtectedRoute from './components/ProtectedRoute';
import './index.css';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('React Error Boundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a', color: 'white', padding: '2rem' }}>
          <div style={{ maxWidth: '500px', textAlign: 'center' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem' }}>Something went wrong</h1>
            <p style={{ color: '#94a3b8', marginBottom: '1rem' }}>The application encountered an error. Please check the console for details.</p>
            <pre style={{ backgroundColor: '#1e293b', padding: '1rem', borderRadius: '0.5rem', textAlign: 'left', overflow: 'auto', fontSize: '0.875rem' }}>
              {this.state.error?.toString()}
            </pre>
            <button
              onClick={() => window.location.reload()}
              style={{ marginTop: '1rem', backgroundColor: '#00d4aa', color: '#0f172a', padding: '0.5rem 1rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', fontWeight: '600' }}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
});

function App() {
  console.log('Tracker App: Mounting');

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <HashRouter>
            <Routes>
              <Route path="/login" element={<Login />} />

              <Route path="/" element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }>
                <Route index element={<Navigate to="/tracker" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="facilities" element={<Facilities />} />
                <Route path="facilities/:id" element={<FacilityDetail />} />
                <Route path="tracker" element={<DeploymentTrackerMap />} />
                <Route path="users" element={
                  <ProtectedRoute requireAdmin>
                    <Users />
                  </ProtectedRoute>
                } />
              </Route>

              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </HashRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

console.log('Tracker App: Script loaded, initializing...');

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error('Root element not found!');
} else {
  console.log('Root element found, creating React root...');
  try {
    const root = createRoot(rootElement);
    console.log('React root created, rendering app...');
    root.render(<App />);
    console.log('App render initiated');
  } catch (error) {
    console.error('Failed to initialize React app:', error);
    rootElement.innerHTML = `
      <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background-color: #0f172a; color: white; padding: 2rem;">
        <div style="max-width: 500px; text-align: center;">
          <h1 style="font-size: 2rem; font-weight: bold; margin-bottom: 1rem;">Initialization Error</h1>
          <p style="color: #94a3b8; margin-bottom: 1rem;">Failed to start the application. Check console for details.</p>
          <pre style="background-color: #1e293b; padding: 1rem; border-radius: 0.5rem; text-align: left; overflow: auto; font-size: 0.875rem;">${error.toString()}</pre>
        </div>
      </div>
    `;
  }
}
