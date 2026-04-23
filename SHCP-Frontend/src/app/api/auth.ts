import { apiClient, unwrap } from './client';
import { ApiRegisterRequest, AuthResponse } from '@/app/types';

export interface VerifyEmailRequest { email: string; otp: string; }
export interface ForgotPasswordRequest { email: string; }
export interface ResetPasswordRequest { email: string; otp: string; newPassword: string; }

export interface ChangePasswordRequest { currentPassword: string; newPassword: string; }

export const authApi = {
  login: (email: string, password: string) =>
    apiClient.post('/auth/login', { email, password }).then(unwrap<AuthResponse>),

  register: (data: ApiRegisterRequest) =>
    apiClient.post('/auth/register', data).then(unwrap<{ message: string }>),

  verifyEmail: (email: string, otp: string) =>
    apiClient.post('/auth/verify-email', { email, otp }).then(unwrap<string>),

  refresh: (refreshToken: string) =>
    apiClient.post('/auth/refresh', { refreshToken }).then(unwrap<AuthResponse>),

  logout: (refreshToken: string) =>
    apiClient.post('/auth/logout', { refreshToken }),

  forgotPassword: (email: string) =>
    apiClient.post('/auth/forgot-password', { email }).then(unwrap<{ message: string }>),

  resetPassword: (email: string, otp: string, newPassword: string) =>
    apiClient.post('/auth/reset-password', { email, otp, newPassword }).then(unwrap<{ message: string }>),

  changePassword: (currentPassword: string, newPassword: string) =>
    apiClient.post('/auth/change-password', { currentPassword, newPassword }).then(unwrap<string>),

  googleLogin: (idToken: string) =>
    apiClient.post('/auth/google', { idToken }).then(unwrap<AuthResponse>),
};
