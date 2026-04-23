import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import { Badge } from '@/app/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/app/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import {
  HelpCircle, MessageCircle, Phone, Mail, Video,
  FileText, Search, Send, Clock, CheckCircle,
  Book, AlertCircle, LifeBuoy, ExternalLink, ChevronRight, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/app/context/AuthContext';
import { supportApi, SubmitTicketRequest } from '@/app/api/support';
import { apiClient } from '@/app/api/client';

type Priority = 'LOW' | 'MEDIUM' | 'URGENT';
type ServiceStatus = 'operational' | 'degraded' | 'unknown';

export const HelpSupport: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Contact form state
  const [form, setForm] = useState({
    name:    user?.name    || '',
    email:   user?.email   || '',
    subject: '',
    message: '',
    priority: 'LOW' as Priority,
  });
  const [submitting, setSubmitting] = useState(false);

  // System status state
  const [systemStatus, setSystemStatus] = useState<ServiceStatus>('unknown');

  // Pre-fill name/email when auth user loads
  useEffect(() => {
    if (user) {
      setForm(prev => ({
        ...prev,
        name:  prev.name  || user.name  || '',
        email: prev.email || user.email || '',
      }));
    }
  }, [user?.name, user?.email]);

  // Check system health via actuator
  useEffect(() => {
    apiClient.get('/actuator/health', { baseURL: 'http://localhost:8080' })
      .then((res: { data: unknown }) => {
        const data = res.data as { status?: string };
        setSystemStatus(data?.status === 'UP' ? 'operational' : 'degraded');
      })
      .catch(() => setSystemStatus('unknown'));
  }, []);

  const handleFormChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!form.subject.trim() || !form.message.trim()) {
      toast.error('Please fill in the subject and message fields');
      return;
    }
    setSubmitting(true);
    try {
      const payload: SubmitTicketRequest = {
        name:     form.name  || user?.name  || 'Anonymous',
        email:    form.email || user?.email || '',
        subject:  form.subject,
        message:  form.message,
        priority: form.priority,
      };
      const ticket = await supportApi.submitTicket(payload);
      toast.success(`Ticket #${ticket?.ticketId?.slice(0, 8).toUpperCase()} submitted — we'll reply within 24 hours`);
      setForm(prev => ({ ...prev, subject: '', message: '', priority: 'LOW' }));
    } catch {
      toast.error('Failed to submit ticket. Please try again or email support@shcp.rw');
    } finally {
      setSubmitting(false);
    }
  };

  const faqs = [
    {
      category: 'Getting Started',
      questions: [
        {
          q: 'How do I book my first appointment?',
          a: 'Navigate to the Appointments section from the sidebar, search for a doctor by specialization or name, select an available time slot, provide the reason for your visit, and confirm your booking. You will receive a confirmation email with appointment details.'
        },
        {
          q: 'How does the AI Symptom Checker work?',
          a: 'The AI Symptom Checker analyzes your symptoms using machine learning algorithms. Select your symptoms, indicate their severity and duration, and the AI will provide possible conditions and recommendations. Note: This is not a diagnosis and you should consult a doctor for proper medical advice.'
        },
        {
          q: 'Can I reschedule or cancel an appointment?',
          a: 'Yes, go to your Appointments page, find the scheduled appointment, and click on "Reschedule" or "Cancel". Please try to cancel at least 24 hours in advance to avoid cancellation fees.'
        }
      ]
    },
    {
      category: 'Video Consultations',
      questions: [
        {
          q: 'What do I need for a video consultation?',
          a: 'You need a device with a camera and microphone (computer, tablet, or smartphone), stable internet connection, and a quiet, private space. Test your audio and video before the consultation starts.'
        },
        {
          q: 'What if I have technical issues during a consultation?',
          a: 'If you experience technical difficulties, try refreshing your browser or rejoining the consultation. You can also use the chat feature to communicate with the doctor. For persistent issues, contact our technical support team.'
        },
        {
          q: 'Is my video consultation private and secure?',
          a: 'Yes, all video consultations are end-to-end encrypted and comply with healthcare privacy regulations. Only you and your doctor can access the consultation.'
        }
      ]
    },
    {
      category: 'Health Records',
      questions: [
        {
          q: 'How do I access my health records?',
          a: 'Go to the Health Records section to view all your medical documents, prescriptions, lab results, and vaccination records. You can filter by type and search for specific records.'
        },
        {
          q: 'Can I share my health records with other doctors?',
          a: 'Yes, you can share specific records by clicking the "Share" button on any record. You control who has access to your health information and can revoke access at any time.'
        },
        {
          q: 'How do I upload documents to my health records?',
          a: 'In the Health Records section, click "Upload Record", select the document type, choose the file, and add any relevant notes. Supported formats include PDF, JPG, and PNG.'
        }
      ]
    },
    {
      category: 'Billing & Insurance',
      questions: [
        {
          q: 'What payment methods are accepted?',
          a: 'We accept credit/debit cards, mobile money (MTN Mobile Money, Airtel Money), and insurance payments. Payment is processed securely through our encrypted payment gateway.'
        },
        {
          q: 'How do I submit insurance claims?',
          a: 'After your consultation, you will receive a detailed invoice. Upload this to your insurance portal or submit it directly through our platform if your insurance provider is integrated with SHCP.'
        },
        {
          q: 'Can I get a refund if I cancel my appointment?',
          a: 'Refund policies vary by provider. Generally, cancellations made 24+ hours in advance are eligible for full refunds. Contact support for specific cases.'
        }
      ]
    },
    {
      category: 'Account & Security',
      questions: [
        {
          q: 'How do I enable two-factor authentication?',
          a: 'Go to Profile > Security Settings and toggle on "Two-Factor Authentication". You can choose to receive codes via SMS or use an authenticator app.'
        },
        {
          q: 'What if I forget my password?',
          a: 'Click "Forgot Password" on the login page, enter your email address, and follow the instructions sent to your email to reset your password.'
        },
        {
          q: 'Is my personal information secure?',
          a: 'Yes, we use industry-standard encryption and comply with healthcare data protection regulations. Your data is stored securely and never shared without your explicit consent.'
        }
      ]
    }
  ];

  const supportChannels = [
    {
      icon: <Phone className="h-6 w-6" />,
      title: 'Phone Support',
      description: '24/7 emergency hotline',
      contact: '+250 788 123 456',
      availability: 'Available now',
      color: 'bg-blue-100 text-blue-600'
    },
    {
      icon: <MessageCircle className="h-6 w-6" />,
      title: 'Live Chat',
      description: 'Chat with our support team',
      contact: 'Start Chat',
      availability: 'Response time: ~2 min',
      color: 'bg-green-100 text-green-600'
    },
    {
      icon: <Mail className="h-6 w-6" />,
      title: 'Email Support',
      description: 'Send us a detailed message',
      contact: 'support@shcp.rw',
      availability: 'Response time: ~24 hours',
      color: 'bg-purple-100 text-purple-600'
    },
    {
      icon: <Video className="h-6 w-6" />,
      title: 'Video Call',
      description: 'Screen-sharing support',
      contact: 'Schedule Call',
      availability: 'Mon-Fri, 8AM-6PM',
      color: 'bg-orange-100 text-orange-600'
    }
  ];

  const quickGuides = [
    { title: 'Getting Started Guide', icon: <Book className="h-5 w-5" />, time: '5 min read' },
    { title: 'Booking Your First Appointment', icon: <FileText className="h-5 w-5" />, time: '3 min read' },
    { title: 'Using the Symptom Checker', icon: <AlertCircle className="h-5 w-5" />, time: '4 min read' },
    { title: 'Managing Your Health Records', icon: <FileText className="h-5 w-5" />, time: '6 min read' },
    { title: 'Video Consultation Best Practices', icon: <Video className="h-5 w-5" />, time: '5 min read' },
    { title: 'Privacy & Security Settings', icon: <LifeBuoy className="h-5 w-5" />, time: '4 min read' }
  ];

  const filteredFaqs = selectedCategory
    ? faqs.filter(cat => cat.category === selectedCategory)
    : searchQuery
    ? faqs.map(cat => ({
        ...cat,
        questions: cat.questions.filter(q =>
          q.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
          q.a.toLowerCase().includes(searchQuery.toLowerCase())
        )
      })).filter(cat => cat.questions.length > 0)
    : faqs;

  const statusBadge = (s: ServiceStatus) => {
    if (s === 'operational')
      return <Badge variant="default" className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Operational</Badge>;
    if (s === 'degraded')
      return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Degraded</Badge>;
    return <Badge variant="outline" className="text-muted-foreground">Checking…</Badge>;
  };

  const services = [
    'Platform Services',
    'Video Consultations',
    'Health Records',
    'Mobile App',
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{t("help.title")}</h2>
        <p className="text-muted-foreground">{t('help.subtitle')}</p>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground/70" />
            <Input
              placeholder="Search for help articles, FAQs, or guides..."
              className="pl-10 text-lg h-12"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {searchQuery && (
            <div className="mt-2 text-sm text-muted-foreground">
              Found {filteredFaqs.reduce((acc, cat) => acc + cat.questions.length, 0)} results
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="faq" className="w-full">
        <TabsList>
          <TabsTrigger value="faq">{t('help.faq')}</TabsTrigger>
          <TabsTrigger value="contact">{t('help.contact')}</TabsTrigger>
          <TabsTrigger value="guides">{t('help.quickGuides')}</TabsTrigger>
        </TabsList>

        {/* FAQs Tab */}
        <TabsContent value="faq" className="space-y-6 mt-6">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedCategory === null ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(null)}
            >
              All Categories
            </Button>
            {faqs.map((cat) => (
              <Button
                key={cat.category}
                variant={selectedCategory === cat.category ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(cat.category)}
              >
                {cat.category}
              </Button>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Frequently Asked Questions</CardTitle>
              <CardDescription>
                {selectedCategory ? `Questions about ${selectedCategory}` : 'Common questions and answers'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredFaqs.map((category) => (
                <div key={category.category} className="mb-6 last:mb-0">
                  {!selectedCategory && (
                    <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                      <HelpCircle className="h-5 w-5 text-blue-600" />
                      {category.category}
                    </h3>
                  )}
                  <Accordion type="single" collapsible className="w-full">
                    {category.questions.map((faq, idx) => (
                      <AccordionItem key={idx} value={`item-${idx}`}>
                        <AccordionTrigger className="text-left">{faq.q}</AccordionTrigger>
                        <AccordionContent className="text-muted-foreground">{faq.a}</AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              ))}
              {filteredFaqs.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <HelpCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No results found. Try a different search term or browse all categories.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contact Support Tab */}
        <TabsContent value="contact" className="space-y-6 mt-6">
          {/* Support Channels */}
          <div className="grid md:grid-cols-2 gap-4">
            {supportChannels.map((channel, idx) => (
              <Card key={idx} className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${channel.color}`}>
                      {channel.icon}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1">{channel.title}</h3>
                      <p className="text-sm text-muted-foreground mb-2">{channel.description}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-blue-600">{channel.contact}</span>
                        <Badge variant="outline" className="text-xs">{channel.availability}</Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Contact Form */}
          <Card>
            <CardHeader>
              <CardTitle>Send us a Message</CardTitle>
              <CardDescription>
                Fill out the form below and we'll get back to you within 24 hours
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="support-name">Your Name</Label>
                  <Input
                    id="support-name"
                    placeholder="John Doe"
                    value={form.name}
                    onChange={(e) => handleFormChange('name', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="support-email">Email Address</Label>
                  <Input
                    id="support-email"
                    type="email"
                    placeholder="john@example.com"
                    value={form.email}
                    onChange={(e) => handleFormChange('email', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="support-subject">Subject</Label>
                <Input
                  id="support-subject"
                  placeholder="How can we help you?"
                  value={form.subject}
                  onChange={(e) => handleFormChange('subject', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="support-message">Message</Label>
                <Textarea
                  id="support-message"
                  placeholder="Describe your issue or question in detail..."
                  rows={6}
                  value={form.message}
                  onChange={(e) => handleFormChange('message', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Priority</Label>
                <div className="flex gap-2">
                  {(['LOW', 'MEDIUM', 'URGENT'] as Priority[]).map((p) => (
                    <Button
                      key={p}
                      variant={form.priority === p ? 'default' : 'outline'}
                      size="sm"
                      className={`flex-1 ${form.priority === p && p === 'URGENT' ? 'bg-red-600 hover:bg-red-700' : ''}`}
                      onClick={() => handleFormChange('priority', p)}
                      type="button"
                    >
                      {p.charAt(0) + p.slice(1).toLowerCase()}
                    </Button>
                  ))}
                </div>
              </div>

              <Button className="w-full" onClick={handleSubmit} disabled={submitting}>
                {submitting
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending…</>
                  : <><Send className="h-4 w-4 mr-2" />Send Message</>}
              </Button>
            </CardContent>
          </Card>

          {/* Emergency Contact */}
          <Card className="bg-red-50 border-red-200">
            <CardContent className="pt-6">
              <div className="flex gap-4">
                <div className="h-12 w-12 bg-red-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-red-900 mb-1">Medical Emergency?</h4>
                  <p className="text-sm text-red-800 mb-3">
                    If you're experiencing a medical emergency, please call emergency services immediately.
                  </p>
                  <div className="flex gap-2">
                    <Button variant="destructive" size="sm" asChild>
                      <a href="tel:912"><Phone className="h-4 w-4 mr-2" />Call 912 (Ambulance)</a>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a href="tel:112"><Phone className="h-4 w-4 mr-2" />Call 112 (Police)</a>
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Quick Guides Tab */}
        <TabsContent value="guides" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Start Guides</CardTitle>
              <CardDescription>Step-by-step tutorials to help you get the most out of SHCP</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {quickGuides.map((guide, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                        {guide.icon}
                      </div>
                      <div>
                        <h4 className="font-medium group-hover:text-blue-600 transition-colors">
                          {guide.title}
                        </h4>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                          <Clock className="h-3 w-3" />
                          <span>{guide.time}</span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground/70 group-hover:text-blue-600 transition-colors" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>Video Tutorials</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                    <Video className="h-12 w-12 text-muted-foreground/70" />
                  </div>
                  <h4 className="font-medium">Platform Overview</h4>
                  <p className="text-sm text-muted-foreground">Learn the basics of navigating SHCP</p>
                  <Button variant="outline" className="w-full">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Watch Tutorial
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Documentation</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="aspect-video bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg flex items-center justify-center">
                    <Book className="h-12 w-12 text-blue-600" />
                  </div>
                  <h4 className="font-medium">Complete User Manual</h4>
                  <p className="text-sm text-muted-foreground">Comprehensive guide to all features</p>
                  <Button variant="outline" className="w-full">
                    <FileText className="h-4 w-4 mr-2" />
                    View Documentation
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle>System Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {services.map((service) => (
              <div key={service} className="flex items-center justify-between">
                <span className="text-sm">{service}</span>
                {statusBadge(systemStatus)}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
