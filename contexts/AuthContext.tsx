'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import { getDoc, doc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/config';
import { AuthService } from '@/services/authService';
import { User } from '@/types';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (userData: any) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      
      if (firebaseUser) {
        console.log('Firebase user found:', firebaseUser.uid);
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data() as User;
            console.log('User data from Firestore:', userData);
            setUser({ ...userData, id: firebaseUser.uid });
            setFirebaseUser(firebaseUser);
          } else {
            console.log('No user document found in Firestore');
            setUser(null);
            setFirebaseUser(null);
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          setUser(null);
          setFirebaseUser(null);
        }
      } else {
        console.log('No Firebase user found');
        setUser(null);
        setFirebaseUser(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      await AuthService.loginUser(email, password);
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await AuthService.logoutUser();
      // Clear user state immediately
      setUser(null);
      setFirebaseUser(null);
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const register = async (userData: any) => {
    setLoading(true);
    try {
      await AuthService.registerUser(userData);
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const value = {
    user,
    firebaseUser,
    loading,
    login,
    logout,
    register,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
