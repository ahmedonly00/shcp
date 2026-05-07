import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Badge } from '@/app/components/ui/badge';
import {
  Shield, Mail, Lock, User, Phone, CheckCircle2,
  Eye, EyeOff, Hospital, Stethoscope, UserCircle, Activity,
  Calendar, Video, FileText, Heart, ArrowRight, Check, X,
  MapPin, KeyRound
} from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';
import { UserRole } from '@/app/types';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

// ─── Login Form ──────────────────────────────────────────────────────────────

interface LoginFormProps { onSuccess: () => void; onForgotPassword: () => void; }

export const EnhancedLoginForm: React.FC<LoginFormProps> = ({ onSuccess, onForgotPassword }) => {
  const { login, loginWithGoogle } = useAuth();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const error = await login(email, password);
    setLoading(false);
    if (error) {
      toast.error(error);
    } else {
      toast.success(t('auth.welcomeBack'));
      onSuccess();
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    const result = await loginWithGoogle();
    setGoogleLoading(false);
    if (result === null) {
      toast.success(t('auth.welcomeBack'));
      onSuccess();
    } else if (result !== 'CANCELLED') {
      toast.error(result);
    }
    // 'CANCELLED' → user closed the popup, do nothing
  };

  return (
    <div className="space-y-5">
      {/* Google Sign-In */}
      <Button
        type="button"
        variant="outline"
        className="w-full h-11 flex items-center gap-3 border-border hover:bg-muted/50"
        onClick={handleGoogleLogin}
        disabled={googleLoading || loading}
      >
        {googleLoading ? (
          <div className="h-4 w-4 border-2 border-border border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
        )}
        <span className="font-medium">Continue with Google</span>
      </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground/70">or sign in with email</span>
        </div>
      </div>

      <form onSubmit={handleLogin} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="login-email">{t('auth.email')}</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/70" />
            <Input id="login-email" type="email" placeholder="your.email@example.com"
              className="pl-10" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="login-password">{t('auth.password')}</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/70" />
            <Input id="login-password" type={showPassword ? 'text' : 'password'}
              placeholder={t('auth.enterPassword')} className="pl-10 pr-10"
              value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3 text-muted-foreground/70 hover:text-muted-foreground">
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Checkbox id="remember" checked={rememberMe}
              onCheckedChange={(c) => setRememberMe(c as boolean)} />
            <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">{t('auth.rememberMe')}</Label>
          </div>
          <button type="button" onClick={onForgotPassword}
            className="text-sm text-primary hover:underline">
            {t('auth.forgotPassword')}
          </button>
        </div>

        <Button type="submit" className="w-full h-11" disabled={loading || googleLoading}>
          {loading ? (
            <span className="flex items-center gap-2">
              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {t('common.loading')}
            </span>
          ) : (
            <span className="flex items-center gap-2">{t('auth.signIn')} <ArrowRight className="h-4 w-4" /></span>
          )}
        </Button>
      </form>
    </div>
  );
};

// ─── OTP Verification Form ───────────────────────────────────────────────────

interface OtpFormProps { email: string; onSuccess: () => void; onBack: () => void; }

export const OtpVerificationForm: React.FC<OtpFormProps> = ({ email, onSuccess, onBack }) => {
  const { verifyEmail } = useAuth();
  const { t } = useTranslation();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const error = await verifyEmail(email, otp);
    setLoading(false);
    if (error) {
      toast.error(error);
    } else {
      toast.success('Email verified! Please sign in to continue.');
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="text-center space-y-2 mb-4">
        <div className="h-14 w-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
          <Mail className="h-7 w-7 text-primary" />
        </div>
        <h3 className="font-semibold text-lg">{t('auth.verifyEmail')}</h3>
        <p className="text-sm text-muted-foreground">
          {t('auth.verifyEmailDesc')} <span className="font-medium text-foreground">{email}</span>
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="otp">{t('auth.otpCode')}</Label>
        <div className="relative">
          <KeyRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/70" />
          <Input id="otp" type="text" inputMode="numeric" placeholder="123456"
            className="pl-10 text-center text-lg tracking-widest"
            maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} required />
        </div>
      </div>

      <Button type="submit" className="w-full h-11" disabled={loading || otp.length < 6}>
        {loading ? (
          <span className="flex items-center gap-2">
            <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            {t('common.loading')}
          </span>
        ) : (
          <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> {t('auth.verify')}</span>
        )}
      </Button>

      <Button type="button" variant="ghost" onClick={onBack} className="w-full">
        {t('common.back')}
      </Button>
    </form>
  );
};

