import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

const OrganizationContext = createContext(null);

const SELECTED_ORG_KEY = 'selectedOrganizationId';
const SELECTED_PROJECT_KEY = 'selectedProjectId';

export function OrganizationProvider({ children }) {
  const { user, profile } = useAuth();
  const [accessibleOrganizations, setAccessibleOrganizations] = useState([]);
  const [selectedOrganization, setSelectedOrganizationState] = useState(null);
  const [accessibleProjects, setAccessibleProjects] = useState([]);
  const [selectedProject, setSelectedProjectState] = useState(null);
  const [isInternalUser, setIsInternalUser] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userOrgAssignments, setUserOrgAssignments] = useState([]);

  const internalRoles = ['Proximity Admin', 'Proximity Staff', 'Account Manager', 'Technical Consultant', 'Compliance Specialist'];

  useEffect(() => {
    if (user && profile) {
      loadOrganizationAccess();
    } else {
      setAccessibleOrganizations([]);
      setSelectedOrganizationState(null);
      setAccessibleProjects([]);
      setSelectedProjectState(null);
      setIsInternalUser(false);
      setIsLoading(false);
    }
  }, [user, profile]);

  useEffect(() => {
    if (selectedOrganization) {
      loadProjectsForOrganization(selectedOrganization.id);
    } else {
      setAccessibleProjects([]);
      setSelectedProjectState(null);
    }
  }, [selectedOrganization]);

  async function loadOrganizationAccess() {
    setIsLoading(true);
    try {
      const isInternal = internalRoles.includes(profile?.role);
      setIsInternalUser(isInternal);

      if (isInternal) {
        const { data: orgs, error } = await supabase
          .from('organizations')
          .select('*')
          .order('name');

        if (error) throw error;
        setAccessibleOrganizations(orgs || []);

        const savedOrgId = localStorage.getItem(SELECTED_ORG_KEY);
        if (savedOrgId && orgs?.find(o => o.id === savedOrgId)) {
          setSelectedOrganizationState(orgs.find(o => o.id === savedOrgId));
        } else {
          setSelectedOrganizationState(null);
        }
      } else {
        const { data: assignments, error: assignError } = await supabase
          .from('user_organization_assignments')
          .select(`
            *,
            organization:organizations(*)
          `)
          .eq('user_id', user.id);

        if (assignError) throw assignError;

        setUserOrgAssignments(assignments || []);
        const orgs = (assignments || []).map(a => a.organization).filter(Boolean);
        setAccessibleOrganizations(orgs);

        const primaryAssignment = assignments?.find(a => a.is_primary);
        const savedOrgId = localStorage.getItem(SELECTED_ORG_KEY);

        if (savedOrgId && orgs.find(o => o.id === savedOrgId)) {
          setSelectedOrganizationState(orgs.find(o => o.id === savedOrgId));
        } else if (primaryAssignment?.organization) {
          setSelectedOrganizationState(primaryAssignment.organization);
        } else if (orgs.length > 0) {
          setSelectedOrganizationState(orgs[0]);
        }
      }
    } catch (error) {
      console.error('Error loading organization access:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadProjectsForOrganization(organizationId) {
    try {
      const { data: projects, error } = await supabase
        .from('projects')
        .select('*')
        .eq('organization_id', organizationId)
        .order('name');

      if (error) throw error;
      setAccessibleProjects(projects || []);

      const savedProjectId = localStorage.getItem(SELECTED_PROJECT_KEY);
      if (savedProjectId && projects?.find(p => p.id === savedProjectId)) {
        setSelectedProjectState(projects.find(p => p.id === savedProjectId));
      } else if (projects && projects.length > 0) {
        setSelectedProjectState(projects[0]);
      } else {
        setSelectedProjectState(null);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
      setAccessibleProjects([]);
      setSelectedProjectState(null);
    }
  }

  const setSelectedOrganization = useCallback((org) => {
    setSelectedOrganizationState(org);
    if (org?.id) {
      localStorage.setItem(SELECTED_ORG_KEY, org.id);
    } else {
      localStorage.removeItem(SELECTED_ORG_KEY);
    }
  }, []);

  const setSelectedProject = useCallback((project) => {
    setSelectedProjectState(project);
    if (project?.id) {
      localStorage.setItem(SELECTED_PROJECT_KEY, project.id);
    } else {
      localStorage.removeItem(SELECTED_PROJECT_KEY);
    }
  }, []);

  const canAccessOrganization = useCallback((orgId) => {
    if (isInternalUser) return true;
    return accessibleOrganizations.some(org => org.id === orgId);
  }, [isInternalUser, accessibleOrganizations]);

  const getUserOrgRole = useCallback((orgId) => {
    if (isInternalUser) return 'internal';
    const assignment = userOrgAssignments.find(a => a.organization_id === orgId);
    return assignment?.role || null;
  }, [isInternalUser, userOrgAssignments]);

  const refreshOrganizations = useCallback(() => {
    if (user && profile) {
      loadOrganizationAccess();
    }
  }, [user, profile]);

  const value = {
    accessibleOrganizations,
    selectedOrganization,
    setSelectedOrganization,
    accessibleProjects,
    selectedProject,
    setSelectedProject,
    isInternalUser,
    canAccessOrganization,
    getUserOrgRole,
    isLoading,
    userOrgAssignments,
    refreshOrganizations,
    hasSingleOrg: !isInternalUser && accessibleOrganizations.length === 1,
    hasMultipleOrgs: !isInternalUser && accessibleOrganizations.length > 1
  };

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
}
