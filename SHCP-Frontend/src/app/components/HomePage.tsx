import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent } from '@/app/components/ui/card';
import {
  ArrowRight, Plus, Phone, Activity, Calendar, Video,
  FileText, Shield, Users, Star, CheckCircle,
  Heart, Smartphone, Clock, Map, Award
} from 'lucide-react';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';

interface HomePageProps {
  onGetStarted: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onGetStarted }) => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-background">
      {/* Header/Navigation */}
      <header className="py-4 px-6 lg:px-8 sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary text-white p-2 rounded-lg">
              <Plus className="h-6 w-6" />
            </div>
            <div>
              <span className="text-primary text-lg font-bold block leading-tight">Smart Health</span>
              <span className="text-primary text-xs font-medium opacity-80">Consultation Platform</span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8">
            <a href="#home" className="text-foreground/80 hover:text-primary font-medium transition-colors">{t('home.page.nav.home')}</a>
            <a href="#services" className="text-foreground/80 hover:text-primary font-medium transition-colors">{t('home.page.nav.services')}</a>
            <a href="#how-it-works" className="text-foreground/80 hover:text-primary font-medium transition-colors">{t('home.page.nav.howItWorks')}</a>
            <a href="#about" className="text-foreground/80 hover:text-primary font-medium transition-colors">{t('home.page.nav.about')}</a>
          </nav>

          <div className="flex items-center gap-3">
            <Button
              onClick={onGetStarted}
              className="bg-primary hover:bg-primary/90 text-white rounded-full px-6"
            >
              {t('home.page.nav.getStarted')}
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section id="home" className="relative overflow-hidden bg-slate-50">
        {/* Decorative background — large soft blur orbs, not gradients */}
        <div className="pointer-events-none absolute -top-32 -right-32 h-[600px] w-[600px] rounded-full bg-primary/5 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-72 w-72 rounded-full bg-secondary blur-2xl" />

        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16 lg:py-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Column */}
            <div className="space-y-8">
              {/* Live badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-card px-4 py-2 shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                </span>
                <span className="text-sm font-medium text-primary">{t('home.page.hero.badge')}</span>
              </div>

              <div>
                <h1 className="mb-6 text-4xl font-bold leading-tight tracking-tight text-primary lg:text-5xl xl:text-6xl" style={{ whiteSpace: 'pre-line' }}>
                  {t('home.page.hero.title')}
                </h1>
                <p className="mb-8 text-lg leading-relaxed text-foreground/70 lg:text-xl">
                  {t('home.page.hero.subtitle')}
                </p>
              </div>

              {/* Feature list — clean icon + text, no box per feature */}
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

              {/* CTA Buttons */}
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

              {/* Trust metrics — structured divider layout */}
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

            {/* Right Column — image */}
            <div className="relative">
              <div className="relative overflow-hidden rounded-3xl shadow-2xl ring-1 ring-black/5">
                <ImageWithFallback
                  src="https://images.unsplash.com/photo-1666886573681-a8fbe983a3fd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhZnJpY2FuJTIwd29tYW4lMjB2aWRlbyUyMGNhbGwlMjBkb2N0b3IlMjBwaG9uZXxlbnwxfHx8fDE3NjkzMzA2NTJ8MA&ixlib=rb-4.1.0&q=80&w=1080"
                  alt="Rwandan patient having video consultation with doctor"
                  className="h-[500px] w-full object-cover lg:h-[580px]"
                />

                {/* Live consultation card */}
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

              {/* Ministry approved badge */}
              <div className="hidden lg:flex absolute -top-3 -right-3 items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-white shadow-xl">
                <Award className="h-5 w-5 shrink-0" />
                <p className="text-xs font-semibold leading-snug" style={{ whiteSpace: 'pre-line' }}>{t('home.page.footer.ministryApproved')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Wave to white services section */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 80" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
            <path d="M0 40C240 80 480 0 720 40C960 80 1200 0 1440 40V80H0V40Z" fill="white" />
          </svg>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="bg-background py-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-primary mb-4">{t('home.page.services.title')}</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              {t('home.page.services.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: <Activity className="h-8 w-8" />,
                title: t('home.page.services.aiChecker'),
                description: t('home.page.services.aiCheckerDesc'),
              },
              {
                icon: <Video className="h-8 w-8" />,
                title: t('home.page.services.videoConsult'),
                description: t('home.page.services.videoConsultDesc'),
              },
              {
                icon: <Calendar className="h-8 w-8" />,
                title: t('home.page.services.appointments'),
                description: t('home.page.services.appointmentsDesc'),
              },
              {
                icon: <FileText className="h-8 w-8" />,
                title: t('home.page.services.healthRecords'),
                description: t('home.page.services.healthRecordsDesc'),
              },
              {
                icon: <Smartphone className="h-8 w-8" />,
                title: t('home.page.services.mobileHealth'),
                description: t('home.page.services.mobileHealthDesc'),
              },
              {
                icon: <Shield className="h-8 w-8" />,
                title: t('home.page.services.secure'),
                description: t('home.page.services.secureDesc'),
              }
            ].map((service, index) => (
              <Card key={index} className="border-none shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 bg-card">
                <CardContent className="p-8">
                  <div className="bg-secondary w-16 h-16 rounded-2xl flex items-center justify-center mb-6 text-primary">
                    {service.icon}
                  </div>
                  <h3 className="text-xl font-bold text-primary mb-3">{service.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{service.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="bg-gradient-to-br from-secondary to-background py-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-primary mb-4">{t('home.page.howItWorks.title')}</h2>
            <p className="text-xl text-foreground/80 max-w-2xl mx-auto">
              {t('home.page.howItWorks.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connection Lines */}
            <div className="hidden md:block absolute top-24 left-0 right-0 h-px bg-primary/20" style={{ width: 'calc(100% - 200px)', left: '100px' }} />

            {[
              {
                step: '1',
                title: t('home.page.howItWorks.step1Title'),
                description: t('home.page.howItWorks.step1Desc'),
                icon: <Users className="h-10 w-10" />
              },
              {
                step: '2',
                title: t('home.page.howItWorks.step2Title'),
                description: t('home.page.howItWorks.step2Desc'),
                icon: <CheckCircle className="h-10 w-10" />
              },
              {
                step: '3',
                title: t('home.page.howItWorks.step3Title'),
                description: t('home.page.howItWorks.step3Desc'),
                icon: <Heart className="h-10 w-10" />
              }
            ].map((step, index) => (
              <div key={index} className="relative">
                <Card className="bg-card border-none shadow-xl h-full hover:shadow-2xl transition-all">
                  <CardContent className="p-8 text-center relative">
                    {/* Step Number Badge */}
                    <div className="absolute -top-6 left-1/2 transform -translate-x-1/2">
                      <div className="bg-primary text-white w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl shadow-lg">
                        {step.step}
                      </div>
                    </div>

                    <div className="mt-8 bg-secondary w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-primary">
                      {step.icon}
                    </div>
                    <h3 className="text-2xl font-bold text-primary mb-4">{step.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{step.description}</p>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Button
              onClick={onGetStarted}
              size="lg"
              className="bg-primary hover:bg-primary/90 text-white rounded-full px-10 py-6 text-lg shadow-lg"
            >
              {t('home.page.howItWorks.startFree')}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="bg-background py-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-primary mb-4">{t('home.page.testimonials.title')}</h2>
            <p className="text-xl text-muted-foreground">{t('home.page.testimonials.subtitle')}</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                name: 'Marie Uwase',
                location: 'Kigali',
                color: 'from-blue-500 to-blue-700',
                rating: 5,
                text: 'I can now consult with doctors from my village without traveling to Kigali. The AI symptom checker helped me understand my condition before the consultation. Amazing service!'
              },
              {
                name: 'Jean Baptiste Nkusi',
                location: 'Huye',
                color: 'from-green-500 to-green-700',
                rating: 5,
                text: 'As a busy professional, this platform saves me so much time. I can book appointments, consult doctors, and manage my health records all from my phone.'
              },
              {
                name: 'Grace Ingabire',
                location: 'Musanze',
                color: 'from-purple-500 to-purple-700',
                rating: 5,
                text: 'The doctors are professional and caring. I feel confident managing my family\'s health with this platform. The video quality is excellent even in rural areas.'
              }
            ].map((testimonial, index) => (
              <Card key={index} className="border-none shadow-lg hover:shadow-xl transition-shadow bg-card">
                <CardContent className="p-8">
                  <div className="flex items-center gap-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-foreground/80 mb-6 italic leading-relaxed">"{testimonial.text}"</p>
                  <div className="flex items-center gap-4 pt-4 border-t border-border">
                    <div className={`w-14 h-14 rounded-full bg-gradient-to-br ${testimonial.color} flex items-center justify-center text-white text-lg font-bold shrink-0`}>
                      {testimonial.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-primary font-bold">{testimonial.name}</p>
                      <div className="flex items-center gap-1 text-muted-foreground text-sm">
                        <Map className="h-3 w-3" />
                        <span>{testimonial.location}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="bg-primary py-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl font-bold text-white mb-6">{t('home.page.about.title')}</h2>
              <p className="text-white/90 text-lg mb-6 leading-relaxed">
                {t('home.page.about.p1')}
              </p>
              <p className="text-white/90 text-lg mb-8 leading-relaxed">
                {t('home.page.about.p2')}
              </p>
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-white/10 backdrop-blur p-6 rounded-xl">
                  <div className="text-white text-4xl font-bold mb-2">50K+</div>
                  <p className="text-white/80">{t('home.page.about.activePatients')}</p>
                </div>
                <div className="bg-white/10 backdrop-blur p-6 rounded-xl">
                  <div className="text-white text-4xl font-bold mb-2">500+</div>
                  <p className="text-white/80">{t('home.page.about.certifiedDoctors')}</p>
                </div>
                <div className="bg-white/10 backdrop-blur p-6 rounded-xl">
                  <div className="text-white text-4xl font-bold mb-2">98%</div>
                  <p className="text-white/80">{t('home.page.about.patientSatisfaction')}</p>
                </div>
                <div className="bg-white/10 backdrop-blur p-6 rounded-xl">
                  <div className="text-white text-4xl font-bold mb-2">24/7</div>
                  <p className="text-white/80">{t('home.page.about.supportAvailable')}</p>
                </div>
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

      {/* CTA Section */}
      <section className="bg-gradient-to-br from-secondary to-background py-20">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-4xl lg:text-5xl font-bold text-primary mb-6">
            {t('home.page.cta.title')}
          </h2>
          <p className="text-xl text-foreground/80 mb-8">
            {t('home.page.cta.subtitle')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={onGetStarted}
              size="lg"
              className="bg-primary hover:bg-primary/90 text-white rounded-full px-10 py-6 text-lg shadow-lg"
            >
              {t('home.page.cta.getStartedFree')}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground rounded-full px-10 py-6 text-lg"
            >
              <Phone className="mr-2 h-5 w-5" />
              {t('home.page.cta.talkToSupport')}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-6">
            <Clock className="inline h-4 w-4 mr-1" />
            {t('home.page.cta.note')}
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-primary text-white py-12">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="bg-white text-primary p-2 rounded-lg">
                  <Plus className="h-6 w-6" />
                </div>
                <div>
                  <span className="text-lg font-bold block leading-tight">Smart Health</span>
                  <span className="text-xs opacity-80">Consultation Platform</span>
                </div>
              </div>
              <p className="text-white/80 leading-relaxed text-sm">
                {t('home.page.footer.tagline')}
              </p>
            </div>

            <div>
              <h3 className="font-bold mb-4 text-lg">{t('home.page.footer.quickLinks')}</h3>
              <ul className="space-y-2 text-white/80 text-sm">
                <li><a href="#home" className="hover:text-white transition-colors">{t('home.page.nav.home')}</a></li>
                <li><a href="#services" className="hover:text-white transition-colors">{t('home.page.nav.services')}</a></li>
                <li><a href="#how-it-works" className="hover:text-white transition-colors">{t('home.page.nav.howItWorks')}</a></li>
                <li><a href="#about" className="hover:text-white transition-colors">{t('home.page.footer.aboutUs')}</a></li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold mb-4 text-lg">{t('home.page.footer.services')}</h3>
              <ul className="space-y-2 text-white/80 text-sm">
                <li><a href="#" className="hover:text-white transition-colors">{t('home.page.services.aiChecker')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('home.page.services.videoConsult')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('nav.appointments')}</a></li>
                <li><a href="#" className="hover:text-white transition-colors">{t('home.page.footer.healthRecords')}</a></li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold mb-4 text-lg">{t('home.page.footer.contact')}</h3>
              <ul className="space-y-2 text-white/80 text-sm">
                <li>Ministry of Health Building</li>
                <li>Kigali, Rwanda</li>
                <li>info@shcp.rw</li>
                <li>+250 788 123 456</li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/20 pt-8 text-center text-white/70 text-sm">
            <p className="mb-4">{t('home.page.footer.copyright')}</p>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <a href="#" className="hover:text-white transition-colors">{t('home.page.footer.privacyPolicy')}</a>
              <span>•</span>
              <a href="#" className="hover:text-white transition-colors">{t('home.page.footer.termsOfService')}</a>
              <span>•</span>
              <a href="#" className="hover:text-white transition-colors">{t('home.page.footer.dataProtection')}</a>
              <span>•</span>
              <a href="#" className="hover:text-white transition-colors">{t('home.page.footer.contactSupport')}</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