// ─── Register Form ───────────────────────────────────────────────────────────

interface RegisterFormProps { onSuccess: (email: string) => void; }

export const EnhancedRegisterForm: React.FC<RegisterFormProps> = ({ onSuccess }) => {
  const { register } = useAuth();
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<UserRole>('patient');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '',
    dateOfBirth: '', gender: '', address: '', nationalId: '',
    password: '', confirmPassword: '',
    specialization: '', licenseNumber: '', hospital: '',
    agreeToTerms: false
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (field: string, value: string | boolean) =>
    setFormData(prev => ({ ...prev, [field]: value }));

  const passwordValidation = {
    minLength: formData.password.length >= 8,
    hasUpper: /[A-Z]/.test(formData.password),
    hasLower: /[a-z]/.test(formData.password),
    hasNumber: /[0-9]/.test(formData.password),
    hasSpecial: /[!@#$%^&*]/.test(formData.password)
  };
  const isPasswordValid = Object.values(passwordValidation).every(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) { toast.error('Passwords do not match'); return; }
    if (!isPasswordValid) { toast.error('Password does not meet requirements'); return; }
    if (!formData.agreeToTerms) { toast.error('Please agree to the terms and conditions'); return; }

    setLoading(true);
    const error = await register({
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      password: formData.password,
      role,
      dateOfBirth: role === 'patient' ? formData.dateOfBirth : undefined,
      nationalId: role === 'patient' ? formData.nationalId : undefined,
      specialty: role === 'doctor' ? formData.specialization : undefined,
      licenseNumber: role === 'doctor' ? formData.licenseNumber : undefined,
      facility: role === 'doctor' ? formData.hospital : undefined,
    });
    setLoading(false);

    if (error) {
      toast.error(error);
    } else {
      toast.success('Account created! Please check your email for the verification code.');
      onSuccess(formData.email);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Progress bar */}
      <div className="flex items-center gap-2">
        {[1, 2, 3].map(n => (
          <div key={n} className={`flex-1 h-1.5 rounded-full ${step >= n ? 'bg-primary' : 'bg-muted'}`} />
        ))}
      </div>

      {/* Step 1: Role & basic info */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="space-y-3">
            <Label className="text-sm font-medium">I am registering as</Label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 'patient' as UserRole, label: t('auth.patient'), sub: 'Consultations, records, prescriptions', icon: <UserCircle className="h-5 w-5" /> },
                { value: 'doctor' as UserRole, label: t('auth.doctor'), sub: 'Appointments, video consults, EHR', icon: <Stethoscope className="h-5 w-5" /> },
              ].map(opt => (
                <button key={opt.value} type="button" onClick={() => setRole(opt.value)}
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${role === opt.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}>
                  <span className={`shrink-0 ${role === opt.value ? 'text-primary' : 'text-muted-foreground/60'}`}>{opt.icon}</span>
                  <div>
                    <p className={`text-sm font-semibold leading-none mb-0.5 ${role === opt.value ? 'text-primary' : 'text-foreground'}`}>{opt.label}</p>
                    <p className="text-xs text-muted-foreground">{opt.sub}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {[
            { id: 'reg-name', label: 'Full Name *', field: 'name', type: 'text', placeholder: 'Enter your full name', icon: <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/70" /> },
            { id: 'reg-email', label: 'Email Address *', field: 'email', type: 'email', placeholder: 'your.email@example.com', icon: <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/70" /> },
            { id: 'reg-phone', label: 'Phone Number *', field: 'phone', type: 'tel', placeholder: '+250 788 123 456', icon: <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/70" /> },
          ].map(f => (
            <div key={f.id} className="space-y-1.5">
              <Label htmlFor={f.id}>{f.label}</Label>
              <div className="relative">
                {f.icon}
                <Input id={f.id} type={f.type} placeholder={f.placeholder} className="pl-10"
                  value={formData[f.field as keyof typeof formData] as string}
                  onChange={e => handleChange(f.field, e.target.value)} required />
              </div>
            </div>
          ))}

          <Button type="button" className="w-full" onClick={() => setStep(2)}>
            Continue <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Step 2: Role-specific info */}
      {step === 2 && (
        <div className="space-y-5">
          {role === 'patient' ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="reg-dob">Date of Birth *</Label>
                  <Input id="reg-dob" type="date" value={formData.dateOfBirth}
                    onChange={e => handleChange('dateOfBirth', e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-gender">Gender *</Label>
                  <Select value={formData.gender} onValueChange={v => handleChange('gender', v)}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                      <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-address">Address *</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/70" />
                  <Input id="reg-address" placeholder="City, District, Rwanda" className="pl-10"
                    value={formData.address} onChange={e => handleChange('address', e.target.value)} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-national-id">National ID Number *</Label>
                <div className="relative">
                  <Shield className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/70" />
                  <Input id="reg-national-id" placeholder="Enter your national ID" className="pl-10"
                    value={formData.nationalId} onChange={e => handleChange('nationalId', e.target.value)} required />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="reg-specialization">Specialization *</Label>
                <Select
                  value={['Cardiology','Dermatology','Pediatrics','Orthopedics','Neurology','General Practice','Psychiatry'].includes(formData.specialization) ? formData.specialization : (formData.specialization ? 'Other' : '')}
                  onValueChange={v => { if (v !== 'Other') handleChange('specialization', v); else handleChange('specialization', ''); }}>
                  <SelectTrigger><SelectValue placeholder="Select your specialization" /></SelectTrigger>
                  <SelectContent>
                    {['Cardiology','Dermatology','Pediatrics','Orthopedics','Neurology','General Practice','Psychiatry','Other']
                      .map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                {(formData.specialization && !['Cardiology','Dermatology','Pediatrics','Orthopedics','Neurology','General Practice','Psychiatry'].includes(formData.specialization)) && (
                  <Input placeholder="Enter your specialization" value={formData.specialization}
                    onChange={e => handleChange('specialization', e.target.value)} required />
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-license">Medical License Number *</Label>
                <Input id="reg-license" placeholder="Enter your license number"
                  value={formData.licenseNumber} onChange={e => handleChange('licenseNumber', e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-hospital">Hospital/Clinic Affiliation *</Label>
                <div className="relative">
                  <Hospital className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/70" />
                  <Input id="reg-hospital" placeholder="e.g., King Faisal Hospital" className="pl-10"
                    value={formData.hospital} onChange={e => handleChange('hospital', e.target.value)} required />
                </div>
              </div>
            </>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(1)}>Back</Button>
            <Button type="button" className="flex-1" onClick={() => setStep(3)}>
              Continue <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Password & terms */}
      {step === 3 && (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="reg-password">Create Password *</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/70" />
              <Input id="reg-password" type={showPassword ? 'text' : 'password'}
                placeholder="Create a strong password" className="pl-10 pr-10"
                value={formData.password} onChange={e => handleChange('password', e.target.value)} required />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-muted-foreground/70 hover:text-muted-foreground">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div className="space-y-1.5 text-xs mt-2">
              {[
                { key: 'minLength', label: 'At least 8 characters' },
                { key: 'hasUpper', label: 'One uppercase letter' },
                { key: 'hasLower', label: 'One lowercase letter' },
                { key: 'hasNumber', label: 'One number' },
                { key: 'hasSpecial', label: 'One special character (!@#$%^&*)' },
              ].map(r => (
                <div key={r.key} className={`flex items-center gap-2 ${passwordValidation[r.key as keyof typeof passwordValidation] ? 'text-green-600' : 'text-muted-foreground'}`}>
                  {passwordValidation[r.key as keyof typeof passwordValidation] ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                  <span>{r.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reg-confirm-password">Confirm Password *</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/70" />
              <Input id="reg-confirm-password" type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Re-enter your password" className="pl-10 pr-10"
                value={formData.confirmPassword} onChange={e => handleChange('confirmPassword', e.target.value)} required />
              <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-3 text-muted-foreground/70 hover:text-muted-foreground">
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {formData.confirmPassword && (
              <div className={`text-xs flex items-center gap-2 ${formData.password === formData.confirmPassword ? 'text-green-600' : 'text-red-600'}`}>
                {formData.password === formData.confirmPassword
                  ? <><Check className="h-3 w-3" /> Passwords match</>
                  : <><X className="h-3 w-3" /> Passwords do not match</>}
              </div>
            )}
          </div>

          <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
            <Checkbox id="terms" checked={formData.agreeToTerms}
              onCheckedChange={c => handleChange('agreeToTerms', c)} required />
            <Label htmlFor="terms" className="text-xs leading-relaxed cursor-pointer">
              I agree to the{' '}
              <a href="#" className="text-primary hover:underline">Terms of Service</a>,{' '}
              <a href="#" className="text-primary hover:underline">Privacy Policy</a>, and{' '}
              <a href="#" className="text-primary hover:underline">Data Processing Agreement</a>.
              {role === 'doctor' && <span> I confirm that all provided credentials are valid and verifiable.</span>}
            </Label>
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(2)}>Back</Button>
            <Button type="submit" className="flex-1" disabled={loading || !formData.agreeToTerms || !isPasswordValid}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating Account...
                </span>
              ) : (
                <span className="flex items-center gap-2">Create Account <CheckCircle2 className="h-4 w-4" /></span>
              )}
            </Button>
          </div>
        </div>
      )}
    </form>
  );
};

// ─── Forgot Password Form ─────────────────────────────────────────────────────

interface ForgotPasswordProps { onBack: () => void; }

export const ForgotPasswordForm: React.FC<ForgotPasswordProps> = ({ onBack }) => {
  const { forgotPassword, resetPassword, pendingEmail, setPendingEmail } = useAuth();
  const [step, setStep] = useState<'email' | 'otp' | 'done'>('email');
  const [email, setEmail] = useState(pendingEmail || '');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const error = await forgotPassword(email);
    setLoading(false);
    if (error) { toast.error(error); return; }
    toast.success('OTP sent to your email');
    setStep('otp');
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setLoading(true);
    const error = await resetPassword(email, otp, newPassword);
    setLoading(false);
    if (error) { toast.error(error); return; }
    toast.success('Password reset successfully! Please log in.');
    setPendingEmail(null);
    setStep('done');
  };

  if (step === 'done') {
    return (
      <div className="text-center space-y-4 py-8">
        <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <div>
          <h3 className="font-semibold text-lg mb-2">Password Reset!</h3>
          <p className="text-sm text-muted-foreground">Your password has been reset successfully.</p>
        </div>
        <Button variant="outline" onClick={onBack} className="w-full">Back to Login</Button>
      </div>
    );
  }

  if (step === 'otp') {
    return (
      <form onSubmit={handleReset} className="space-y-5">
        <div className="text-center mb-4">
          <h3 className="font-semibold text-lg mb-1">Reset Password</h3>
          <p className="text-sm text-muted-foreground">Enter the OTP sent to <span className="font-medium">{email}</span> and your new password.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="reset-otp">OTP Code</Label>
          <div className="relative">
            <KeyRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/70" />
            <Input id="reset-otp" type="text" inputMode="numeric" placeholder="123456"
              className="pl-10 tracking-widest text-center" maxLength={6}
              value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))} required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-password">New Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/70" />
            <Input id="new-password" type={showPassword ? 'text' : 'password'}
              placeholder="Enter new password (min 8 chars)" className="pl-10 pr-10"
              value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3 text-muted-foreground/70 hover:text-muted-foreground">
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <Button type="submit" className="w-full" disabled={loading || otp.length < 6 || newPassword.length < 8}>
          {loading ? (
            <span className="flex items-center gap-2">
              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Resetting...
            </span>
          ) : 'Reset Password'}
        </Button>
        <Button type="button" variant="ghost" onClick={onBack} className="w-full">Back to Login</Button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSendOtp} className="space-y-5">
      <div className="text-center mb-6">
        <h3 className="font-semibold text-lg mb-2">Reset Your Password</h3>
        <p className="text-sm text-muted-foreground">Enter your email address and we'll send you an OTP to reset your password.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="forgot-email">Email Address</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/70" />
          <Input id="forgot-email" type="email" placeholder="your.email@example.com"
            className="pl-10" value={email} onChange={e => setEmail(e.target.value)} required />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? (
          <span className="flex items-center gap-2">
            <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Sending OTP...
          </span>
        ) : 'Send OTP'}
      </Button>
      <Button type="button" variant="ghost" onClick={onBack} className="w-full">Back to Login</Button>
    </form>
  );
};

// ─── Main Auth Page ───────────────────────────────────────────────────────────

type AuthView = 'login' | 'register' | 'forgot' | 'verify-otp';

export const EnhancedAuthPage: React.FC<{ onAuthSuccess: () => void; onBack: () => void }> = ({ onAuthSuccess, onBack }) => {
  const { pendingEmail } = useAuth();
  const { t } = useTranslation();
  const [view, setView] = useState<AuthView>('login');
  const [otpEmail, setOtpEmail] = useState('');

  const handleRegisterSuccess = (email: string) => {
    setOtpEmail(email);
    setView('verify-otp');
  };

  const features = [
    { icon: <Activity className="h-5 w-5" />, text: t('home.features.aiDiagnosis') },
    { icon: <Calendar className="h-5 w-5" />, text: t('home.features.appointments') },
    { icon: <Video className="h-5 w-5" />, text: t('home.features.videoConsult') },
    { icon: <FileText className="h-5 w-5" />, text: t('home.features.healthRecords') },
    { icon: <Heart className="h-5 w-5" />, text: t('nav.mobileHealth') },
    { icon: <Shield className="h-5 w-5" />, text: 'HIPAA Compliant & Secure' },
  ];

  const cardTitle = {
    login: t('auth.welcomeBack'),
    register: t('auth.createAccount'),
    forgot: t('auth.resetPassword'),
    'verify-otp': t('auth.verifyEmail'),
  }[view];

  const cardDesc = {
    login: t('auth.signIn'),
    register: t('auth.signUp'),
    forgot: t('auth.forgotPassword'),
    'verify-otp': t('auth.verifyEmailDesc'),
  }[view];

  return (
    <div className="min-h-screen bg-secondary flex flex-col lg:flex-row lg:h-screen lg:overflow-hidden">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-5/12 bg-primary p-8 flex-col justify-between text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-64 h-64 bg-white rounded-full -translate-x-32 -translate-y-32" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full translate-x-32 translate-y-32" />
        </div>
        <div className="relative z-10">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-white/70 hover:text-white text-sm font-medium mb-8 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            Back to Home
          </button>
          <div className="flex items-center gap-3 mb-6">
            <svg width="40" height="40" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <rect width="36" height="36" rx="9" fill="white" fillOpacity="0.2" />
              <rect x="15.5" y="8" width="5" height="20" rx="2.5" fill="white" />
              <rect x="8" y="15.5" width="20" height="5" rx="2.5" fill="white" />
            </svg>
            <div>
              <h1 className="text-xl font-bold tracking-tight">SHCP</h1>
              <p className="text-xs text-white/70">Smart Health Consultation Platform</p>
            </div>
          </div>
          <div className="mb-6">
            <h2 className="text-3xl font-bold mb-3 leading-tight">Your Health,<br />Our Priority</h2>
            <p className="text-sm text-white/80 leading-relaxed">Connecting patients with qualified healthcare providers across Rwanda</p>
          </div>
          <div className="space-y-2.5">
            {features.map((f, i) => (
              <div key={i} className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-lg px-3 py-2.5">
                <div className="h-8 w-8 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  {React.cloneElement(f.icon as React.ReactElement, { className: 'h-4 w-4' })}
                </div>
                <span className="text-sm font-medium">{f.text}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-4 text-xs text-white/60">
            <span>© 2026 SHCP</span><span>·</span>
            <a href="#" className="hover:text-white">Privacy</a><span>·</span>
            <a href="#" className="hover:text-white">Terms</a>
          </div>
        </div>
      </div>

      {/* Right form panel — scrolls internally if content is taller than viewport */}
      <div className="flex-1 h-full overflow-y-auto bg-card">
        <div className="min-h-full flex items-center justify-center p-4 lg:p-8">
        <div className="w-full max-w-md py-4">
          <div className="lg:hidden mb-4">
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
              Back to Home
            </button>
          </div>
          <div className="lg:hidden text-center mb-6">
            <div className="flex justify-center mb-3">
              <svg width="40" height="40" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <rect width="36" height="36" rx="9" fill="var(--primary)" />
                <rect x="15.5" y="8" width="5" height="20" rx="2.5" fill="white" />
                <rect x="8" y="15.5" width="20" height="5" rx="2.5" fill="white" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-primary mb-1">SHCP</h1>
            <p className="text-sm text-muted-foreground">Smart Health Consultation Platform</p>
          </div>

          <Card className="shadow-xl border-0">
            <CardHeader className="pb-3 pt-6 px-6">
              <CardTitle className="text-xl">{cardTitle}</CardTitle>
              <CardDescription>{cardDesc}</CardDescription>
            </CardHeader>
            <CardContent>
              {view === 'login' && (
                <EnhancedLoginForm onSuccess={onAuthSuccess} onForgotPassword={() => setView('forgot')} />
              )}
              {view === 'register' && (
                <EnhancedRegisterForm onSuccess={handleRegisterSuccess} />
              )}
              {view === 'forgot' && (
                <ForgotPasswordForm onBack={() => setView('login')} />
              )}
              {view === 'verify-otp' && (
                <OtpVerificationForm
                  email={otpEmail || pendingEmail || ''}
                  onSuccess={() => setView('login')}
                  onBack={() => setView('register')}
                />
              )}

              {view === 'login' && (
                <div className="mt-4 text-center text-sm">
                  <span className="text-muted-foreground">{t('auth.dontHaveAccount')} </span>
                  <button type="button" onClick={() => setView('register')}
                    className="text-primary font-medium hover:underline">{t('auth.signUp')}</button>
                </div>
              )}
              {view === 'register' && (
                <div className="mt-4 text-center text-sm">
                  <span className="text-muted-foreground">{t('auth.alreadyHaveAccount')} </span>
                  <button type="button" onClick={() => setView('login')}
                    className="text-primary font-medium hover:underline">{t('auth.signIn')}</button>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="mt-5 text-center text-xs text-muted-foreground space-y-1">
            <div className="flex items-center justify-center gap-1.5">
              <Shield className="h-3 w-3 text-primary/60" />
              <span>Aligned with Ministry of Health — Republic of Rwanda</span>
            </div>
            <p className="text-muted-foreground/60">Secure · Private · HIPAA-Compliant</p>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};
