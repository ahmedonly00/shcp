import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent } from '@/app/components/ui/card';
import { Sheet, SheetContent, SheetTrigger } from '@/app/components/ui/sheet';
import {
  ArrowRight, Phone, Activity, Calendar, Video,
  FileText, Shield, Users, Star, CheckCircle,
  Heart, Smartphone, Clock, Award, Menu, Zap, Globe
} from 'lucide-react';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';

type Page = 'home' | 'services' | 'how-it-works' | 'about';

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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">{children}</p>
  );
}

// ── Home page ────────────────────────────────────────────────────────────────
function PageHome({ onGetStarted, t }: { onGetStarted: () => void; t: (k: string) => string }) {
  const features = [
    { icon: <Activity className="h-4 w-4" />,   label: t('home.page.services.aiChecker'),    desc: t('home.page.services.aiCheckerDesc') },
    { icon: <Video className="h-4 w-4" />,       label: t('home.page.services.videoConsult'),  desc: t('home.page.services.videoConsultDesc') },
    { icon: <Calendar className="h-4 w-4" />,    label: t('home.page.services.appointments'),  desc: t('home.page.services.appointmentsDesc') },
    { icon: <FileText className="h-4 w-4" />,    label: t('home.page.services.healthRecords'), desc: t('home.page.services.healthRecordsDesc') },
    { icon: <Smartphone className="h-4 w-4" />,  label: t('home.page.services.mobileHealth'),  desc: t('home.page.services.mobileHealthDesc') },
    { icon: <Shield className="h-4 w-4" />,      label: t('home.page.services.secure'),        desc: t('home.page.services.secureDesc') },
  ];

  return (
    <>
      {/* Hero */}
      <section className="bg-slate-50 flex-1">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8 lg:py-12">
          <div className="grid lg:grid-cols-2 gap-16 items-center">

            {/* Left */}
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                </span>
                <span className="text-sm font-medium text-foreground">{t('home.page.hero.badge')}</span>
              </div>

              <div>
                <h1 className="mb-5 text-4xl font-bold leading-tight tracking-tight text-primary lg:text-5xl xl:text-6xl" style={{ whiteSpace: 'pre-line' }}>
                  {t('home.page.hero.title')}
                </h1>
                <p className="text-lg leading-relaxed text-muted-foreground">
                  {t('home.page.hero.subtitle')}
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                {features.map((f) => (
                  <div key={f.label} className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      {f.icon}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{f.label}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  onClick={onGetStarted}
                  size="lg"
                  className="bg-primary hover:bg-primary/90 rounded-full px-8 text-white shadow-sm transition-colors"
                >
                  {t('home.page.hero.startConsultation')}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="rounded-full border-border px-8 hover:bg-accent transition-colors"
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

            {/* Right — hero image */}
            <div className="relative">
              <div className="overflow-hidden rounded-2xl shadow-xl ring-1 ring-black/5">
                <ImageWithFallback
                  src="https://images.unsplash.com/photo-1666886573681-a8fbe983a3fd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhZnJpY2FuJTIwd29tYW4lMjB2aWRlbyUyMGNhbGwlMjBkb2N0b3IlMjBwaG9uZXxlbnwxfHx8fDE3NjkzMzA2NTJ8MA&ixlib=rb-4.1.0&q=80&w=1080"
                  alt="Rwandan patient having video consultation with doctor"
                  className="h-[280px] sm:h-[400px] lg:h-[520px] w-full object-cover"
                />
                <div className="absolute bottom-5 left-5 right-5 rounded-xl bg-white/95 p-4 shadow-lg backdrop-blur-sm border border-border/50">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-green-100 p-2">
                      <Video className="h-4 w-4 text-green-600" />
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

              <div className="hidden lg:flex absolute -top-3 -right-3 items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-white shadow-md">
                <Award className="h-4 w-4 shrink-0" />
                <p className="text-xs font-semibold leading-snug">Clinically Verified</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Strip */}
      <section className="bg-white border-t border-border py-8">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-6">
            Endorsed &amp; Compliant With
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 md:gap-16">
            {[
              { icon: <Award className="h-4 w-4" />,       label: 'Ministry of Health, Rwanda' },
              { icon: <Shield className="h-4 w-4" />,      label: 'Rwanda Biomedical Centre' },
              { icon: <CheckCircle className="h-4 w-4" />, label: 'RURA Certified' },
            ].map(({ icon, label }) => (
              <div key={label} className="flex items-center gap-2 text-muted-foreground">
                <span className="text-primary">{icon}</span>
                <span className="text-sm font-semibold">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

// ── Services page ────────────────────────────────────────────────────────────
function PageServices({ t }: { t: (k: string) => string }) {
  const supporting = [
    { icon: <Video className="h-5 w-5" />,      title: t('home.page.services.videoConsult'),  desc: t('home.page.services.videoConsultDesc') },
    { icon: <Calendar className="h-5 w-5" />,   title: t('home.page.services.appointments'),  desc: t('home.page.services.appointmentsDesc') },
    { icon: <FileText className="h-5 w-5" />,   title: t('home.page.services.healthRecords'), desc: t('home.page.services.healthRecordsDesc') },
    { icon: <Smartphone className="h-5 w-5" />, title: t('home.page.services.mobileHealth'),  desc: t('home.page.services.mobileHealthDesc') },
    { icon: <Shield className="h-5 w-5" />,     title: t('home.page.services.secure'),        desc: t('home.page.services.secureDesc') },
  ];

  return (
    <div className="flex-1 bg-slate-50">
      {/* Page header */}
      <div className="bg-primary py-16">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <SectionLabel>What We Offer</SectionLabel>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">{t('home.page.services.title')}</h2>
          <p className="text-lg text-white/75 leading-relaxed">{t('home.page.services.subtitle')}</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16">
        {/* Featured: AI Symptom Checker */}
        <Card className="mb-8 border-border shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="grid lg:grid-cols-5">
              <div className="lg:col-span-3 p-10">
                <p className="text-xs font-bold uppercase tracking-widest text-primary mb-4">Core Technology</p>
                <div className="bg-primary/10 text-primary w-12 h-12 rounded-xl flex items-center justify-center mb-5">
                  <Activity className="h-6 w-6" />
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-3">{t('home.page.services.aiChecker')}</h3>
                <p className="text-muted-foreground leading-relaxed mb-7">{t('home.page.services.aiCheckerDesc')}</p>
                <ul className="space-y-2.5">
                  {[
                    'Supports Kinyarwanda, English & French',
                    'AI-powered differential diagnosis',
                    'Instant triage recommendation in under 30 seconds',
                  ].map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                      <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="lg:col-span-2 bg-slate-50 border-t lg:border-t-0 lg:border-l border-border flex items-center justify-center p-10 min-h-[200px]">
                <div className="text-center space-y-4">
                  <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                    <Activity className="h-9 w-9 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">AI Symptom Analysis</p>
                    <p className="text-xs text-muted-foreground mt-1">Results in under 30 seconds</p>
                  </div>
                  <div className="flex justify-center gap-3">
                    <div className="rounded-lg border border-border bg-white px-4 py-2.5 text-center shadow-sm">
                      <div className="text-lg font-bold text-primary">98%</div>
                      <div className="text-xs text-muted-foreground">Accuracy</div>
                    </div>
                    <div className="rounded-lg border border-border bg-white px-4 py-2.5 text-center shadow-sm">
                      <div className="text-lg font-bold text-primary">3</div>
                      <div className="text-xs text-muted-foreground">Languages</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Supporting services */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {supporting.map((s, i) => (
            <Card key={i} className="border-border bg-white shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-7">
                <div className="bg-primary/10 text-primary w-10 h-10 rounded-xl flex items-center justify-center mb-5">
                  {s.icon}
                </div>
                <h3 className="text-base font-semibold text-foreground mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </CardContent>
            </Card>
          ))}

          {/* Platform stats */}
          <Card className="border-border bg-primary shadow-sm">
            <CardContent className="p-7 flex flex-col h-full justify-between">
              <div>
                <Globe className="h-8 w-8 text-white/80 mb-4" />
                <h3 className="text-base font-semibold text-white mb-1">Platform at a Glance</h3>
                <p className="text-xs text-white/60 mb-6">Our reach across Rwanda</p>
              </div>
              <div className="space-y-3">
                {[
                  { value: '50K+', label: 'Active Patients' },
                  { value: '500+', label: 'Verified Doctors' },
                  { value: '30+',  label: 'Districts Covered' },
                ].map(stat => (
                  <div key={stat.value} className="flex items-center justify-between border-b border-white/10 pb-3 last:border-0 last:pb-0">
                    <span className="text-sm text-white/70">{stat.label}</span>
                    <span className="text-sm font-bold text-white">{stat.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ── How It Works page ────────────────────────────────────────────────────────
function PageHowItWorks({ onGetStarted, t }: { onGetStarted: () => void; t: (k: string) => string }) {
  const steps = [
    { step: '01', title: t('home.page.howItWorks.step1Title'), desc: t('home.page.howItWorks.step1Desc'), icon: <Users className="h-5 w-5" /> },
    { step: '02', title: t('home.page.howItWorks.step2Title'), desc: t('home.page.howItWorks.step2Desc'), icon: <CheckCircle className="h-5 w-5" /> },
    { step: '03', title: t('home.page.howItWorks.step3Title'), desc: t('home.page.howItWorks.step3Desc'), icon: <Heart className="h-5 w-5" /> },
  ];

  return (
    <div className="flex-1 bg-background">
      {/* Page header */}
      <div className="border-b border-border bg-white py-16 text-center">
        <div className="max-w-3xl mx-auto px-6">
          <SectionLabel>Simple Process</SectionLabel>
          <h2 className="text-3xl sm:text-4xl font-bold text-primary mb-4">{t('home.page.howItWorks.title')}</h2>
          <p className="text-lg text-muted-foreground leading-relaxed">{t('home.page.howItWorks.subtitle')}</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16">
        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {steps.map((item, i) => (
            <div key={i} className="relative">
              {i < 2 && (
                <div className="hidden md:block absolute top-6 left-[calc(50%+2.5rem)] right-0 h-px border-t border-dashed border-border z-0" />
              )}
              <Card className="relative border-border bg-white shadow-sm hover:shadow-md transition-shadow h-full">
                <CardContent className="p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <span className="text-5xl font-black text-primary/15 leading-none select-none">{item.step}</span>
                    <div className="bg-primary/10 text-primary w-10 h-10 rounded-xl flex items-center justify-center shrink-0">
                      {item.icon}
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold text-primary mb-3">{item.title}</h3>
                  <p className="text-muted-foreground leading-relaxed text-sm">{item.desc}</p>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>

        {/* CTA section */}
        <div className="rounded-2xl bg-primary overflow-hidden">
          <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-white/10">
            <div className="p-10">
              <div className="bg-white/15 w-11 h-11 rounded-xl flex items-center justify-center mb-5">
                <Users className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">For Patients</h3>
              <p className="text-white/70 text-sm leading-relaxed mb-7">
                Book consultations, check symptoms with AI, and manage your health records — all from your phone.
              </p>
              <Button
                onClick={onGetStarted}
                className="bg-white hover:bg-white/90 text-primary rounded-full font-semibold transition-colors"
                size="lg"
              >
                {t('home.page.cta.getStartedFree')}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
            <div className="p-10">
              <div className="bg-white/15 w-11 h-11 rounded-xl flex items-center justify-center mb-5">
                <Heart className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">For Healthcare Providers</h3>
              <p className="text-white/70 text-sm leading-relaxed mb-7">
                Manage your schedule, conduct video consultations, write prescriptions, and grow your practice.
              </p>
              <Button
                onClick={onGetStarted}
                className="bg-transparent border-2 border-white text-white hover:bg-white/15 rounded-full font-semibold transition-colors"
                size="lg"
              >
                Join as a Provider
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="text-center mt-8">
          <p className="text-sm text-muted-foreground flex items-center justify-center gap-1.5">
            <Clock className="h-4 w-4" />
            {t('home.page.cta.note')}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── About page ───────────────────────────────────────────────────────────────
function PageAbout({ t }: { t: (k: string) => string }) {
  return (
    <>
      {/* Mission */}
      <section className="bg-primary py-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-14 items-center">
            <div>
              <SectionLabel>Our Mission</SectionLabel>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">{t('home.page.about.title')}</h2>
              <div className="border-l-4 border-white/30 pl-5 mb-6">
                <p className="text-white/90 text-lg leading-relaxed">{t('home.page.about.p1')}</p>
              </div>
              <p className="text-white/75 text-base mb-10 leading-relaxed">{t('home.page.about.p2')}</p>

              <div className="grid grid-cols-2 gap-4">
                {[
                  { value: '30+',  label: 'Districts served across Rwanda',         icon: <Globe className="h-4 w-4" /> },
                  { value: '3',    label: 'Languages: Kinyarwanda, English, French', icon: <Users className="h-4 w-4" /> },
                  { value: '<30s', label: 'Average AI assessment response time',    icon: <Zap className="h-4 w-4" /> },
                  { value: '24/7', label: t('home.page.about.supportAvailable'),   icon: <Clock className="h-4 w-4" /> },
                ].map((stat) => (
                  <div key={stat.value} className="bg-white/10 border border-white/10 rounded-xl p-5">
                    <div className="text-white/50 mb-2">{stat.icon}</div>
                    <div className="text-white text-3xl font-bold mb-1">{stat.value}</div>
                    <p className="text-white/60 text-xs leading-snug">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl shadow-xl">
              <ImageWithFallback
                src="https://images.unsplash.com/photo-1632054890505-dcfb97d25fe0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhZnJpY2FuJTIwaGVhbHRoY2FyZSUyMHByb2Zlc3Npb25hbHxlbnwxfHx8fDE3NjkzMzA2NTN8MA&ixlib=rb-4.1.0&q=80&w=1080"
                alt="Rwandan Healthcare Team"
                className="w-full"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-14">
            <SectionLabel>Testimonials</SectionLabel>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-3">What Our Users Say</h2>
            <p className="text-lg text-muted-foreground">Trusted by thousands of Rwandans</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-6">
            {[
              { name: 'Marie Uwase',        role: 'Patient · Kigali · 2 years',  initials: 'MU', color: 'bg-blue-600',   rating: 5, text: 'I can now consult with doctors from my village without traveling to Kigali. The AI symptom checker helped me understand my condition before the consultation. Amazing service!' },
              { name: 'Jean Baptiste Nkusi', role: 'Patient · Huye · 1 year',    initials: 'JN', color: 'bg-green-600',  rating: 4, text: 'As a busy professional, this platform saves me so much time. I can book appointments, consult doctors, and manage my health records all from my phone.' },
              { name: 'Grace Ingabire',      role: 'Patient · Musanze · 8 months', initials: 'GI', color: 'bg-purple-600', rating: 5, text: "The doctors are professional and caring. I feel confident managing my family's health with this platform. The video quality is excellent even in rural areas." },
            ].map((testimonial, index) => (
              <Card key={index} className="border-border bg-white shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-7 flex flex-col h-full">
                  <div className="flex items-center gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`h-4 w-4 ${i < testimonial.rating ? 'fill-yellow-400 text-yellow-400' : 'fill-muted text-border'}`} />
                    ))}
                  </div>
                  <p className="text-muted-foreground leading-relaxed text-sm flex-1 mb-6">"{testimonial.text}"</p>
                  <div className="flex items-center gap-3 pt-4 border-t border-border">
                    <div className={`w-9 h-9 rounded-full ${testimonial.color} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                      {testimonial.initials}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{testimonial.name}</p>
                      <p className="text-xs text-muted-foreground">{testimonial.role}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Provider quote */}
          <div className="border border-border rounded-2xl bg-slate-50 p-8 flex flex-col sm:flex-row items-start gap-5">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm shrink-0">
              GM
            </div>
            <div>
              <p className="text-foreground/80 leading-relaxed mb-4 text-sm">
                "SHCP has transformed how I deliver care to rural patients. The platform's reliability and the quality of the video connection means I can confidently manage patient follow-ups remotely, reducing unnecessary hospital visits."
              </p>
              <p className="font-semibold text-foreground text-sm">Dr. Grace Mugisha</p>
              <p className="text-xs text-muted-foreground">General Practitioner · Kigali Teaching Hospital</p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

// ── Root component ───────────────────────────────────────────────────────────
export const HomePage: React.FC<HomePageProps> = ({ onGetStarted }) => {
  const { t } = useTranslation();
  const [activePage, setActivePage] = useState<Page>('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: { id: Page; label: string }[] = [
    { id: 'home',         label: t('home.page.nav.home') },
    { id: 'services',     label: t('home.page.nav.services') },
    { id: 'how-it-works', label: t('home.page.nav.howItWorks') },
    { id: 'about',        label: t('home.page.nav.about') },
  ];

  const navigate = (page: Page) => {
    setActivePage(page);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* ── Navigation ───────────────────────────────────────────────── */}
      <header className="py-4 px-4 sm:px-6 lg:px-8 sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <button onClick={() => navigate('home')} className="focus:outline-none">
            <BrandLogo />
          </button>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  activePage === item.id
                    ? 'bg-primary text-white'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Button
              onClick={onGetStarted}
              className="bg-primary hover:bg-primary/90 text-white rounded-full px-5 sm:px-6 text-sm transition-colors"
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
                  {navItems.map(item => (
                    <button
                      key={item.id}
                      onClick={() => navigate(item.id)}
                      className={`text-left font-medium transition-colors text-base px-4 py-3 rounded-lg ${
                        activePage === item.id
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                  <div className="mt-4 px-4">
                    <Button
                      onClick={() => { onGetStarted(); setMobileMenuOpen(false); }}
                      className="w-full bg-primary hover:bg-primary/90 text-white rounded-full transition-colors"
                    >
                      {t('home.page.nav.getStarted')}
                    </Button>
                  </div>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* ── Page content ─────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col">
        {activePage === 'home'         && <PageHome         onGetStarted={onGetStarted} t={t} />}
        {activePage === 'services'     && <PageServices     t={t} />}
        {activePage === 'how-it-works' && <PageHowItWorks   onGetStarted={onGetStarted} t={t} />}
        {activePage === 'about'        && <PageAbout        t={t} />}
      </main>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="bg-primary text-white py-14">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-10 mb-10">
            <div>
              <div className="mb-4">
                <BrandLogo inverted />
              </div>
              <p className="text-white/65 leading-relaxed text-sm">{t('home.page.footer.tagline')}</p>
            </div>

            <div>
              <h3 className="font-semibold mb-4 text-xs uppercase tracking-widest text-white/40">{t('home.page.footer.quickLinks')}</h3>
              <ul className="space-y-2.5 text-white/70 text-sm">
                {navItems.map(item => (
                  <li key={item.id}>
                    <button onClick={() => navigate(item.id)} className="hover:text-white transition-colors text-left">
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4 text-xs uppercase tracking-widest text-white/40">{t('home.page.footer.services')}</h3>
              <ul className="space-y-2.5 text-white/70 text-sm">
                <li><button onClick={() => navigate('services')} className="hover:text-white transition-colors text-left">{t('home.page.services.aiChecker')}</button></li>
                <li><button onClick={() => navigate('services')} className="hover:text-white transition-colors text-left">{t('home.page.services.videoConsult')}</button></li>
                <li><button onClick={() => navigate('services')} className="hover:text-white transition-colors text-left">{t('home.page.services.appointments')}</button></li>
                <li><button onClick={() => navigate('services')} className="hover:text-white transition-colors text-left">{t('home.page.services.healthRecords')}</button></li>
                <li><button onClick={() => navigate('services')} className="hover:text-white transition-colors text-left">{t('home.page.services.mobileHealth')}</button></li>
                <li><button onClick={() => navigate('services')} className="hover:text-white transition-colors text-left">{t('home.page.services.secure')}</button></li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4 text-xs uppercase tracking-widest text-white/40">{t('home.page.footer.contact')}</h3>
              <ul className="space-y-2.5 text-white/65 text-sm">
                <li>Ministry of Health Building</li>
                <li>Kigali, Rwanda</li>
                <li>info@shcp.rw</li>
                <li>+250 788 123 456</li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/15 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-white/45 text-sm">
            <p>{t('home.page.footer.copyright')}</p>
            <div className="flex items-center gap-4 flex-wrap justify-center">
              <a href="#" className="hover:text-white/80 transition-colors">{t('home.page.footer.privacyPolicy')}</a>
              <span>·</span>
              <a href="#" className="hover:text-white/80 transition-colors">{t('home.page.footer.termsOfService')}</a>
              <span>·</span>
              <a href="#" className="hover:text-white/80 transition-colors">{t('home.page.footer.dataProtection')}</a>
              <span>·</span>
              <a href="#" className="hover:text-white/80 transition-colors">{t('home.page.footer.contactSupport')}</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
