import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, UserRole, fromBackendRole, toBackendRole, ApiRegisterRequest } from '@/app/types';
import { authApi } from '@/app/api/auth';
import { notificationsApi } from '@/app/api/notifications';
import { requestNotificationToken, signInWithGoogle } from '@/firebase';
import { AxiosError } from 'axios';

// ─── Context shape ──────────────────────────────────────────────────────────

interface RegisterData {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: UserRole;
  // Patient fields
  dateOfBirth?: string;
  bloodType?: string;
  insuranceNumber?: string;
  nationalId?: string;
  // Provider fields
  specialty?: string;
  licenseNumber?: string;
  facility?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** Login — returns error message or null on success */
  login: (email: string, password: string) => Promise<string | null>;
  /** Register — returns error message or null on success (user must verify email) */
  register: (data: RegisterData) => Promise<string | null>;
  /** Verify OTP sent to email after registration or forgot-password */
  verifyEmail: (email: string, otp: string) => Promise<string | null>;
  /** Send forgot-password OTP */
  forgotPassword: (email: string) => Promise<string | null>;
  /** Reset password with OTP */
  resetPassword: (email: string, otp: string, newPassword: string) => Promise<string | null>;
  /** Clear tokens and user state */
  logout: () => void;
  /** Sign in with Google — opens the Google popup and exchanges the token for SHCP JWTs */
  loginWithGoogle: () => Promise<string | null>;
  /** Update local user cache (e.g. after profile update) */
  updateUser: (partial: Partial<User>) => void;
  /** Pending email for OTP verification steps */
  pendingEmail: string | null;
  setPendingEmail: (email: string | null) => void;
}

// ─── Context ────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─── Helpers ────────────────────────────────────────────────────────────────

function extractErrorMessage(error: unknown, fallback: string): string {
  const e = error as AxiosError<{ message?: string; error?: { message?: string } | string }>;
  const data = e?.response?.data;
  if (!data) return fallback;
  // Backend wraps errors as: { error: { code, message } }
  const errField = data.error;
  if (errField && typeof errField === 'object' && errField.message) return errField.message;
  if (typeof errField === 'string' && errField) return errField;
  if (data.message) return data.message;
  return fallback;
}

function buildUser(data: {
  userId: string;
  email: string;
  role: string;
  isVerified: boolean;
  profileComplete?: boolean;
  name?: string;
  phone?: string;
  specialty?: string;
  facility?: string;
  licenseNumber?: string;
  dateOfBirth?: string;
  bloodType?: string;
  insuranceNumber?: string;
  nationalId?: string;
  languagePref?: string;
}): User {
  return {
    id: data.userId,
    email: data.email,
    name: data.name || data.email.split('@')[0],
    role: fromBackendRole(data.role as 'PATIENT' | 'PROVIDER' | 'ADMIN' | 'PHARMACIST' | 'BIKER'),
    verified: data.isVerified,
    profileComplete: data.profileComplete ?? true,
    phone: data.phone,
    specialization: data.specialty,
    facility: data.facility,
    licenseNumber: data.licenseNumber,
    dateOfBirth: data.dateOfBirth,
    bloodType: data.bloodType,
    insuranceNumber: data.insuranceNumber,
    nationalId: data.nationalId,
    languagePref: data.languagePref,
  };
}

