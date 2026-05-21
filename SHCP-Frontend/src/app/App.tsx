import React, { useState, useRef, useEffect, Component, ReactNode, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useTranslation } from "react-i18next";
import { useIdleTimeout } from '@/app/hooks/useIdleTimeout';
import { onForegroundMessage } from '@/firebase';
import { toast } from 'sonner';

// ─── Error Boundary ──────────────────────────────────────────────────────────
interface EBState { hasError: boolean; message: string; }
class ErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error?.message || 'Something went wrong' };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Component error:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] gap-4 p-8 text-center">
          <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center">
            <span className="text-3xl">⚠️</span>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-1">Something went wrong</h3>
            <p className="text-sm text-muted-foreground max-w-sm">{this.state.message}</p>
          </div>
          <button
            onClick={() => { this.setState({ hasError: false, message: '' }); window.location.reload(); }}
            className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition-colors"
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
import {
  AuthProvider,
  useAuth,
} from "@/app/context/AuthContext";
import { HomePage } from "@/app/components/HomePage";
import { EnhancedAuthPage } from "@/app/components/EnhancedAuthPage";
import { PatientDashboard } from "@/app/components/PatientDashboard";
import { SymptomChecker } from "@/app/components/SymptomChecker";
import { AppointmentScheduling } from "@/app/components/AppointmentScheduling";
import { Teleconsultation } from "@/app/components/Teleconsultation";
import { HealthRecords } from "@/app/components/HealthRecords";
import { Prescriptions } from "@/app/components/Prescriptions";
import { Notifications } from "@/app/components/Notifications";
import { DoctorPortal } from "@/app/components/DoctorPortal";
import { Appointment } from "@/app/types";
import { Analytics } from "@/app/components/Analytics";
import { PharmacyManagement } from "@/app/components/PharmacyManagement";
import { MobileHealth } from "@/app/components/MobileHealth";
import { Profile } from "@/app/components/Profile";
import { HelpSupport } from "@/app/components/HelpSupport";
import { Messages } from "@/app/components/Messages";
import { PharmacistDashboard } from "@/app/components/PharmacistDashboard";
import { BikerDashboard } from "@/app/components/BikerDashboard";
import { Button } from "@/app/components/ui/button";
import { Badge } from "@/app/components/ui/badge";
import {
  Avatar,
  AvatarFallback,
} from "@/app/components/ui/avatar";
import { Toaster } from "@/app/components/ui/sonner";
import {
  Home,
  Activity,
  Calendar,
  Video,
  FileText,
  Bell,
  Stethoscope,
  BarChart,
  Smartphone,
  User,
  LogOut,
  Menu,
  X,
  Settings,
  HelpCircle,
  MessageSquare,
  Plus,
  Globe,
  Package,
  Bike,
  Building2,
  AlertCircle,
  Pill,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";

type View =
  | "dashboard"
  | "symptom-checker"
  | "appointments"
  | "teleconsultation"
  | "health-records"
  | "prescriptions"
  | "notifications"
  | "doctor-portal"
  | "analytics"
  | "mobile-health"
  | "profile"
  | "help"
  | "messages"
  | "pharmacist-dashboard"
  | "biker-dashboard"
  | "pharmacies";

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'rw', label: 'Kinyarwanda', flag: '🇷🇼' },
];

