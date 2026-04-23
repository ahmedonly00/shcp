import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { 
  Shield, Mail, Lock, User, Phone, CheckCircle2, AlertCircle,
  Eye, EyeOff, Hospital, Stethoscope, UserCircle, Activity,
  Calendar, Video, FileText, Heart, ArrowRight
} from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';
import { UserRole } from '@/app/types';
import { toast } from 'sonner';

interface LoginFormProps {
  onSuccess: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSuccess }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('patient');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const success = await login(email, password, role);
    setLoading(false);
    
    if (success) {
      toast.success('Login successful!');
      onSuccess();
    } else {
      toast.error('Invalid credentials. Please try again.');
    }
  };

  return (
    <form onSubmit={handleLogin} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/70" />
          <Input
            id="email"
            type="email"
            placeholder="your.email@example.com"
            className="pl-10"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/70" />
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            className="pl-10"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Login as</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={role === 'patient' ? 'default' : 'outline'}
            className="flex-1"
            onClick={() => setRole('patient')}
          >
            Patient
          </Button>
          <Button
            type="button"
            variant={role === 'doctor' ? 'default' : 'outline'}
            className="flex-1"
            onClick={() => setRole('doctor')}
          >
            Doctor
          </Button>
          <Button
            type="button"
            variant={role === 'admin' ? 'default' : 'outline'}
            className="flex-1"
            onClick={() => setRole('admin')}
          >
            Admin
          </Button>
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Logging in...' : 'Login'}
      </Button>

      <div className="text-center text-sm text-muted-foreground">
        <a href="#" className="hover:underline">Forgot password?</a>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs">
        <p className="font-medium text-blue-900 mb-1">Demo Credentials:</p>
        <p className="text-blue-700">Patient: jean.uwimana@email.com</p>
        <p className="text-blue-700">Doctor: grace.mugisha@hospital.rw</p>
        <p className="text-blue-700">Admin: admin@shcp.rw</p>
        <p className="text-blue-700 mt-1">Password: any</p>
      </div>
    </form>
  );
};

export const RegisterForm: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
  const { register } = useAuth();
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<UserRole>('patient');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    specialization: ''
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    const success = await register({
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      role: role,
      specialization: role === 'doctor' ? formData.specialization : undefined
    });
    setLoading(false);

    if (success) {
      toast.success('Registration successful!');
      onSuccess();
    } else {
      toast.error('Registration failed. Please try again.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {step === 1 && (
        <>
          <div className="space-y-2">
            <Label>I am a</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={role === 'patient' ? 'default' : 'outline'}
                onClick={() => setRole('patient')}
              >
                Patient
              </Button>
              <Button
                type="button"
                variant={role === 'doctor' ? 'default' : 'outline'}
                onClick={() => setRole('doctor')}
              >
                Doctor
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <div className="relative">
              <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/70" />
              <Input
                id="name"
                placeholder="John Doe"
                className="pl-10"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reg-email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/70" />
              <Input
                id="reg-email"
                type="email"
                placeholder="your.email@example.com"
                className="pl-10"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/70" />
              <Input
                id="phone"
                type="tel"
                placeholder="+250 788 123 456"
                className="pl-10"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                required
              />
            </div>
          </div>

          {role === 'doctor' && (
            <div className="space-y-2">
              <Label htmlFor="specialization">Specialization</Label>
              <Input
                id="specialization"
                placeholder="e.g., Cardiology"
                value={formData.specialization}
                onChange={(e) => handleChange('specialization', e.target.value)}
                required
              />
            </div>
          )}

          <Button type="button" className="w-full" onClick={() => setStep(2)}>
            Continue
          </Button>
        </>
      )}

      {step === 2 && (
        <>
          <div className="space-y-2">
            <Label htmlFor="reg-password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/70" />
              <Input
                id="reg-password"
                type="password"
                placeholder="••••••••"
                className="pl-10"
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
                required
              />
            </div>
            <div className="flex gap-1 text-xs text-muted-foreground mt-1">
              <CheckCircle2 className="h-3 w-3 text-green-600" />
              <span>At least 8 characters</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/70" />
              <Input
                id="confirm-password"
                type="password"
                placeholder="••••••••"
                className="pl-10"
                value={formData.confirmPassword}
                onChange={(e) => handleChange('confirmPassword', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="flex items-start space-x-2 text-xs">
            <input type="checkbox" required className="mt-1" />
            <span className="text-muted-foreground">
              I agree to the <a href="#" className="text-blue-600 hover:underline">Terms of Service</a> and{' '}
              <a href="#" className="text-blue-600 hover:underline">Privacy Policy</a>
            </span>
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? 'Creating Account...' : 'Create Account'}
            </Button>
          </div>
        </>
      )}
    </form>
  );
};

export const AuthPage: React.FC<{ onAuthSuccess: () => void }> = ({ onAuthSuccess }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="bg-blue-600 text-white rounded-full p-3">
              <Shield className="h-8 w-8" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Smart Health Consultation Platform</h1>
          <p className="text-muted-foreground">Connecting patients with healthcare providers in Rwanda</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Welcome</CardTitle>
            <CardDescription>Login or create an account to continue</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>
              <TabsContent value="login">
                <LoginForm onSuccess={onAuthSuccess} />
              </TabsContent>
              <TabsContent value="register">
                <RegisterForm onSuccess={onAuthSuccess} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="mt-6 text-center text-xs text-muted-foreground">
          <p>© 2026 Smart Health Consultation Platform</p>
          <p>Ministry of Health - Republic of Rwanda</p>
        </div>
      </div>
    </div>
  );
};