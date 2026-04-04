import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { auditService } from '../services/auditService';

const IDLE_TIMEOUT_MS = 3 * 60 * 60 * 1000; // 3 hours
const IDLE_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [impersonatedUser, setImpersonatedUser] = useState(null);
  const [impersonatedProfile, setImpersonatedProfile] = useState(null);
  const [originalAdmin, setOriginalAdmin] = useState(null);
  const idleTimerRef = useRef(null);
  const userRef = useRef(null);

  // Keep userRef in sync so the idle handler always sees the latest value
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    const resetIdleTimer = () => {
      if (!userRef.current) return;
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(async () => {
        console.warn('Session expired due to 3 hours of inactivity. Signing out.');
        const { error } = await supabase.auth.signOut();
        if (error) console.error('Error signing out on idle timeout:', error);
        setUser(null);
        setProfile(null);
        setImpersonatedUser(null);
        setImpersonatedProfile(null);
        setOriginalAdmin(null);
      }, IDLE_TIMEOUT_MS);
    };

    const startIdleTracking = () => {
      resetIdleTimer();
      IDLE_EVENTS.forEach(event => window.addEventListener(event, resetIdleTimer, { passive: true }));
    };

    const stopIdleTracking = () => {
      clearTimeout(idleTimerRef.current);
      IDLE_EVENTS.forEach(event => window.removeEventListener(event, resetIdleTimer));
    };

    if (user) {
      startIdleTracking();
    } else {
      stopIdleTracking();
    }

    return () => stopIdleTracking();
  }, [user]);

  useEffect(() => {
    console.log('AuthProvider: Initializing...');

    const timeoutId = setTimeout(() => {
      console.warn('Auth check timeout - forcing loading to false');
      setLoading(false);
    }, 5000);

    const initAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        console.log('Initial session check:', { hasSession: !!session, error });

        if (session?.user) {
          setUser(session.user);
          await fetchUserProfile(session.user);
        }

        clearTimeout(timeoutId);
        setLoading(false);
      } catch (error) {
        console.error('Error getting initial session:', error);
        clearTimeout(timeoutId);
        setLoading(false);
      }
    };

    initAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        (async () => {
          const currentUser = session?.user ?? null;
          setUser(currentUser);

          if (currentUser) {
            await fetchUserProfile(currentUser);
          } else {
            setProfile(null);
          }

          setLoading(false);
        })();
      }
    );

    return () => {
      clearTimeout(timeoutId);
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  async function fetchUserProfile(authUser) {
    try {
      try {
        const { data: invResult } = await supabase.rpc('apply_pending_invitation');
        if (invResult?.applied) {
          console.log('Applied pending invitation, role:', invResult.role);
        }
      } catch (invError) {
        console.debug('apply_pending_invitation check:', invError.message);
      }

      const { data: rpcData, error: rpcError } = await supabase.rpc('get_my_role');
      if (!rpcError && rpcData && rpcData.length > 0) {
        const roleRecord = rpcData[0];
        if (roleRecord.user_id !== authUser.id) {
          await supabase
            .from('user_roles')
            .update({ user_id: authUser.id })
            .eq('id', roleRecord.id);
          roleRecord.user_id = authUser.id;
        }
        setProfile(roleRecord);
        return;
      }

      let { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', authUser.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (!data && authUser.email) {
        const { data: emailData, error: emailError } = await supabase
          .from('user_roles')
          .select('*')
          .eq('email', authUser.email)
          .maybeSingle();

        if (emailError && emailError.code !== 'PGRST116') {
          throw emailError;
        }

        if (emailData) {
          data = emailData;
          await supabase
            .from('user_roles')
            .update({ user_id: authUser.id })
            .eq('id', emailData.id);
        }
      }

      setProfile(data || { role: 'Viewer' });
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setProfile({ role: 'Viewer' });
    }
  }

  const signInWithMicrosoft = async () => {
    try {
      // Use current origin to handle both custom domain and direct deployment
      const redirectUrl = `${window.location.origin}/tracker.html`;
      console.log('Microsoft OAuth redirect URL:', redirectUrl);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: {
          scopes: 'email profile openid',
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline'
          }
        }
      });

      if (error) {
        console.error('OAuth error:', error);
        throw error;
      }
      return { data, error: null };
    } catch (error) {
      console.error('Error signing in with Microsoft:', error);
      return { data: null, error };
    }
  };

  const signOut = async () => {
    try {
      console.log('Signing out user...');

      setImpersonatedUser(null);
      setImpersonatedProfile(null);
      setOriginalAdmin(null);

      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      setUser(null);
      setProfile(null);

      const postLogoutRedirect = encodeURIComponent(`${window.location.origin}/tracker.html`);
      window.location.href = `https://login.microsoftonline.com/common/oauth2/v2.0/logout?post_logout_redirect_uri=${postLogoutRedirect}`;
    } catch (error) {
      console.error('Error signing out:', error);
      setUser(null);
      setProfile(null);
      setImpersonatedUser(null);
      setImpersonatedProfile(null);
      setOriginalAdmin(null);
      window.location.href = `https://login.microsoftonline.com/common/oauth2/v2.0/logout?post_logout_redirect_uri=${encodeURIComponent(`${window.location.origin}/tracker.html`)}`;
    }
  };

  const startImpersonation = async (targetUserId) => {
    try {
      if (!profile || !['Proximity Admin', 'Super Admin'].includes(profile.role)) {
        throw new Error('Only Proximity Admins can impersonate users');
      }

      const { data: targetUserProfile, error } = await supabase
        .from('user_roles')
        .select('*')
        .eq('id', targetUserId)
        .maybeSingle();

      if (error) throw error;
      if (!targetUserProfile) throw new Error('User not found');

      if (['Proximity Admin', 'Super Admin'].includes(targetUserProfile.role)) {
        throw new Error('Cannot impersonate other admins');
      }

      setOriginalAdmin({
        user: user,
        profile: profile
      });
      setImpersonatedProfile(targetUserProfile);
      setImpersonatedUser({
        id: targetUserProfile.user_id,
        email: targetUserProfile.email
      });

      await auditService.logImpersonationStart(
        user.id,
        targetUserProfile.user_id,
        targetUserProfile.email
      );

      console.log('Started impersonation:', targetUserProfile.email);
    } catch (error) {
      console.error('Error starting impersonation:', error);
      throw error;
    }
  };

  const stopImpersonation = async () => {
    try {
      if (impersonatedUser && originalAdmin) {
        await auditService.logImpersonationStop(
          originalAdmin.user.id,
          impersonatedUser.id
        );
      }
    } catch (error) {
      console.error('Error logging impersonation stop:', error);
    }

    setImpersonatedUser(null);
    setImpersonatedProfile(null);
    setOriginalAdmin(null);
    console.log('Stopped impersonation');
  };

  const activeUser = impersonatedUser || user;
  const activeProfile = impersonatedProfile || profile;
  const isImpersonating = !!impersonatedUser;

  const isSuperAdmin = activeProfile?.role === 'Super Admin';
  const isProximityAdmin = activeProfile?.role === 'Proximity Admin' || isSuperAdmin;
  const isProximityStaff = ['Proximity Admin', 'Super Admin', 'Proximity Staff', 'Account Manager', 'Technical Consultant', 'Compliance Specialist'].includes(activeProfile?.role);
  const isCustomerAdmin = activeProfile?.role === 'Customer Admin';
  const isCustomerViewer = activeProfile?.role === 'Customer Viewer';
  const isCourier = activeProfile?.role === 'Courier';
  const canEdit = isProximityStaff || isCustomerAdmin;
  const canView = !!activeProfile;

  const value = {
    user: activeUser,
    profile: activeProfile,
    realUser: user,
    realProfile: profile,
    isImpersonating,
    impersonatedUser: impersonatedProfile,
    originalAdmin,
    loading,
    signInWithMicrosoft,
    signOut,
    startImpersonation,
    stopImpersonation,
    isAdmin: isProximityStaff || isCustomerAdmin,
    isProximityAdmin,
    isEditor: canEdit,
    isViewer: canView,
    isStaff: isProximityStaff,
    isCustomer: isCustomerAdmin || isCustomerViewer,
    isCustomerAdmin,
    isCustomerViewer,
    isCourier,
    organizationId: activeProfile?.organization_id
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
