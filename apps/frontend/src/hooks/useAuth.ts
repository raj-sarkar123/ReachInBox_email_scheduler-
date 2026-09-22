'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../lib/api';
import { User } from '../types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('reachinbox_token');
      if (!token) {
        setLoading(false);
        return;
      }

      const res = await api.get('/auth/me');
      if (res.data.success && res.data.data) {
        setUser(res.data.data);
      } else {
        logout();
      }
    } catch (err) {
      logout();
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = () => {
    window.location.href = `${process.env.BACKEND_URL || 'http://localhost:5000/api'}/auth/google`;
  };

  const loginDemo = async () => {
    try {
      setLoading(true);
      const res = await api.post('/auth/demo');
      if (res.data.success) {
        const { user: demoUser, token } = res.data.data;
        localStorage.setItem('reachinbox_token', token);
        localStorage.setItem('reachinbox_user', JSON.stringify(demoUser));
        setUser(demoUser);
        router.push('/dashboard');
      }
    } catch (err) {
      console.error('Demo login error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('reachinbox_token');
    localStorage.removeItem('reachinbox_user');
    setUser(null);
    router.push('/login');
  };

  return {
    user,
    loading,
    loginWithGoogle,
    loginDemo,
    logout,
    checkAuth,
  };
}
