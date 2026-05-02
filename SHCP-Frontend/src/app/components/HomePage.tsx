import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent } from '@/app/components/ui/card';
import { Sheet, SheetContent, SheetTrigger } from '@/app/components/ui/sheet';
import {
  ArrowRight, Phone, Activity, Calendar, Video,
  FileText, Shield, Users, Star, CheckCircle,
  Heart, Smartphone, Clock, Map, Award, Menu
} from 'lucide-react';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';

interface HomePageProps {
  onGetStarted: () => void;
}

function BrandLogo({ inverted = false }: { inverted?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect width="36" height="36" rx="9" fill={inverted ? 'white' : 'var(--primary)'} />
        <rect x="15.5" y="8" width="5" height="20" rx="2.5" fill={inverted ? 'var(--primary)' : 'white'} />
        <rect x="8" y="15.5" width="20" height="5" rx="2.5" fill={inverted ? 'var(--primary)' : 'white'} />
      </svg>
      <div>
        <span className={`text-lg font-bold block leading-tight tracking-tight ${inverted ? 'text-white' : 'text-primary'}`}>SHCP</span>
        <span className={`text-xs font-medium ${inverted ? 'text-white/70' : 'text-muted-foreground'}`}>Smart Health Consultation Platform</span>
      </div>
    </div>
  );
}

