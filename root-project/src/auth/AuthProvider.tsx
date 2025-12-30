import React, { useState, useEffect} from 'react';
import type { ReactNode } from 'react';
import { signIn, signOut, getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';
import { AuthContext } from './AuthContext';
import type { User } from '../interfaces/User';
import './cognitoConfig'; // Initialize Amplify
import { isTrustedDevice, trustDevice, refreshDeviceTrust } from './deviceTracking';

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Check authentication status on mount
  const checkAuth = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Check if user is authenticated
      const currentUser = await getCurrentUser();
      const session = await fetchAuthSession();

      if (currentUser && session.tokens) {
        setUser({
          email: currentUser.signInDetails?.loginId || '',
          emailVerified: true,
          sub: currentUser.userId,
        });

        // Refresh device trust if already trusted
        if (isTrustedDevice()) {
          refreshDeviceTrust();
        }
      } else {
        setUser(null);
      }
    } catch (err) {
      // Not authenticated or error
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Login function
  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      setError(null);

      // Check if this is a trusted device
      const trustedDevice = isTrustedDevice();

      // TODO: If not trusted device, trigger email MFA flow
      // For now, we'll just log it and proceed with normal login
      if (!trustedDevice) {
        console.log('New device detected - email MFA would be triggered here');
        // Future: Call Lambda to send verification code
        // For now, we'll trust the device after successful login
      }

      const { isSignedIn } = await signIn({
        username: email,
        password
      });

      if (isSignedIn) {
        // Trust this device after successful login
        trustDevice();

        await checkAuth(); // Refresh user state
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Login failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function
  const logout = async () => {
    try {
      setIsLoading(true);
      await signOut();
      setUser(null);
      // Note: We don't untrust the device on logout - device stays trusted
    } catch (err: any) {
      setError(err.message || 'Logout failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Check auth on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    error,
    login,
    logout,
    checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