// ─── Provider ───────────────────────────────────────────────────────────────

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  // Restore session from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('user');
    const token = localStorage.getItem('accessToken');
    if (stored && token) {
      try {
        const parsed = JSON.parse(stored);
        // Normalize stale/raw backend role values that may have been stored
        // before fromBackendRole was correctly applied (e.g. 'provider' → 'doctor')
        if (parsed.role === 'PROVIDER' || parsed.role === 'provider') parsed.role = 'doctor';
        else if (parsed.role === 'PATIENT') parsed.role = 'patient';
        else if (parsed.role === 'ADMIN') parsed.role = 'admin';
        else if (parsed.role === 'PHARMACIST') parsed.role = 'pharmacist';
        else if (parsed.role === 'BIKER') parsed.role = 'biker';
        setUser(parsed);
      } catch {
        localStorage.removeItem('user');
      }
    }
    setIsLoading(false);
  }, []);

  const persistAuth = (authData: {
    accessToken: string;
    refreshToken: string;
    userId: string;
    email: string;
    role: string;
    isVerified: boolean;
    profileComplete?: boolean;
    name?: string;
  }) => {
    localStorage.setItem('accessToken', authData.accessToken);
    localStorage.setItem('refreshToken', authData.refreshToken);
    const u = buildUser(authData);
    localStorage.setItem('user', JSON.stringify(u));
    setUser(u);
  };

  const login = async (email: string, password: string): Promise<string | null> => {
    try {
      const data = await authApi.login(email, password);
      persistAuth(data);
      // Request push notification permission and register FCM token with the backend.
      // Runs in the background — a failure here never blocks login.
      requestNotificationToken()
        .then(token => {
          if (token) return notificationsApi.registerDeviceToken(token);
        })
        .catch(() => { /* FCM unavailable — silently skip */ });
      return null;
    } catch (err) {
      return extractErrorMessage(err, 'Invalid email or password.');
    }
  };

  // Returns: null = success, 'CANCELLED' = user closed the popup, string = error message
  const loginWithGoogle = async (): Promise<string | null> => {
    try {
      const idToken = await signInWithGoogle();
      if (!idToken) return 'CANCELLED';

      const data = await authApi.googleLogin(idToken);
      persistAuth(data);
      requestNotificationToken()
        .then(token => { if (token) return notificationsApi.registerDeviceToken(token); })
        .catch(() => {});
      return null; // success
    } catch (err) {
      return extractErrorMessage(err, 'Google sign-in failed. Please try again.');
    }
  };

  const register = async (data: RegisterData): Promise<string | null> => {
    const payload: ApiRegisterRequest = {
      name: data.name,
      email: data.email,
      phone: data.phone,
      password: data.password,
      role: toBackendRole(data.role),
      languagePref: 'en',
      dateOfBirth: data.dateOfBirth,
      bloodType: data.bloodType,
      insuranceNumber: data.insuranceNumber,
      nationalId: data.nationalId,
      specialty: data.specialty,
      licenseNumber: data.licenseNumber,
      facility: data.facility,
    };
    try {
      await authApi.register(payload);
      setPendingEmail(data.email);
      return null;
    } catch (err) {
      return extractErrorMessage(err, 'Registration failed. Please try again.');
    }
  };

  const verifyEmail = async (email: string, otp: string): Promise<string | null> => {
    try {
      await authApi.verifyEmail(email, otp);
      setPendingEmail(null);
      return null;
    } catch (err) {
      return extractErrorMessage(err, 'Invalid or expired OTP.');
    }
  };

  const forgotPassword = async (email: string): Promise<string | null> => {
    try {
      await authApi.forgotPassword(email);
      setPendingEmail(email);
      return null;
    } catch (err) {
      return extractErrorMessage(err, 'Failed to send reset OTP.');
    }
  };

  const resetPassword = async (email: string, otp: string, newPassword: string): Promise<string | null> => {
    try {
      await authApi.resetPassword(email, otp, newPassword);
      setPendingEmail(null);
      return null;
    } catch (err) {
      return extractErrorMessage(err, 'Failed to reset password.');
    }
  };

  const logout = () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      authApi.logout(refreshToken).catch(() => { /* best-effort */ });
    }
    // Deregister device token so push notifications stop after logout.
    notificationsApi.removeDeviceToken().catch(() => { /* best-effort */ });
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setUser(null);
  };

  const updateUser = (partial: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...partial };
      localStorage.setItem('user', JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        loginWithGoogle,
        register,
        verifyEmail,
        forgotPassword,
        resetPassword,
        logout,
        updateUser,
        pendingEmail,
        setPendingEmail,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