export const HomePage: React.FC<HomePageProps> = ({ onGetStarted }) => {
  const { t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: '#home', label: t('home.page.nav.home') },
    { href: '#services', label: t('home.page.nav.services') },
    { href: '#how-it-works', label: t('home.page.nav.howItWorks') },
    { href: '#about', label: t('home.page.nav.about') },
  ];

  return (
    <div className="min-h-screen bg-background">

      {/* ── Navigation ───────────────────────────────────────────────── */}
      <header className="py-4 px-4 sm:px-6 lg:px-8 sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <BrandLogo />

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map(l => (
              <a key={l.href} href={l.href} className="text-foreground/70 hover:text-primary font-medium transition-colors text-sm">{l.label}</a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Button
              onClick={onGetStarted}
              className="bg-primary hover:bg-primary/90 text-white rounded-full px-5 sm:px-6 text-sm"
            >
              {t('home.page.nav.getStarted')}
            </Button>

            {/* Mobile hamburger */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 pt-12">
                <nav className="flex flex-col gap-1">
                  {navLinks.map(l => (
                    <a
                      key={l.href}
                      href={l.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="text-foreground/80 hover:text-primary hover:bg-primary/5 font-medium transition-colors text-base px-4 py-3 rounded-lg"
                    >
                      {l.label}
                    </a>
                  ))}
                  <div className="mt-4 px-4">
                    <Button onClick={() => { onGetStarted(); setMobileMenuOpen(false); }} className="w-full bg-primary text-white rounded-full">
                      {t('home.page.nav.getStarted')}
                    </Button>
                  </div>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section id="home" className="relative overflow-hidden bg-slate-50">
        <div className="pointer-events-none absolute -top-32 -right-32 h-[600px] w-[600px] rounded-full bg-primary/5 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-72 w-72 rounded-full bg-secondary blur-2xl" />

        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16 lg:py-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">

            {/* Left */}
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-card px-4 py-2 shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                </span>
                <span className="text-sm font-medium text-primary">{t('home.page.hero.badge')}</span>
              </div>

              <div>
                <h1 className="mb-6 text-3xl sm:text-4xl font-bold leading-tight tracking-tight text-primary lg:text-5xl xl:text-6xl" style={{ whiteSpace: 'pre-line' }}>
                  {t('home.page.hero.title')}
                </h1>
                <p className="mb-8 text-lg leading-relaxed text-foreground/70 lg:text-xl">
                  {t('home.page.hero.subtitle')}
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-5">
                {[
                  { icon: <Activity className="h-4 w-4" />, label: t('home.page.hero.features.aiChecker'), desc: t('home.page.hero.features.aiCheckerDesc') },
                  { icon: <Video className="h-4 w-4" />, label: t('home.page.hero.features.videoConsult'), desc: t('home.page.hero.features.videoConsultDesc') },
                  { icon: <Calendar className="h-4 w-4" />, label: t('home.page.hero.features.easyScheduling'), desc: t('home.page.hero.features.easySchedulingDesc') },
                  { icon: <Shield className="h-4 w-4" />, label: t('home.page.hero.features.secure'), desc: t('home.page.hero.features.secureDesc') },
                ].map((f) => (
                  <div key={f.label} className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      {f.icon}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{f.label}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                <Button
                  onClick={onGetStarted}
                  size="lg"
                  className="bg-primary hover:bg-primary/90 rounded-full px-8 text-white shadow-md hover:shadow-lg transition-all duration-200"
                >
                  {t('home.page.hero.startConsultation')}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="rounded-full border-2 border-primary/30 px-8 text-primary hover:border-primary hover:bg-primary/5 transition-all duration-200"
                >
                  <Phone className="mr-2 h-4 w-4" />
                  {t('home.page.hero.contactSupport')}
                </Button>
              </div>

              <div className="flex items-stretch divide-x divide-border border-t border-border pt-6">
                {[
                  { value: '50K+', label: t('home.page.hero.activePatients') },
                  { value: '500+', label: t('home.page.hero.doctors') },
                  { value: '98%',  label: t('home.page.hero.satisfaction') },
                ].map((stat) => (
                  <div key={stat.value} className="flex-1 px-4 first:pl-0 last:pr-0">
                    <p className="text-2xl font-bold tracking-tight text-primary">{stat.value}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right */}
            <div className="relative">
              <div className="relative overflow-hidden rounded-3xl shadow-2xl ring-1 ring-black/5">
                <ImageWithFallback
                  src="https://images.unsplash.com/photo-1666886573681-a8fbe983a3fd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhZnJpY2FuJTIwd29tYW4lMjB2aWRlbyUyMGNhbGwlMjBkb2N0b3IlMjBwaG9uZXxlbnwxfHx8fDE3NjkzMzA2NTJ8MA&ixlib=rb-4.1.0&q=80&w=1080"
                  alt="Rwandan patient having video consultation with doctor"
                  className="h-[260px] sm:h-[380px] lg:h-[500px] xl:h-[580px] w-full object-cover"
                />
                <div className="absolute bottom-6 left-6 right-6 rounded-2xl bg-card/95 p-5 shadow-xl backdrop-blur-sm">
                  <div className="flex items-center gap-4">
                    <div className="rounded-full bg-green-100 p-2.5">
                      <Video className="h-5 w-5 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{t('home.page.footer.liveConsultation')}</p>
                      <p className="text-xs text-muted-foreground truncate">{t('home.page.footer.connectedWith')}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-green-100 px-3 py-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-xs font-medium text-green-700">{t('home.page.footer.active')}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="hidden lg:flex absolute -top-3 -right-3 items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-white shadow-xl">
                <Award className="h-5 w-5 shrink-0" />
                <p className="text-xs font-semibold leading-snug" style={{ whiteSpace: 'pre-line' }}>{t('home.page.footer.ministryApproved')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust Strip ──────────────────────────────────────────────── */}
      <section className="bg-background border-y border-border py-8">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-6">
            Endorsed &amp; Compliant With
          </p>
          <div className="flex flex-wrap items-center justify-center gap-5 sm:gap-8 md:gap-14">
            {[
              { icon: <Award className="h-4 w-4" />, label: 'Ministry of Health, Rwanda' },
              { icon: <Shield className="h-4 w-4" />, label: 'Rwanda Biomedical Centre' },
              { icon: <CheckCircle className="h-4 w-4" />, label: 'Rwanda DPA Compliant' },
              { icon: <Shield className="h-4 w-4" />, label: 'RURA Certified' },
            ].map(({ icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-foreground/60">
                <span className="text-primary">{icon}</span>
                <span className="text-sm font-semibold">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Services ─────────────────────────────────────────────────── */}
      <section id="services" className="bg-background py-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-primary mb-4">{t('home.page.services.title')}</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              {t('home.page.services.subtitle')}
            </p>
          </div>

          {/* Featured: AI Symptom Checker */}
          <div className="mb-6">
            <Card className="border border-primary/20 bg-gradient-to-br from-primary/5 to-background overflow-hidden">
              <CardContent className="p-0">
                <div className="grid lg:grid-cols-5">
                  <div className="lg:col-span-3 p-10">
                    <span className="inline-block text-xs font-bold uppercase tracking-widest text-primary bg-primary/10 px-3 py-1 rounded-full mb-6">
                      Core Technology
                    </span>
                    <div className="bg-primary w-14 h-14 rounded-2xl flex items-center justify-center mb-5 text-white">
                      <Activity className="h-7 w-7" />
                    </div>
                    <h3 className="text-2xl font-bold text-primary mb-3">{t('home.page.services.aiChecker')}</h3>
                    <p className="text-foreground/70 leading-relaxed text-lg mb-6">{t('home.page.services.aiCheckerDesc')}</p>
                    <ul className="space-y-2.5">
                      {[
                        'Supports Kinyarwanda, English & French',
                        'AI-powered differential diagnosis',
                        'Instant triage recommendation in under 30 seconds',
                      ].map((f) => (
                        <li key={f} className="flex items-center gap-2 text-sm text-foreground/70">
                          <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="lg:col-span-2 bg-primary/5 flex items-center justify-center p-10 min-h-[200px]">
                    <div className="text-center space-y-3">
                      <div className="h-20 w-20 rounded-full bg-primary/15 flex items-center justify-center mx-auto">
                        <Activity className="h-10 w-10 text-primary" />
                      </div>
                      <p className="text-sm font-semibold text-primary">AI Symptom Analysis</p>
                      <p className="text-xs text-muted-foreground">Results in under 30 seconds</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Supporting services */}
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-5">
            {[
              { icon: <Video className="h-5 w-5" />, title: t('home.page.services.videoConsult'), desc: t('home.page.services.videoConsultDesc') },
              { icon: <Calendar className="h-5 w-5" />, title: t('home.page.services.appointments'), desc: t('home.page.services.appointmentsDesc') },
              { icon: <FileText className="h-5 w-5" />, title: t('home.page.services.healthRecords'), desc: t('home.page.services.healthRecordsDesc') },
              { icon: <Smartphone className="h-5 w-5" />, title: t('home.page.services.mobileHealth'), desc: t('home.page.services.mobileHealthDesc') },
              { icon: <Shield className="h-5 w-5" />, title: t('home.page.services.secure'), desc: t('home.page.services.secureDesc') },
            ].map((s, i) => (
              <Card key={i} className="border border-border hover:border-primary/30 hover:shadow-md transition-all bg-card">
                <CardContent className="p-6">
                  <div className="bg-secondary w-10 h-10 rounded-xl flex items-center justify-center mb-4 text-primary">
                    {s.icon}
                  </div>
                  <h3 className="text-sm font-bold text-primary mb-2">{s.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────────────────── */}
      <section id="how-it-works" className="bg-slate-50 py-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-primary mb-4">{t('home.page.howItWorks.title')}</h2>
            <p className="text-xl text-foreground/70 max-w-2xl mx-auto">
              {t('home.page.howItWorks.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-10">
            {[
              { step: '01', title: t('home.page.howItWorks.step1Title'), desc: t('home.page.howItWorks.step1Desc'), icon: <Users className="h-5 w-5" /> },
              { step: '02', title: t('home.page.howItWorks.step2Title'), desc: t('home.page.howItWorks.step2Desc'), icon: <CheckCircle className="h-5 w-5" /> },
              { step: '03', title: t('home.page.howItWorks.step3Title'), desc: t('home.page.howItWorks.step3Desc'), icon: <Heart className="h-5 w-5" /> },
            ].map((item, i) => (
              <div key={i} className="relative flex flex-col gap-4">
                {/* connector line between steps */}
                {i < 2 && (
                  <div className="hidden md:block absolute top-5 left-full w-10 border-t-2 border-dashed border-primary/20 -translate-y-1/2 z-0" />
                )}
                <div className="flex items-start gap-4">
                  <span className="text-4xl sm:text-5xl md:text-6xl font-black text-primary/10 leading-none select-none shrink-0 -mt-2">{item.step}</span>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="bg-primary/10 text-primary rounded-lg p-1.5 shrink-0">{item.icon}</div>
                      <h3 className="text-lg font-bold text-primary">{item.title}</h3>
                    </div>
                    <p className="text-muted-foreground leading-relaxed text-sm">{item.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-14">
            <Button
              onClick={onGetStarted}
              size="lg"
              className="bg-primary hover:bg-primary/90 text-white rounded-full px-10 shadow-lg"
            >
              {t('home.page.howItWorks.startFree')}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* ── Testimonials ─────────────────────────────────────────────── */}
      <section className="bg-background py-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-primary mb-4">{t('home.page.testimonials.title')}</h2>
            <p className="text-xl text-muted-foreground">{t('home.page.testimonials.subtitle')}</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-6">
            {[
              {
                name: 'Marie Uwase',
                role: 'Patient · Kigali · 2 years',
                color: 'from-blue-500 to-blue-700',
                rating: 5,
                text: 'I can now consult with doctors from my village without traveling to Kigali. The AI symptom checker helped me understand my condition before the consultation. Amazing service!'
              },
              {
                name: 'Jean Baptiste Nkusi',
                role: 'Patient · Huye · 1 year',
                color: 'from-green-500 to-green-700',
                rating: 4,
                text: 'As a busy professional, this platform saves me so much time. I can book appointments, consult doctors, and manage my health records all from my phone.'
              },
              {
                name: 'Grace Ingabire',
                role: 'Patient · Musanze · 8 months',
                color: 'from-purple-500 to-purple-700',
                rating: 5,
                text: 'The doctors are professional and caring. I feel confident managing my family\'s health with this platform. The video quality is excellent even in rural areas.'
              }
            ].map((t_, index) => (
              <Card key={index} className="border border-border hover:shadow-md transition-shadow bg-card">
                <CardContent className="p-7">
                  <div className="flex items-center gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`h-4 w-4 ${i < t_.rating ? 'fill-yellow-400 text-yellow-400' : 'fill-muted text-muted-foreground/30'}`} />
                    ))}
                    <span className="ml-2 text-xs font-semibold text-muted-foreground">{t_.rating}.0</span>
                  </div>
                  <p className="text-foreground/75 mb-6 italic leading-relaxed text-sm">"{t_.text}"</p>
                  <div className="flex items-center gap-3 pt-4 border-t border-border">
                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${t_.color} flex items-center justify-center text-white text-sm font-bold shrink-0`}>
                      {t_.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">{t_.name}</p>
                      <p className="text-xs text-muted-foreground">{t_.role}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Provider pull quote */}
          <div className="bg-primary/5 border border-primary/15 rounded-2xl p-8 flex flex-col sm:flex-row items-start gap-5">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center text-white font-bold text-base shrink-0">
              GM
            </div>
            <div>
              <p className="text-foreground/75 italic leading-relaxed mb-3 text-sm">
                "SHCP has transformed how I deliver care to rural patients. The platform's reliability and the quality of the video connection means I can confidently manage patient follow-ups remotely, reducing unnecessary hospital visits."
              </p>
              <p className="font-bold text-primary text-sm">Dr. Grace Mugisha</p>
              <p className="text-xs text-muted-foreground">General Practitioner · Kigali Teaching Hospital</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── About ────────────────────────────────────────────────────── */}
      <section id="about" className="bg-primary py-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-6">{t('home.page.about.title')}</h2>
              <p className="text-white/90 text-lg mb-6 leading-relaxed">
                {t('home.page.about.p1')}
              </p>
              <p className="text-white/90 text-lg mb-8 leading-relaxed">
                {t('home.page.about.p2')}
              </p>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { value: '30+', label: 'Districts served across Rwanda' },
                  { value: '3', label: 'Languages: Kinyarwanda, English, French' },
                  { value: '<30s', label: 'Average AI assessment response time' },
                  { value: '24/7', label: t('home.page.about.supportAvailable') },
                ].map((stat) => (
                  <div key={stat.value} className="bg-white/10 backdrop-blur-sm p-5 rounded-xl border border-white/10">
                    <div className="text-white text-3xl font-bold mb-1">{stat.value}</div>
                    <p className="text-white/70 text-sm leading-snug">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <ImageWithFallback
                src="https://images.unsplash.com/photo-1632054890505-dcfb97d25fe0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhZnJpY2FuJTIwaGVhbHRoY2FyZSUyMHByb2Zlc3Npb25hbHxlbnwxfHx8fDE3NjkzMzA2NTN8MA&ixlib=rb-4.1.0&q=80&w=1080"
                alt="Rwandan Healthcare Team"
                className="w-full rounded-2xl shadow-2xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA — dual audience ───────────────────────────────────────── */}
      <section className="bg-background py-20">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-primary mb-4">
            {t('home.page.cta.title')}
          </h2>
          <p className="text-xl text-foreground/70 mb-12">
            {t('home.page.cta.subtitle')}
          </p>

          <div className="grid sm:grid-cols-2 gap-6 mb-8 text-left">
            <div className="border-2 border-primary/20 rounded-2xl p-8 hover:border-primary/50 hover:shadow-lg transition-all">
              <div className="bg-primary/10 w-12 h-12 rounded-xl flex items-center justify-center mb-5">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-primary mb-2">For Patients</h3>
              <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                Book consultations, check symptoms with AI, and manage your health records — all from your phone.
              </p>
              <Button
                onClick={onGetStarted}
                className="w-full bg-primary hover:bg-primary/90 text-white rounded-full"
              >
                {t('home.page.cta.getStartedFree')}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>

            <div className="border-2 border-border rounded-2xl p-8 hover:border-primary/50 hover:shadow-lg transition-all">
              <div className="bg-primary/10 w-12 h-12 rounded-xl flex items-center justify-center mb-5">
                <Heart className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-primary mb-2">For Healthcare Providers</h3>
              <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                Manage your schedule, conduct video consultations, write prescriptions, and grow your practice.
              </p>
              <Button
                onClick={onGetStarted}
                variant="outline"
                className="w-full border-2 border-primary/30 text-primary hover:border-primary hover:bg-primary/5 rounded-full"
              >
                Join as a Provider
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            <Clock className="inline h-4 w-4 mr-1" />
            {t('home.page.cta.note')}
          </p>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="bg-primary text-white py-12">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="mb-4">
                <BrandLogo inverted />
              </div>
              <p className="text-white/70 leading-relaxed text-sm">
                {t('home.page.footer.tagline')}
              </p>
            </div>

            <div>
              <h3 className="font-bold mb-4 text-sm uppercase tracking-wider opacity-60">{t('home.page.footer.quickLinks')}</h3>
              <ul className="space-y-2.5 text-white/80 text-sm">
                <li><a href="#home" className="hover:text-white transition-colors">{t('home.page.nav.home')}</a></li>
                <li><a href="#services" className="hover:text-white transition-colors">{t('home.page.nav.services')}</a></li>
                <li><a href="#how-it-works" className="hover:text-white transition-colors">{t('home.page.nav.howItWorks')}</a></li>
                <li><a href="#about" className="hover:text-white transition-colors">{t('home.page.footer.aboutUs')}</a></li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold mb-4 text-sm uppercase tracking-wider opacity-60">{t('home.page.footer.services')}</h3>
              <ul className="space-y-2.5 text-white/80 text-sm">
                <li><a href="#services" className="hover:text-white transition-colors">{t('home.page.services.aiChecker')}</a></li>
                <li><a href="#services" className="hover:text-white transition-colors">{t('home.page.services.videoConsult')}</a></li>
                <li><a href="#services" className="hover:text-white transition-colors">{t('nav.appointments')}</a></li>
                <li><a href="#services" className="hover:text-white transition-colors">{t('home.page.footer.healthRecords')}</a></li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold mb-4 text-sm uppercase tracking-wider opacity-60">{t('home.page.footer.contact')}</h3>
              <ul className="space-y-2.5 text-white/70 text-sm">
                <li>Ministry of Health Building</li>
                <li>Kigali, Rwanda</li>
                <li>info@shcp.rw</li>
                <li>+250 788 123 456</li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/20 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-white/60 text-sm">
            <p>{t('home.page.footer.copyright')}</p>
            <div className="flex items-center gap-4 flex-wrap justify-center">
              <a href="#" className="hover:text-white transition-colors">{t('home.page.footer.privacyPolicy')}</a>
              <span>·</span>
              <a href="#" className="hover:text-white transition-colors">{t('home.page.footer.termsOfService')}</a>
              <span>·</span>
              <a href="#" className="hover:text-white transition-colors">{t('home.page.footer.dataProtection')}</a>
              <span>·</span>
              <a href="#" className="hover:text-white transition-colors">{t('home.page.footer.contactSupport')}</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