const MainApp: React.FC = () => {
  const { user, logout, isAuthenticated, isLoading } = useAuth();
  const { t, i18n } = useTranslation();
  const [currentView, setCurrentView] =
    useState<View>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [consultationAppointment, setConsultationAppointment] = useState<Appointment | null>(null);
  const [profileBannerDismissed, setProfileBannerDismissed] = useState(false);
  const showProfileBanner = user?.role === 'patient' && user.profileComplete === false && !profileBannerDismissed;

  const changeLanguage = (code: string) => {
    i18n.changeLanguage(code);
    localStorage.setItem('shcp_language', code);
  };

  // FR1: Session timeout — log out after 30 minutes of inactivity
  const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
  const handleIdle = useCallback(() => {
    if (isAuthenticated) {
      logout();
    }
  }, [isAuthenticated, logout]);
  useIdleTimeout(handleIdle, SESSION_TIMEOUT_MS);

  // Show foreground push notifications as toasts while the app is open.
  // Background messages (tab closed) are handled by firebase-messaging-sw.js.
  useEffect(() => {
    const unsubscribe = onForegroundMessage((payload) => {
      const title = payload.notification?.title ?? 'SHCP Notification';
      const body  = payload.notification?.body  ?? '';
      toast(title, {
        description: body,
        duration: 6000,
      });
    });
    return unsubscribe;
  }, []);

  // Detect logout: when isAuthenticated transitions true → false, show auth page
  const prevAuthRef = useRef(isAuthenticated);
  useEffect(() => {
    if (prevAuthRef.current && !isAuthenticated) {
      setShowAuth(true);
    }
    prevAuthRef.current = isAuthenticated;
  }, [isAuthenticated]);

  // Set initial view based on role - must be before early return
  React.useEffect(() => {
    if (user?.role === "doctor") {
      setCurrentView("doctor-portal");
    } else if (user?.role === "admin") {
      setCurrentView("analytics");
    } else if (user?.role === "pharmacist") {
      setCurrentView("pharmacist-dashboard");
    } else if (user?.role === "biker") {
      setCurrentView("biker-dashboard");
    } else {
      setCurrentView("dashboard");
    }
  }, [user?.role]);

  // While restoring session from localStorage, show a spinner
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div
          className="flex flex-col items-center gap-4"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <div className="h-12 w-12 bg-primary rounded-xl flex items-center justify-center shadow-md">
            <Activity className="h-7 w-7 text-white animate-pulse" />
          </div>
          <p className="text-sm font-medium text-primary">{t('app.loading')}</p>
        </motion.div>
      </div>
    );
  }

  // Show home page if not authenticated and auth not triggered
  if (!isAuthenticated && !showAuth) {
    return <HomePage onGetStarted={() => setShowAuth(true)} />;
  }

  // Show auth page if not authenticated and user clicked get started
  if (!isAuthenticated && showAuth) {
    return (
      <EnhancedAuthPage
        onAuthSuccess={() => setShowAuth(false)}
        onBack={() => setShowAuth(false)}
      />
    );
  }

  // Restrict views by role
  const canAccess = (view: View): boolean => {
    if (!user) return false;
    if (view === "analytics" && user.role !== "admin") return false;
    if (view === "pharmacies" && user.role !== "admin") return false;
    if (view === "doctor-portal" && user.role !== "doctor") return false;
    if (view === "pharmacist-dashboard" && user.role !== "pharmacist") return false;
    if (view === "biker-dashboard" && user.role !== "biker") return false;
    return true;
  };

  type MenuItem = { id: View; icon: React.ReactNode; label: string; badge?: number };

  const patientMenuItems: MenuItem[] = [
    { id: "dashboard" as View, icon: <Home className="h-5 w-5" />, label: t('nav.dashboard') },
    { id: "symptom-checker" as View, icon: <Activity className="h-5 w-5" />, label: t('nav.symptomChecker') },
    { id: "appointments" as View, icon: <Calendar className="h-5 w-5" />, label: t('nav.appointments') },
    { id: "teleconsultation" as View, icon: <Video className="h-5 w-5" />, label: t('nav.teleconsultation') },
    { id: "health-records" as View, icon: <FileText className="h-5 w-5" />, label: t('nav.healthRecords') },
    { id: "prescriptions" as View, icon: <Pill className="h-5 w-5" />, label: 'Prescriptions' },
    { id: "mobile-health" as View, icon: <Smartphone className="h-5 w-5" />, label: t('nav.mobileHealth') },
    { id: "notifications" as View, icon: <Bell className="h-5 w-5" />, label: t('nav.notifications'), badge: 2 },
  ];

  const doctorMenuItems: MenuItem[] = [
    { id: "doctor-portal" as View, icon: <Stethoscope className="h-5 w-5" />, label: t('nav.doctorPortal') },
    { id: "appointments" as View, icon: <Calendar className="h-5 w-5" />, label: t('nav.appointments') },
    { id: "teleconsultation" as View, icon: <Video className="h-5 w-5" />, label: t('nav.consultation') },
    { id: "prescriptions" as View, icon: <Pill className="h-5 w-5" />, label: 'Prescriptions' },
    { id: "notifications" as View, icon: <Bell className="h-5 w-5" />, label: t('nav.notifications'), badge: 3 },
  ];

  const adminMenuItems: MenuItem[] = [
    { id: "analytics" as View, icon: <BarChart className="h-5 w-5" />, label: t('nav.analytics') },
    { id: "pharmacies" as View, icon: <Building2 className="h-5 w-5" />, label: "Pharmacies" },
    { id: "notifications" as View, icon: <Bell className="h-5 w-5" />, label: t('nav.notifications') },
  ];

  const pharmacistMenuItems: MenuItem[] = [
    { id: "pharmacist-dashboard" as View, icon: <Package className="h-5 w-5" />, label: "Pharmacy Dashboard" },
    { id: "notifications" as View, icon: <Bell className="h-5 w-5" />, label: t('nav.notifications') },
  ];

  const bikerMenuItems: MenuItem[] = [
    { id: "biker-dashboard" as View, icon: <Bike className="h-5 w-5" />, label: "Delivery Dashboard" },
    { id: "notifications" as View, icon: <Bell className="h-5 w-5" />, label: t('nav.notifications') },
  ];

  const menuItems =
    user?.role === "doctor"      ? doctorMenuItems
    : user?.role === "admin"     ? adminMenuItems
    : user?.role === "pharmacist"? pharmacistMenuItems
    : user?.role === "biker"     ? bikerMenuItems
    : patientMenuItems;

  const renderView = () => {
    const view = canAccess(currentView)
      ? currentView
      : (user?.role === "doctor"      ? "doctor-portal"
        : user?.role === "admin"      ? "analytics"
        : user?.role === "pharmacist" ? "pharmacist-dashboard"
        : user?.role === "biker"      ? "biker-dashboard"
        : "dashboard") as View;

    return (
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          <ErrorBoundary key={view}>{renderViewContent(view)}</ErrorBoundary>
        </motion.div>
      </AnimatePresence>
    );
  };

  const renderViewFor = (view: View) => {
    return <ErrorBoundary key={view}>{renderViewContent(view)}</ErrorBoundary>;
  };

  const renderViewContent = (view: View) => {
    switch (view) {
      case "dashboard":
        return user?.role === 'doctor'
          ? <DoctorPortal onNavigateToConsultation={(apt) => { setConsultationAppointment(apt); setCurrentView("teleconsultation"); }} />
          : <PatientDashboard />;
      case "pharmacist-dashboard":
        return <PharmacistDashboard />;
      case "biker-dashboard":
        return <BikerDashboard />;
      case "symptom-checker":
        return <SymptomChecker onNavigateToAppointments={() => setCurrentView("appointments")} />;
      case "appointments":
        return (
          <AppointmentScheduling
            onJoinConsultation={(apt) => {
              setConsultationAppointment(apt);
              setCurrentView("teleconsultation");
            }}
            onNavigateToSymptomChecker={() => setCurrentView("symptom-checker")}
          />
        );
      case "teleconsultation":
        return <Teleconsultation appointment={consultationAppointment ?? undefined} />;
      case "health-records":
        return <HealthRecords />;
      case "prescriptions":
        return <Prescriptions />;
      case "notifications":
        return <Notifications />;
      case "doctor-portal":
        return (
          <DoctorPortal
            onNavigateToConsultation={(apt) => {
              setConsultationAppointment(apt);
              setCurrentView("teleconsultation");
            }}
          />
        );
      case "analytics":
        return <Analytics />;
      case "pharmacies":
        return <PharmacyManagement />;
      case "mobile-health":
        return <MobileHealth />;
      case "profile":
        return <Profile />;
      case "help":
        return <HelpSupport />;
      case "messages":
        return <Messages />;
      default:
        return user?.role === 'doctor'
          ? <DoctorPortal onNavigateToConsultation={(apt) => { setConsultationAppointment(apt); setCurrentView("teleconsultation"); }} />
          : user?.role === 'pharmacist' ? <PharmacistDashboard />
          : user?.role === 'biker'      ? <BikerDashboard />
          : <PatientDashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation Bar */}
      <nav className="bg-background/95 backdrop-blur-sm border-b border-border fixed w-full top-0 z-40">
        <div className="px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden"
            >
              {sidebarOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-primary rounded-lg flex items-center justify-center">
                <Plus className="h-6 w-6 text-white" />
              </div>
              <div className="hidden md:block">
                <h1 className="font-bold text-lg text-primary">
                  SHCP
                </h1>
                <p className="text-xs text-muted-foreground">
                  {t('app.fullName')}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge
              variant="outline"
              className="hidden md:inline-flex border-primary text-primary"
            >
              {user?.role === "patient" ? t('roles.patient')
                : user?.role === "doctor" ? t('roles.doctor')
                : user?.role === "pharmacist" ? "Pharmacist"
                : user?.role === "biker" ? "Biker"
                : t('roles.admin')}
            </Badge>
            {user && !user.verified && (
              <Badge variant="destructive" className="hidden md:inline-flex text-xs">
                {t('roles.unverified')}
              </Badge>
            )}
            {/* Language Switcher */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-primary">
                  <Globe className="h-4 w-4" />
                  <span className="hidden md:inline text-xs font-medium uppercase">{i18n.language}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                {LANGUAGES.map(lang => (
                  <DropdownMenuItem
                    key={lang.code}
                    onClick={() => changeLanguage(lang.code)}
                    className={`gap-2 ${i18n.language === lang.code ? 'font-semibold text-primary' : ''}`}
                  >
                    <span>{lang.flag}</span>
                    <span>{lang.label}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="sm">
              <Bell className="h-5 w-5 text-primary" />
            </Button>
            <div className="flex items-center gap-2 ml-2">
              <Avatar>
                <AvatarFallback className="bg-primary text-white">
                  {user?.name
                    ?.split(" ")
                    ?.map((n: string) => n[0] ?? "")
                    ?.join("") ?? "?"}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:block">
                <p className="text-sm font-medium text-primary">
                  {user?.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {user?.email}
                </p>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Profile completion banner — shown to Google OAuth patients who haven't set dateOfBirth + nationalId yet */}
      {showProfileBanner && (
        <div className="fixed top-16 left-0 right-0 z-30 bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-amber-800">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
            <span>
              Complete your profile to unlock all features — your date of birth and national ID are required for prescriptions and insurance.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-amber-400 text-amber-800 hover:bg-amber-100"
              onClick={() => setCurrentView("profile")}
            >
              Complete Profile
            </Button>
            <button
              aria-label="Dismiss"
              onClick={() => setProfileBannerDismissed(true)}
              className="text-amber-500 hover:text-amber-700 p-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 bg-card border-r border-border transition-all duration-300 z-20 shadow-lg flex flex-col ${
          sidebarOpen ? "w-64" : "w-0 lg:w-20"
        } overflow-hidden ${showProfileBanner ? "top-28 h-[calc(100vh-7rem)]" : "top-16 h-[calc(100vh-4rem)]"}`}
      >
        <div className="p-4 space-y-2 flex-1 overflow-y-auto">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                currentView === item.id
                  ? "bg-primary text-white"
                  : "hover:bg-secondary text-foreground/80"
              }`}
            >
              {item.icon}
              {sidebarOpen && (
                <>
                  <span className="flex-1 text-left">
                    {item.label}
                  </span>
                  {item.badge && (
                    <Badge
                      variant={
                        currentView === item.id
                          ? "secondary"
                          : "default"
                      }
                      className="text-xs"
                    >
                      {item.badge}
                    </Badge>
                  )}
                </>
              )}
            </button>
          ))}

          {/* Settings & Help Section */}
          <div className="pt-4 mt-4 border-t border-border">
            <button
              onClick={() => setCurrentView("profile")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                currentView === "profile"
                  ? "bg-primary text-white"
                  : "hover:bg-secondary text-foreground/80"
              }`}
            >
              <Settings className="h-5 w-5" />
              {sidebarOpen && (
                <span className="flex-1 text-left">{t('nav.settings')}</span>
              )}
            </button>
            <button
              onClick={() => setCurrentView("help")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                currentView === "help"
                  ? "bg-primary text-white"
                  : "hover:bg-secondary text-foreground/80"
              }`}
            >
              <HelpCircle className="h-5 w-5" />
              {sidebarOpen && (
                <span className="flex-1 text-left">{t('nav.helpSupport')}</span>
              )}
            </button>
            <button
              onClick={() => setCurrentView("messages")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                currentView === "messages"
                  ? "bg-primary text-white"
                  : "hover:bg-secondary text-foreground/80"
              }`}
            >
              <MessageSquare className="h-5 w-5" />
              {sidebarOpen && (
                <span className="flex-1 text-left">{t('nav.messages')}</span>
              )}
            </button>
          </div>
        </div>

        <div className="p-4 border-t border-border">
          <button
            onClick={() => logout()}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted text-foreground/80"
          >
            <LogOut className="h-5 w-5" />
            {sidebarOpen && <span>{t('nav.logout')}</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={`transition-all duration-300 ${showProfileBanner ? "pt-28" : "pt-16"} ${
          sidebarOpen ? "lg:pl-64" : "lg:pl-20"
        }`}
      >
        <div className="p-6 max-w-7xl mx-auto">
          {renderView()}
        </div>
      </main>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Footer */}
      <footer
        className={`bg-background border-t border-border py-4 transition-all duration-300 ${
          sidebarOpen ? "lg:pl-64" : "lg:pl-20"
        }`}
      >
        <div className="px-6 text-center text-sm text-muted-foreground">
          <p>{t('app.footer.copyright')}</p>
          <div className="flex items-center justify-center gap-4 mt-2 text-xs">
            <a href="#" className="hover:text-blue-600">{t('app.footer.privacy')}</a>
            <span>•</span>
            <a href="#" className="hover:text-blue-600">{t('app.footer.terms')}</a>
            <span>•</span>
            <a href="#" className="hover:text-blue-600">{t('app.footer.help')}</a>
            <span>•</span>
            <a href="#" className="hover:text-blue-600">{t('app.footer.contact')}</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
      <Toaster />
    </AuthProvider>
  );
}