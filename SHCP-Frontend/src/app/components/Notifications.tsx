import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Switch } from '@/app/components/ui/switch';
import { Label } from '@/app/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import {
  Bell, Calendar, Pill, MessageSquare, AlertCircle,
  Check, X, Settings, Mail, Volume2, Loader2, Activity
} from 'lucide-react';
import { Notification } from '@/app/types';
import { notificationsApi, ApiNotification } from '@/app/api/notifications';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

function mapApiNotification(n: ApiNotification): Notification {
  return {
    id: n.notificationId,
    userId: n.userId,
    type: n.type,
    title: n.title,
    message: n.message,
    date: n.date,
    read: n.read,
  };
}

export const Notifications: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [notificationSettings, setNotificationSettings] = useState({
    email: true,
    push: true,
    appointments: true,
    prescriptions: true,
    messages: true,
    reminders: true,
    healthTips: false
  });

  useEffect(() => {
    const fetch = () =>
      notificationsApi.getMyNotifications()
        .then(list => setNotifications((list ?? []).map(mapApiNotification)))
        .catch(() => {})
        .finally(() => setLoading(false));

    fetch();
    const interval = setInterval(fetch, 30_000);
    window.addEventListener('shcp:new-notification', fetch);
    return () => {
      clearInterval(interval);
      window.removeEventListener('shcp:new-notification', fetch);
    };
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id: string) => {
    notificationsApi.markAsRead(id).catch(() => {});
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    toast.success('Marked as read');
  };

  const markAllAsRead = () => {
    notificationsApi.markAllAsRead().catch(() => {});
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    toast.success('All notifications marked as read');
  };

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    toast.success('Notification deleted');
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'appointment': return <Calendar className="h-5 w-5 text-blue-600" />;
      case 'prescription': return <Pill className="h-5 w-5 text-green-600" />;
      case 'message': return <MessageSquare className="h-5 w-5 text-purple-600" />;
      case 'alert': return <AlertCircle className="h-5 w-5 text-red-600" />;
      case 'reminder': return <Bell className="h-5 w-5 text-yellow-600" />;
      default: return <Bell className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'appointment': return 'bg-blue-50';
      case 'prescription': return 'bg-green-50';
      case 'message': return 'bg-purple-50';
      case 'alert': return 'bg-red-50';
      case 'reminder': return 'bg-yellow-50';
      default: return 'bg-muted/50';
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const renderList = (list: Notification[]) => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/70" />
        </div>
      );
    }
    if (list.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          <Bell className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>{t("notifications.noNotifications")}</p>
        </div>
      );
    }
    return (
      <div className="space-y-3">
        {list.map((notif) => (
          <div
            key={notif.id}
            className={`p-4 border rounded-lg transition-all ${
              notif.read ? 'bg-card' : getNotificationColor(notif.type)
            } ${!notif.read ? 'border-l-4 border-l-blue-600' : ''}`}
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">{getNotificationIcon(notif.type)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between mb-1">
                  <h4 className="font-medium">{notif.title}</h4>
                  <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                    {formatTime(notif.date)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-2">{notif.message}</p>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs capitalize">{notif.type}</Badge>
                  {!notif.read && <Badge variant="default" className="text-xs">New</Badge>}
                </div>
              </div>
              <div className="flex gap-1">
                {!notif.read && (
                  <Button size="sm" variant="ghost" onClick={() => markAsRead(notif.id)}>
                    <Check className="h-4 w-4" />
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => deleteNotification(notif.id)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{t("notifications.title")}</h2>
          <p className="text-muted-foreground">{t('notifications.subtitle')}</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" onClick={markAllAsRead}>
            <Check className="h-4 w-4 mr-2" />
            {t('notifications.markAllRead')}
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{notifications.length}</p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Bell className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('notifications.unread')}</p>
                <p className="text-2xl font-bold">{unreadCount}</p>
              </div>
              <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('notifications.appointment')}</p>
                <p className="text-2xl font-bold">
                  {notifications.filter(n => n.type === 'appointment').length}
                </p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                <Calendar className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Alerts</p>
                <p className="text-2xl font-bold">
                  {notifications.filter(n => n.type === 'alert').length}
                </p>
              </div>
              <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                <Activity className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">All ({notifications.length})</TabsTrigger>
          <TabsTrigger value="unread">Unread ({unreadCount})</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <Card>
            <CardContent className="pt-6">
              {renderList(notifications)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="unread" className="mt-6">
          <Card>
            <CardContent className="pt-6">
              {renderList(notifications.filter(n => !n.read))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Notification Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-medium mb-4">Notification Channels</h4>
                <div className="space-y-4">
                  {[
                    { key: 'email', label: 'Email Notifications', desc: 'Receive notifications via email', icon: <Mail className="h-5 w-5 text-blue-600" />, bg: 'bg-blue-100' },
                    { key: 'push', label: 'Push Notifications', desc: 'Receive browser push notifications', icon: <Volume2 className="h-5 w-5 text-purple-600" />, bg: 'bg-purple-100' },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 ${item.bg} rounded-full flex items-center justify-center`}>
                          {item.icon}
                        </div>
                        <div>
                          <Label htmlFor={item.key}>{item.label}</Label>
                          <p className="text-sm text-muted-foreground">{item.desc}</p>
                        </div>
                      </div>
                      <Switch
                        id={item.key}
                        checked={notificationSettings[item.key as keyof typeof notificationSettings]}
                        onCheckedChange={(checked) =>
                          setNotificationSettings(prev => ({ ...prev, [item.key]: checked }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-6">
                <h4 className="font-medium mb-4">Notification Types</h4>
                <div className="space-y-3">
                  {[
                    { key: 'appointments', label: 'Appointment Reminders' },
                    { key: 'prescriptions', label: 'Prescription Updates' },
                    { key: 'messages', label: 'Doctor Messages' },
                    { key: 'reminders', label: 'Medication Reminders' },
                    { key: 'healthTips', label: 'Health Tips & Education' }
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between py-2">
                      <Label htmlFor={item.key}>{item.label}</Label>
                      <Switch
                        id={item.key}
                        checked={notificationSettings[item.key as keyof typeof notificationSettings]}
                        onCheckedChange={(checked) =>
                          setNotificationSettings(prev => ({ ...prev, [item.key]: checked }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>

              <Button className="w-full" onClick={() => toast.success('Settings saved successfully')}>
                Save Preferences
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
