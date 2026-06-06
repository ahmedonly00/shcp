import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import { Calendar } from '@/app/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/app/components/ui/dialog';
import {
  Calendar as CalendarIcon, Search, Video, MessageSquare,
  Clock, Check, Filter, ChevronRight, User, Loader2, Plus, Stethoscope, Bell, X, Activity
} from 'lucide-react';
import { providersApi } from '@/app/api/providers';
import { appointmentsApi } from '@/app/api/appointments';
import { patientsApi } from '@/app/api/patients';
import { waitlistApi, WaitlistEntry } from '@/app/api/waitlist';
import { Appointment, ApiProviderSummary, ApiSlot, mapApiAppointment, toBackendApptType, isAppointmentExpired } from '@/app/types';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { useAuth } from '@/app/context/AuthContext';

interface AppointmentSchedulingProps {
  onJoinConsultation?: (appointment: Appointment) => void;
  onNavigateToSymptomChecker?: () => void;
}

export const AppointmentScheduling: React.FC<AppointmentSchedulingProps> = ({ onJoinConsultation, onNavigateToSymptomChecker }) => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const isProvider = user?.role === 'doctor';

  const [step, setStep] = useState<'search' | 'select-time' | 'details' | 'confirmation'>('search');
  const [selectedProvider, setSelectedProvider] = useState<ApiProviderSummary | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<ApiSlot | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [appointmentType, setAppointmentType] = useState<'video' | 'chat' | 'follow-up'>('video');
  const [notes, setNotes] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSpecialty, setFilterSpecialty] = useState('all');
  const [cancelReason, setCancelReason] = useState('');

  const [providers, setProviders] = useState<ApiProviderSummary[]>([]);
  const [slots, setSlots] = useState<ApiSlot[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loadingBook, setLoadingBook] = useState(false);
  const [loadingAppointments, setLoadingAppointments] = useState(true);

  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [confirmedAppointment, setConfirmedAppointment] = useState<Appointment | null>(null);

  const [waitlistEntries, setWaitlistEntries] = useState<WaitlistEntry[]>([]);
  const [joiningWaitlist, setJoiningWaitlist] = useState(false);
  const [hasSymptomReport, setHasSymptomReport] = useState<boolean | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [detailAppointment, setDetailAppointment] = useState<Appointment | null>(null);

  // Load providers and appointments on mount
  useEffect(() => {
    const load = async () => {
      try {
        const apptsFetch = isProvider
          ? providersApi.getMyAppointments(0, 50)
          : patientsApi.getMyAppointments(0, 20);
        const [prov, appts, wl, symptoms] = await Promise.allSettled([
          isProvider ? Promise.resolve([]) : providersApi.list(),
          apptsFetch,
          isProvider ? Promise.resolve([]) : waitlistApi.myEntries(),
          isProvider ? Promise.resolve([]) : patientsApi.getMySymptomReports(0, 1),
        ]);
        if (prov.status === 'fulfilled') setProviders((prov.value as ApiProviderSummary[]) ?? []);
        if (appts.status === 'fulfilled') setAppointments((appts.value ?? []).map(mapApiAppointment));
        if (wl.status === 'fulfilled') setWaitlistEntries((wl.value as WaitlistEntry[]) ?? []);
        if (!isProvider) {
          setHasSymptomReport(
            symptoms.status === 'fulfilled' && (symptoms.value as unknown[]).length > 0
          );
        }
      } finally {
        setLoadingProviders(false);
        setLoadingAppointments(false);
      }
    };
    load();
  }, [isProvider]);

  // Load slots when provider + date selected
  useEffect(() => {
    if (!selectedProvider || !selectedDate) { setSlots([]); return; }
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    setLoadingSlots(true);
    setSelectedSlot(null);
    providersApi.getAvailability(selectedProvider.providerId, dateStr)
      .then(s => setSlots((s ?? []).filter(sl => !sl.isBooked)))
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [selectedProvider, selectedDate]);

  const specialties = Array.from(new Set(providers.map(p => p.specialty).filter(Boolean)));

  const filteredProviders = providers.filter(p => {
    const matchName = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchSpec = p.specialty?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchFilter = filterSpecialty === 'all' || p.specialty === filterSpecialty;
    return (matchName || matchSpec) && matchFilter;
  });

  const handleProviderSelect = (provider: ApiProviderSummary) => {
    setSelectedProvider(provider);
    setStep('select-time');
  };

  const handleBookAppointment = async () => {
    if (!selectedProvider || !selectedSlot) {
      toast.error('Please select a date and time slot');
      return;
    }
    setLoadingBook(true);
    try {
      const result = await appointmentsApi.book({
        providerId: selectedProvider.providerId,
        slotId: selectedSlot.slotId,
        type: toBackendApptType(appointmentType) as 'VIDEO' | 'FOLLOWUP' | 'URGENT',
        notes,
      });
      const mapped = mapApiAppointment(result);
      setConfirmedAppointment(mapped);
      setAppointments(prev => [mapped, ...prev]);
      toast.success('Appointment booked successfully!');
      setStep('confirmation');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e?.response?.data?.message || 'Failed to book appointment');
    } finally {
      setLoadingBook(false);
    }
  };

  const resetBooking = () => {
    setStep('search');
    setSelectedProvider(null);
    setSelectedSlot(null);
    setSelectedDate(undefined);
    setNotes('');
    setConfirmedAppointment(null);
  };

  const handleCancelConfirm = async () => {
    if (!selectedAppointment) return;
    try {
      await appointmentsApi.cancel(selectedAppointment.id, { reason: cancelReason || (isProvider ? 'Cancelled by provider' : 'Cancelled by patient') });
      setAppointments(prev => prev.map(a => a.id === selectedAppointment.id ? { ...a, status: 'cancelled' } : a));
      toast.success('Appointment cancelled');
    } catch {
      toast.error('Failed to cancel appointment');
    } finally {
      setShowCancelDialog(false);
      setCancelReason('');
    }
  };

  const handleJoinWaitlist = async () => {
    if (!selectedProvider || !selectedDate) return;
    setJoiningWaitlist(true);
    try {
      const entry = await waitlistApi.join({
        providerId: selectedProvider.providerId,
        date: format(selectedDate, 'yyyy-MM-dd'),
        type: appointmentType === 'video' ? 'VIDEO' : appointmentType === 'chat' ? 'URGENT' : 'FOLLOWUP',
      });
      setWaitlistEntries(prev => [entry, ...prev]);
      toast.success(`Added to waitlist (position #${entry.position}). You'll be notified when a slot opens.`);
      setStep('search');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { message?: string }; message?: string } } };
      toast.error(
        e?.response?.data?.error?.message ?? e?.response?.data?.message ?? 'Failed to join waitlist'
      );
    } finally {
      setJoiningWaitlist(false);
    }
  };

  const handleLeaveWaitlist = async (entryId: string) => {
    try {
      await waitlistApi.leave(entryId);
      setWaitlistEntries(prev => prev.filter(e => e.entryId !== entryId));
      toast.success('Removed from waitlist');
    } catch {
      toast.error('Failed to leave waitlist');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{t("appointments.title")}</h2>
          <p className="text-muted-foreground">{isProvider ? t('appointments.managePatientApts') : t('appointments.bookAndManage')}</p>
        </div>
        {step === 'search' && (
          <Button onClick={() => setStep('search')} className="hidden">
            <Plus className="mr-2 h-4 w-4" /> New Appointment
          </Button>
        )}
      </div>

      {/* Booking flow — steps 2, 3, 4 override the tabs */}
      {step !== 'search' && step !== 'confirmation' && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <button type="button" onClick={resetBooking} className="hover:underline text-primary">Appointments</button>
          <ChevronRight className="h-4 w-4" />
          {step === 'select-time' && <span>Select Date & Time</span>}
          {step === 'details' && (
            <>
              <button type="button" onClick={() => setStep('select-time')} className="hover:underline text-primary">Select Date & Time</button>
              <ChevronRight className="h-4 w-4" />
              <span>Confirm Details</span>
            </>
          )}
        </div>
      )}

      {/* MAIN TABS — only shown on search step */}
      {step === 'search' && (
        <Tabs defaultValue={isProvider ? 'my' : 'book'}>
          <TabsList className="mb-4 w-full">
            {!isProvider && (
              <TabsTrigger value="book" className="flex items-center gap-1.5 flex-1">
                <Plus className="h-4 w-4 shrink-0" />
                <span className="hidden xs:inline sm:inline">{t('appointments.book')}</span>
                <span className="xs:hidden sm:hidden">Book</span>
              </TabsTrigger>
            )}
            <TabsTrigger value="my" className="flex items-center gap-1.5 flex-1">
              <CalendarIcon className="h-4 w-4 shrink-0" />
              <span className="hidden xs:inline sm:inline">My Appointments</span>
              <span className="xs:hidden sm:hidden">Mine</span>
              {appointments.filter(a => a.status === 'scheduled').length > 0 && (
                <Badge variant="default" className="ml-1 text-xs h-5 px-1.5">
                  {appointments.filter(a => a.status === 'scheduled').length}
                </Badge>
              )}
            </TabsTrigger>
            {!isProvider && (
              <TabsTrigger value="waitlist" className="flex items-center gap-1.5 flex-1">
                <Bell className="h-4 w-4 shrink-0" />
                <span className="hidden xs:inline sm:inline">Waitlist</span>
                <span className="xs:hidden sm:hidden">Wait</span>
                {waitlistEntries.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs h-5 px-1.5">{waitlistEntries.length}</Badge>
                )}
              </TabsTrigger>
            )}
          </TabsList>

          {/* ── TAB: Book (patients only) ── */}
          {!isProvider && (
          <TabsContent value="book" className="space-y-4">
            {hasSymptomReport === false && (
              <Card className="border-2 border-amber-200 bg-amber-50">
                <CardContent className="pt-6 pb-6">
                  <div className="flex flex-col items-center text-center gap-4">
                    <div className="h-14 w-14 rounded-full bg-amber-100 flex items-center justify-center">
                      <Activity className="h-7 w-7 text-amber-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-amber-900 mb-1">Symptom Check Required</h3>
                      <p className="text-sm text-amber-700 max-w-md">
                        To ensure you receive the most appropriate care, please complete the AI Symptom Checker before booking an appointment. This helps match you with the right specialist.
                      </p>
                    </div>
                    <Button
                      className="bg-amber-600 hover:bg-amber-700 text-white"
                      onClick={onNavigateToSymptomChecker}
                    >
                      <Activity className="mr-2 h-4 w-4" />
                      Go to Symptom Checker
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
            {hasSymptomReport !== false && (<>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Stethoscope className="h-5 w-5 text-primary" />
                  Find a Doctor
                </CardTitle>
                <CardDescription>Search by name or specialization, then click <strong>{t("appointments.book")}</strong></CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground/70" />
                    <Input placeholder="Search by name or specialization..." className="pl-10"
                      value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                  </div>
                  <Select value={filterSpecialty} onValueChange={setFilterSpecialty}>
                    <SelectTrigger className="w-48">
                      <Filter className="mr-2 h-4 w-4" />
                      <SelectValue placeholder="All Specializations" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Specializations</SelectItem>
                      {specialties.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {loadingProviders ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/70" />
              </div>
            ) : filteredProviders.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Stethoscope className="h-12 w-12 text-muted-foreground/70 mx-auto mb-3" />
                  <p className="text-muted-foreground font-medium">No providers found</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">Try adjusting your search or filter</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {filteredProviders.map(provider => (
                  <Card key={provider.providerId} className="hover:shadow-lg transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
                          {provider.name.split(' ').map((n: string) => n[0]).join('')}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-lg mb-1">{provider.name}</h3>
                          <Badge variant="secondary" className="mb-2">{provider.specialty || 'General Practice'}</Badge>
                          {provider.facility && (
                            <p className="text-sm text-muted-foreground mb-2">{provider.facility}</p>
                          )}
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                            <span className="flex items-center gap-1 text-green-600 font-medium">
                              <Check className="h-3 w-3" />Verified
                            </span>
                            <span className="flex items-center gap-1 text-blue-600">
                              <Clock className="h-3 w-3" />Available
                            </span>
                          </div>
                          <Button
                            size="sm"
                            className="w-full bg-primary hover:bg-primary/90"
                            onClick={(e) => { e.stopPropagation(); handleProviderSelect(provider); }}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            Book Appointment
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            </>)}
          </TabsContent>
          )}

          {/* ── TAB: My Appointments ── */}
          <TabsContent value="my">
            <Card>
              <CardHeader>
                <CardTitle>My Appointments</CardTitle>
                <CardDescription>Your upcoming and past consultations</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingAppointments ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground/70" /></div>
                ) : appointments.length === 0 ? (
                  <div className="text-center py-12">
                    <CalendarIcon className="h-12 w-12 text-muted-foreground/70 mx-auto mb-3" />
                    <p className="text-muted-foreground font-medium">No appointments yet</p>
                    <p className="text-sm text-muted-foreground/70 mb-4">Book your first consultation from the Book Appointment tab</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {appointments.map(apt => (
                      <div
                        key={apt.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer"
                        onClick={() => { setDetailAppointment(apt); setShowDetailDialog(true); }}
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                            <User className="h-6 w-6 text-blue-600" />
                          </div>
                          <div>
                            <h4 className="font-medium">{isProvider ? apt.patientName : apt.doctorName}</h4>
                            <p className="text-sm text-muted-foreground">{isProvider ? 'Patient' : apt.doctorSpecialization}</p>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-muted-foreground">{apt.date} at {apt.time}</span>
                              {(() => {
                                const expired = isAppointmentExpired(apt);
                                return (
                                  <Badge
                                    variant={
                                      expired                      ? 'outline'   :
                                      apt.status === 'scheduled'   ? 'default'   :
                                      apt.status === 'completed'   ? 'secondary' :
                                      apt.status === 'in-progress' ? 'default'   : 'outline'
                                    }
                                    className={`text-xs capitalize ${
                                      expired                      ? 'bg-red-100 text-red-700 border-red-200' :
                                      apt.status === 'in-progress' ? 'bg-green-100 text-green-700' : ''
                                    }`}>
                                    {expired ? 'Expired' : apt.status}
                                  </Badge>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                          {apt.status === 'in-progress' && !isProvider && onJoinConsultation && (
                            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => onJoinConsultation(apt)}>
                              <Video className="h-4 w-4 mr-1" /> Join
                            </Button>
                          )}
                          {apt.status === 'scheduled' && (
                            <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700 border-red-200"
                              onClick={() => { setSelectedAppointment(apt); setShowCancelDialog(true); }}>
                              Cancel
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── TAB: Waitlist (patients only) ── */}
          {!isProvider && (
          <TabsContent value="waitlist">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-primary" />
                  My Waitlist
                </CardTitle>
                <CardDescription>
                  You'll be notified when a slot becomes available for waitlisted providers.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {waitlistEntries.length === 0 ? (
                  <div className="text-center py-12">
                    <Bell className="h-12 w-12 text-muted-foreground/70 mx-auto mb-3" />
                    <p className="text-muted-foreground font-medium">Not on any waitlists</p>
                    <p className="text-sm text-muted-foreground/70">When all slots are booked, you can join the waitlist from the booking flow.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {waitlistEntries.map(entry => (
                      <div key={entry.entryId} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <User className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium">{entry.providerName}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                              <CalendarIcon className="h-3 w-3" />
                              <span>{entry.date}</span>
                              <span>·</span>
                              <Badge variant="secondary" className="text-xs">#{entry.position} in queue</Badge>
                              {entry.notified && (
                                <Badge className="text-xs bg-green-100 text-green-800">Slot Available!</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700 border-red-200"
                          onClick={() => handleLeaveWaitlist(entry.entryId)}>
                          <X className="h-4 w-4 mr-1" /> Leave
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          )}
        </Tabs>
      )}

      {/* Step: Select date/time */}
      {step === 'select-time' && selectedProvider && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Select Date & Time</CardTitle>
                <CardDescription>Booking with {selectedProvider.name} — {selectedProvider.specialty}</CardDescription>
              </div>
              <Button variant="outline" onClick={() => setStep('search')}>Change Doctor</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Select Date</Label>
                <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate}
                  className="rounded-md border"
                  disabled={d => d < new Date() || d > new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)} />
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Appointment Type</Label>
                  <Select value={appointmentType} onValueChange={(v: typeof appointmentType) => setAppointmentType(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="video">
                        <div className="flex items-center gap-2"><Video className="h-4 w-4" />Video Consultation</div>
                      </SelectItem>
                      <SelectItem value="chat">
                        <div className="flex items-center gap-2"><MessageSquare className="h-4 w-4" />Urgent Consultation</div>
                      </SelectItem>
                      <SelectItem value="follow-up">
                        <div className="flex items-center gap-2"><CalendarIcon className="h-4 w-4" />Follow-up Visit</div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {selectedDate && (
                  <div className="space-y-2">
                    <Label>Available Time Slots</Label>
                    {loadingSlots ? (
                      <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground/70" /></div>
                    ) : slots.length === 0 ? (
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">No slots available for this date</p>
                        {!isProvider && (
                          <Button size="sm" variant="outline" className="w-full" disabled={joiningWaitlist}
                            onClick={handleJoinWaitlist}>
                            {joiningWaitlist ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Bell className="h-4 w-4 mr-1" />}
                            Join Waitlist for This Date
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                        {slots.map(slot => {
                          const time = new Date(slot.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                          return (
                            <Button key={slot.slotId} type="button" size="sm"
                              variant={selectedSlot?.slotId === slot.slotId ? 'default' : 'outline'}
                              onClick={() => setSelectedSlot(slot)}>
                              {time}
                            </Button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
                {selectedDate && selectedSlot && (
                  <Button className="w-full" onClick={() => setStep('details')}>Continue</Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Details */}
      {step === 'details' && selectedProvider && selectedSlot && (
        <Card>
          <CardHeader>
            <CardTitle>Appointment Details</CardTitle>
            <CardDescription>Provide notes for your visit</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium mb-2">Appointment Summary</h4>
              <div className="space-y-1 text-sm">
                <p><strong>Doctor:</strong> {selectedProvider.name}</p>
                <p><strong>Specialization:</strong> {selectedProvider.specialty}</p>
                <p><strong>Date:</strong> {selectedDate && format(selectedDate, 'EEEE, MMMM d, yyyy')}</p>
                <p><strong>Time:</strong> {new Date(selectedSlot.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                <p><strong>Type:</strong> {appointmentType === 'video' ? 'Video Consultation' : appointmentType === 'chat' ? 'Urgent Consultation' : 'Follow-up Visit'}</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea id="notes" placeholder="Describe your symptoms or reason for consultation..."
                rows={5} value={notes} onChange={e => setNotes(e.target.value)} />
              <p className="text-xs text-muted-foreground">This helps the doctor prepare for your consultation</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep('select-time')}>Back</Button>
              <Button className="flex-1" onClick={handleBookAppointment} disabled={loadingBook}>
                {loadingBook ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />Booking...
                  </span>
                ) : 'Confirm Booking'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Confirmation */}
      {step === 'confirmation' && confirmedAppointment && (
        <Card className="border-2 border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="h-16 w-16 rounded-full bg-green-600 text-white flex items-center justify-center">
                  <Check className="h-8 w-8" />
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-green-900 mb-2">Appointment Confirmed!</h3>
                <p className="text-green-700">Your appointment has been successfully scheduled</p>
              </div>
              <div className="bg-card rounded-lg p-6 text-left max-w-md mx-auto">
                <h4 className="font-semibold mb-3">Appointment Details</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Doctor:</span>
                    <span className="font-medium">{confirmedAppointment.doctorName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date:</span>
                    <span className="font-medium">{confirmedAppointment.date}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Time:</span>
                    <span className="font-medium">{confirmedAppointment.time}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type:</span>
                    <span className="font-medium capitalize">{confirmedAppointment.type}</span>
                  </div>
                  <div className="pt-2 border-t">
                    <span className="text-muted-foreground text-xs">ID: </span>
                    <span className="font-mono text-xs">{confirmedAppointment.id.slice(0, 8)}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 justify-center flex-wrap">
                <Button onClick={resetBooking}>Book Another Appointment</Button>
                <Button variant="outline" onClick={() => { resetBooking(); }}>View My Appointments</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Appointment Details Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Appointment Details</DialogTitle>
          </DialogHeader>
          {detailAppointment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">{isProvider ? 'Patient' : 'Doctor'}</p>
                  <p className="font-medium">{isProvider ? detailAppointment.patientName : detailAppointment.doctorName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge className="capitalize">{detailAppointment.status}</Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Date</p>
                  <p className="font-medium">{detailAppointment.date}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Time</p>
                  <p className="font-medium">{detailAppointment.time}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Type</p>
                  <p className="font-medium capitalize">{detailAppointment.type}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Duration</p>
                  <p className="font-medium">{detailAppointment.duration} min</p>
                </div>
              </div>
              {detailAppointment.reason && (
                <div>
                  <p className="text-muted-foreground text-sm">Reason</p>
                  <p className="text-sm mt-1 bg-muted/50 rounded p-2">{detailAppointment.reason}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            {detailAppointment?.status === 'scheduled' && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => { setShowDetailDialog(false); setSelectedAppointment(detailAppointment); setShowCancelDialog(true); }}
              >
                Cancel Appointment
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setShowDetailDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Appointment</DialogTitle>
            <DialogDescription>Please provide a reason for cancellation.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea placeholder="Reason for cancellation..." value={cancelReason}
              onChange={e => setCancelReason(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>Back</Button>
            <Button className="bg-red-500 text-white hover:bg-red-600" onClick={handleCancelConfirm}>
              Confirm Cancellation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
