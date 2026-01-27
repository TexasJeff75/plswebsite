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
    checkUser();

    const timeoutId = setTimeout(() => {
      console.warn('Auth check timeout - forcing loading to false');
      setLoading(false);
    }, 5000);

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        clearTimeout(timeoutId);
        (async () => {
          const currentUser = session?.user ?? null;
          setUser(currentUser);

          if (currentUser) {
            await fetchUserProfile(currentUser.id);
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

  async function checkUser() {
    try {
      console.log('Checking user session...');
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error) {
        console.error('Error getting user:', error);
      }

      console.log('User session result:', user?.email || 'No user');
      setUser(user);

      if (user) {
        await fetchUserProfile(user.id);
      }
    } catch (error) {
      console.error('Error checking user:', error);
    } finally {
      console.log('Auth check complete, setting loading to false');
      setLoading(false);
    }
  }

  async function fetchUserProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setProfile(data || { role: 'Viewer' });
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setProfile({ role: 'Viewer' });
    }
  }

  const signInWithMicrosoft = async () => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: {
          scopes: 'email profile openid',
          redirectTo: `${window.location.origin}/tracker.html#/dashboard`
        }
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Error signing in with Microsoft:', error);
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

  const value = {
    user,
    profile,
    loading,
    signInWithMicrosoft,
    signOut,
    isAdmin: profile?.role === 'Admin',
    isEditor: profile?.role === 'Editor' || profile?.role === 'Admin',
    isViewer: !!profile
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
