import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

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
      const siteUrl = import.meta.env.VITE_SITE_URL || window.location.origin;
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: {
          scopes: 'email profile openid',
          redirectTo: `${siteUrl}/tracker.html`
        }
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error signing in with Microsoft:', error);
      return { data: null, error };
    }
  };

  const signInWithPassword = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error signing in with password:', error);
      return { data: null, error };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      setUser(null);
      setProfile(null);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  const isProximityAdmin = profile?.role === 'Proximity Admin';
  const isProximityStaff = ['Proximity Admin', 'Proximity Staff', 'Account Manager', 'Technical Consultant', 'Compliance Specialist'].includes(profile?.role);
  const isCustomerAdmin = profile?.role === 'Customer Admin';
  const isCustomerViewer = profile?.role === 'Customer Viewer';
  const canEdit = isProximityStaff || isCustomerAdmin;
  const canView = !!profile;

  const value = {
    user,
    profile,
    loading,
    signInWithMicrosoft,
    signInWithPassword,
    signOut,
    isAdmin: isProximityStaff || isCustomerAdmin,
    isProximityAdmin,
    isEditor: canEdit,
    isViewer: canView,
    isStaff: isProximityStaff,
    isCustomer: isCustomerAdmin || isCustomerViewer,
    organizationId: profile?.organization_id
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
