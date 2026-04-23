import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import { Badge } from '@/app/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { Switch } from '@/app/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import {
  User, Mail, Phone, MapPin, Calendar, Shield,
  Lock, Bell, CreditCard, FileText, Edit, Save,
  CheckCircle, AlertCircle, Camera, Upload, Loader2
} from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';
import { patientsApi, UpdatePatientRequest } from '@/app/api/patients';
import { providersApi, UpdateProviderRequest } from '@/app/api/providers';
import { authApi } from '@/app/api/auth';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { ApiHealthRecordDto } from '@/app/types';

export const Profile: React.FC = () => {
  const { user, updateUser } = useAuth();
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ehr, setEhr] = useState<ApiHealthRecordDto | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const docsInputRef   = useRef<HTMLInputElement>(null);
  const cardInputRef   = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    dateOfBirth: '',
    gender: 'prefer-not-to-say',
    emergencyContactName: '',
    emergencyContactPhone: '',
    bloodType: '',
    allergies: '',
    chronicConditions: '',
    insuranceProvider: '',
    insuranceNumber: user?.insuranceNumber || '',
    nationalId: user?.nationalId || '',
    // Provider fields
    specialty: user?.specialization || '',
    facility: user?.facility || '',
    licenseNumber: user?.licenseNumber || '',
  });

  const [securitySettings, setSecuritySettings] = useState({
    twoFactorAuth: user?.twoFactorEnabled || false,
    biometric: false,
    emailNotifications: true,
    sessionTimeout: '30'
  });

  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
  const [savingPassword, setSavingPassword] = useState(false);

  // Load profile from backend on mount
  useEffect(() => {
    const load = async () => {
      try {
        if (user?.role === 'patient') {
          const [profile, ehrData] = await Promise.all([
            patientsApi.getMyProfile(),
            patientsApi.getMyEhr().catch(() => null),
          ]);
          if (profile) {
            setFormData(prev => ({
              ...prev,
              name: profile.name || prev.name,
              email: profile.email || prev.email,
              phone: profile.phone || prev.phone,
              dateOfBirth: profile.dateOfBirth || prev.dateOfBirth,
              bloodType: profile.bloodType || prev.bloodType,
              insuranceNumber: profile.insuranceNumber || prev.insuranceNumber,
              nationalId: profile.nationalId || prev.nationalId,
              gender: profile.gender || prev.gender,
              emergencyContactName: profile.emergencyContactName || prev.emergencyContactName,
              emergencyContactPhone: profile.emergencyContactPhone || prev.emergencyContactPhone,
              insuranceProvider: profile.insuranceProvider || prev.insuranceProvider,
            }));
            if (profile.profilePictureUrl) {
              setAvatarUrl(patientsApi.avatarUrl(profile.profilePictureUrl));
            }
          }
          if (ehrData) {
            setEhr(ehrData);
            setFormData(prev => ({
              ...prev,
              allergies: parseEhrText(ehrData.allergies),
              chronicConditions: parseEhrText(ehrData.diagnoses),
            }));
          }
        } else if (user?.role === 'doctor') {
          const profile = await providersApi.getMyProfile();
          if (profile) {
            setFormData(prev => ({
              ...prev,
              name: profile.name || prev.name,
              email: profile.email || prev.email,
              phone: profile.phone || prev.phone,
              specialty: profile.specialty || prev.specialty,
              facility: profile.facility || prev.facility,
              licenseNumber: profile.licenseNumber || prev.licenseNumber,
            }));
            if (profile.profilePictureUrl) {
              setAvatarUrl(providersApi.avatarUrl(profile.profilePictureUrl));
            }
          }
        }
      } catch {
        // silently ignore - form falls back to auth context values
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.role]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (user?.role === 'patient') {
        const payload: UpdatePatientRequest = {
          name: formData.name,
          phone: formData.phone,
          dateOfBirth: formData.dateOfBirth || undefined,
          bloodType: formData.bloodType || undefined,
          insuranceNumber: formData.insuranceNumber || undefined,
          nationalId: formData.nationalId || undefined,
          gender: formData.gender || undefined,
          emergencyContactName: formData.emergencyContactName || undefined,
          emergencyContactPhone: formData.emergencyContactPhone || undefined,
          insuranceProvider: formData.insuranceProvider || undefined,
        };
        const updated = await patientsApi.updateMyProfile(payload);
        if (updated) {
          updateUser({
            name: updated.name,
            phone: updated.phone,
            dateOfBirth: updated.dateOfBirth,
            nationalId: updated.nationalId,
            profileComplete: !!(updated.dateOfBirth && updated.nationalId),
          });
        }
        // Save medical info to EHR
        if (formData.allergies || formData.chronicConditions) {
          await patientsApi.updateMyEhr({
            allergies: formData.allergies || ehr?.allergies,
            diagnoses: formData.chronicConditions || ehr?.diagnoses,
          }).catch(() => { /* non-fatal */ });
        }
      } else if (user?.role === 'doctor') {
        const payload: UpdateProviderRequest = {
          name: formData.name,
          phone: formData.phone,
          specialty: formData.specialty || undefined,
          facility: formData.facility || undefined,
        };
        const updated = await providersApi.updateMyProfile(payload);
        if (updated) {
          updateUser({ name: updated.name, phone: updated.phone, specialization: updated.specialty });
        }
      }
      toast.success('Profile updated successfully');
      setIsEditing(false);
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleChangePassword = async () => {
    if (!passwordForm.current || !passwordForm.next || !passwordForm.confirm) {
      toast.error('Please fill all password fields'); return;
    }
    if (passwordForm.next !== passwordForm.confirm) {
      toast.error('New passwords do not match'); return;
    }
    if (passwordForm.next.length < 6) {
      toast.error('New password must be at least 6 characters'); return;
    }
    setSavingPassword(true);
    try {
      await authApi.changePassword(passwordForm.current, passwordForm.next);
      toast.success('Password updated successfully');
      setPasswordForm({ current: '', next: '', confirm: '' });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message;
      toast.error(msg || 'Failed to update password');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const upload = user?.role === 'doctor' ? providersApi.uploadAvatar : patientsApi.uploadAvatar;
      const storedName = await upload(file);
      if (storedName) {
        const buildUrl = user?.role === 'doctor' ? providersApi.avatarUrl : patientsApi.avatarUrl;
        setAvatarUrl(buildUrl(storedName));
        toast.success('Profile picture updated');
      }
    } catch {
      toast.error('Failed to upload profile picture');
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await patientsApi.uploadEhrFile(file, file.name, new Date().toISOString().split('T')[0]);
      toast.success(`"${file.name}" added to medical documents`);
    } catch {
      toast.error('Failed to upload document');
    } finally {
      if (docsInputRef.current) docsInputRef.current.value = '';
    }
  };

  const handleCardUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await patientsApi.uploadEhrFile(file, 'Insurance Card', new Date().toISOString().split('T')[0]);
      toast.success('Insurance card uploaded');
    } catch {
      toast.error('Failed to upload insurance card');
    } finally {
      if (cardInputRef.current) cardInputRef.current.value = '';
    }
  };

  // EHR fields (allergies, diagnoses) are stored as JSON strings — extract plain text for display
  function parseEhrText(raw: string | undefined): string {
    if (!raw || raw === '[]' || raw === 'null') return '';
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'string') return parsed;
      if (Array.isArray(parsed)) return parsed.join(', ');
    } catch { /* ignore */ }
    return raw;
  }

  const joinedDate = user
    ? new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Profile Settings</h2>
          <p className="text-muted-foreground">Manage your personal information and preferences</p>
        </div>
        {!isEditing ? (
          <Button onClick={() => setIsEditing(true)} disabled={loading}>
            <Edit className="h-4 w-4 mr-2" />
            Edit Profile
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsEditing(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Changes
            </Button>
          </div>
        )}
      </div>

      {/* Profile Header */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/70" />
            </div>
          ) : (
            <div className="flex items-start gap-6">
              <div className="relative">
                <Avatar className="h-24 w-24">
                  {avatarUrl && <AvatarImage src={avatarUrl} alt={user?.name} />}
                  <AvatarFallback className="bg-gradient-to-br from-blue-600 to-blue-700 text-white text-2xl">
                    {uploadingAvatar
                      ? <Loader2 className="h-6 w-6 animate-spin" />
                      : (user?.name?.split(' ').map(n => n[0] ?? '').join('') ?? '?')}
                  </AvatarFallback>
                </Avatar>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
                <button
                  className="absolute bottom-0 right-0 h-8 w-8 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 disabled:opacity-50"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  type="button"
                  title="Change profile picture"
                >
                  <Camera className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="text-2xl font-bold">{user?.name}</h3>
                    <p className="text-muted-foreground">{user?.email}</p>
                  </div>
                  <div className="flex gap-2">
                    {user?.verified && (
                      <Badge variant="default" className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Verified
                      </Badge>
                    )}
                    <Badge variant="outline" className="capitalize">
                      {user?.role}
                    </Badge>
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mt-4">
                  {formData.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      <span>{formData.phone}</span>
                    </div>
                  )}
                  {formData.facility && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span>{formData.facility}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>Joined {joinedDate}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="personal" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="personal">{t("profile.personalInfo")}</TabsTrigger>
          <TabsTrigger value="medical">{t("profile.medicalInfo")}</TabsTrigger>
          <TabsTrigger value="security">{t("profile.security")}</TabsTrigger>
          <TabsTrigger value="insurance">{t("profile.insurance")}</TabsTrigger>
        </TabsList>

        {/* Personal Information */}
        <TabsContent value="personal" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("profile.personalInfo")}</CardTitle>
              <CardDescription>{t("profile.updatePersonalDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    disabled={!isEditing}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    disabled={true}
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    disabled={!isEditing}
                  />
                </div>
                {user?.role === 'patient' && (
                  <div className="space-y-2">
                    <Label htmlFor="dob">Date of Birth</Label>
                    <Input
                      id="dob"
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={(e) => handleChange('dateOfBirth', e.target.value)}
                      disabled={!isEditing}
                    />
                  </div>
                )}
                {user?.role === 'doctor' && (
                  <div className="space-y-2">
                    <Label htmlFor="specialty">Specialty</Label>
                    <Input
                      id="specialty"
                      value={formData.specialty}
                      onChange={(e) => handleChange('specialty', e.target.value)}
                      disabled={!isEditing}
                    />
                  </div>
                )}
              </div>

              {user?.role === 'patient' && (
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="gender">Gender</Label>
                    <Select
                      value={formData.gender}
                      onValueChange={(v) => handleChange('gender', v)}
                      disabled={!isEditing}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                        <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bloodType">Blood Type</Label>
                    <Select
                      value={formData.bloodType}
                      onValueChange={(v) => handleChange('bloodType', v)}
                      disabled={!isEditing}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select blood type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A+">A+</SelectItem>
                        <SelectItem value="A-">A-</SelectItem>
                        <SelectItem value="B+">B+</SelectItem>
                        <SelectItem value="B-">B-</SelectItem>
                        <SelectItem value="AB+">AB+</SelectItem>
                        <SelectItem value="AB-">AB-</SelectItem>
                        <SelectItem value="O+">O+</SelectItem>
                        <SelectItem value="O-">O-</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {user?.role === 'doctor' && (
                <div className="space-y-2">
                  <Label htmlFor="facility">Facility / Hospital</Label>
                  <Input
                    id="facility"
                    value={formData.facility}
                    onChange={(e) => handleChange('facility', e.target.value)}
                    disabled={!isEditing}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {user?.role === 'patient' && (
            <Card>
              <CardHeader>
                <CardTitle>Emergency Contact</CardTitle>
                <CardDescription>Person to contact in case of emergency</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="emergencyName">Contact Name</Label>
                    <Input
                      id="emergencyName"
                      value={formData.emergencyContactName}
                      onChange={(e) => handleChange('emergencyContactName', e.target.value)}
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emergencyPhone">Contact Phone</Label>
                    <Input
                      id="emergencyPhone"
                      type="tel"
                      value={formData.emergencyContactPhone}
                      onChange={(e) => handleChange('emergencyContactPhone', e.target.value)}
                      disabled={!isEditing}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Medical Information */}
        <TabsContent value="medical" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Medical History</CardTitle>
              <CardDescription>Important medical information for healthcare providers</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="allergies">Known Allergies</Label>
                <Textarea
                  id="allergies"
                  placeholder="List any allergies (medications, food, environmental)"
                  value={formData.allergies}
                  onChange={(e) => handleChange('allergies', e.target.value)}
                  disabled={!isEditing}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="chronic">Chronic Conditions</Label>
                <Textarea
                  id="chronic"
                  placeholder="List any chronic conditions or ongoing medical issues"
                  value={formData.chronicConditions}
                  onChange={(e) => handleChange('chronicConditions', e.target.value)}
                  disabled={!isEditing}
                  rows={3}
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <p className="font-medium mb-1">Important</p>
                    <p>Keep this information up to date. It may be critical in emergency situations.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Medical Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground/70" />
                <p className="text-sm text-muted-foreground mb-2">
                  Upload medical documents, test results, or prescriptions
                </p>
                <input
                  ref={docsInputRef}
                  type="file"
                  accept=".pdf,image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleDocUpload}
                />
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => docsInputRef.current?.click()}
                >
                  Choose Files
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Settings */}
        <TabsContent value="security" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>Manage your account security and privacy</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <Shield className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <Label htmlFor="2fa">Two-Factor Authentication</Label>
                    <p className="text-sm text-muted-foreground">Add an extra layer of security</p>
                  </div>
                </div>
                <Switch
                  id="2fa"
                  checked={securitySettings.twoFactorAuth}
                  onCheckedChange={(checked) =>
                    setSecuritySettings(prev => ({ ...prev, twoFactorAuth: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                    <Lock className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <Label htmlFor="biometric">Biometric Login</Label>
                    <p className="text-sm text-muted-foreground">Use fingerprint or face recognition</p>
                  </div>
                </div>
                <Switch
                  id="biometric"
                  checked={securitySettings.biometric}
                  onCheckedChange={(checked) =>
                    setSecuritySettings(prev => ({ ...prev, biometric: checked }))
                  }
                />
              </div>

              <div className="border-t pt-6">
                <h4 className="font-medium mb-4">Password</h4>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      placeholder="••••••••"
                      value={passwordForm.current}
                      onChange={(e) => setPasswordForm(p => ({ ...p, current: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      placeholder="••••••••"
                      value={passwordForm.next}
                      onChange={(e) => setPasswordForm(p => ({ ...p, next: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      value={passwordForm.confirm}
                      onChange={(e) => setPasswordForm(p => ({ ...p, confirm: e.target.value }))}
                    />
                  </div>
                  <Button variant="outline" onClick={handleChangePassword} disabled={savingPassword}>
                    {savingPassword ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Update Password
                  </Button>
                </div>
              </div>

              <div className="border-t pt-6">
                <h4 className="font-medium mb-4">Session Management</h4>
                <div className="space-y-2">
                  <Label htmlFor="timeout">Auto Logout After</Label>
                  <Select
                    value={securitySettings.sessionTimeout}
                    onValueChange={(v) => setSecuritySettings(prev => ({ ...prev, sessionTimeout: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                      <SelectItem value="120">2 hours</SelectItem>
                      <SelectItem value="never">Never</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Privacy Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Share Health Data with Providers</Label>
                  <p className="text-sm text-muted-foreground">Allow automatic data sharing during consultations</p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Research Participation</Label>
                  <p className="text-sm text-muted-foreground">Contribute anonymized data for medical research</p>
                </div>
                <Switch />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Insurance Information */}
        <TabsContent value="insurance" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Insurance Information</CardTitle>
              <CardDescription>Manage your health insurance details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="provider">Insurance Provider</Label>
                <Input
                  id="provider"
                  value={formData.insuranceProvider}
                  onChange={(e) => handleChange('insuranceProvider', e.target.value)}
                  disabled={!isEditing}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="policyNumber">Policy / Insurance Number</Label>
                <Input
                  id="policyNumber"
                  value={formData.insuranceNumber}
                  onChange={(e) => handleChange('insuranceNumber', e.target.value)}
                  disabled={!isEditing}
                />
              </div>

              {user?.role === 'patient' && (
                <div className="space-y-2">
                  <Label htmlFor="nationalId">National ID</Label>
                  <Input
                    id="nationalId"
                    value={formData.nationalId}
                    onChange={(e) => handleChange('nationalId', e.target.value)}
                    disabled={!isEditing}
                  />
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <CreditCard className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">Insurance Card</p>
                    <p className="mb-3">Upload a photo of your insurance card for quick verification</p>
                    <input
                      ref={cardInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,.pdf"
                      className="hidden"
                      onChange={handleCardUpload}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      onClick={() => cardInputRef.current?.click()}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Card
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
