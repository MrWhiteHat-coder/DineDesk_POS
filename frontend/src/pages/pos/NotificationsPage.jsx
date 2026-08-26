import React, { useState, useEffect } from 'react';
import { notificationAPI } from '../../lib/api';
import { toast } from 'sonner';
import { Bell, MessageSquare, Send, CheckCircle, XCircle, Clock, Settings2, RefreshCw, Smartphone } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Switch } from '../../components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [settings, setSettings] = useState({ sms_enabled: true, whatsapp_enabled: true });
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [notifsRes, settingsRes] = await Promise.all([
        notificationAPI.getAll(),
        notificationAPI.getSettings(),
      ]);
      setNotifications(notifsRes.data);
      setSettings(settingsRes.data);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (key, value) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    try {
      await notificationAPI.updateSettings(updated);
      toast.success('Settings updated');
    } catch {
      toast.error('Failed to update settings');
    }
  };

  const sendTestNotification = async () => {
    setSending(true);
    try {
      await notificationAPI.sendTest();
      toast.success('Test notification sent! Check logs below.');
      setTimeout(fetchData, 2000);
    } catch (err) {
      toast.error('Failed to send test notification');
    } finally {
      setSending(false);
    }
  };

  const statusIcon = (status) => {
    if (status === 'sent') return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (status === 'failed') return <XCircle className="w-4 h-4 text-red-500" />;
    if (status === 'skipped') return <Clock className="w-4 h-4 text-slate-400" />;
    return <Clock className="w-4 h-4 text-amber-500" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-navy border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="notifications-page">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold text-ink">SMS & WhatsApp Notifications</h1>
        <div className="flex items-center gap-2">
          <Button onClick={sendTestNotification} disabled={sending} variant="outline" className="h-9 rounded-lg text-sm gap-2" data-testid="send-test-btn">
            {sending ? <div className="w-4 h-4 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
            Send Test
          </Button>
          <Button onClick={fetchData} variant="outline" className="h-9 rounded-lg gap-2" data-testid="refresh-notifications">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Settings */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Settings2 className="w-5 h-5" /> Notification Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-800">SMS Notifications</p>
                <p className="text-xs text-slate-500">Send order confirmation via SMS to customer phone</p>
              </div>
            </div>
            <Switch checked={settings.sms_enabled} onCheckedChange={(v) => updateSettings('sms_enabled', v)} data-testid="sms-toggle" />
          </div>
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-800">WhatsApp Notifications</p>
                <p className="text-xs text-slate-500">Send order confirmation via WhatsApp</p>
              </div>
            </div>
            <Switch checked={settings.whatsapp_enabled} onCheckedChange={(v) => updateSettings('whatsapp_enabled', v)} data-testid="whatsapp-toggle" />
          </div>
          <p className="text-xs text-slate-400 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <span className="font-semibold text-amber-700">[DEMO MODE]</span> Notifications are currently logged but not sent. Provide production Twilio/WhatsApp Business credentials to enable live delivery.
          </p>
        </CardContent>
      </Card>

      {/* Notification Logs */}
      <Card className="border-slate-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base"><Bell className="w-5 h-5" /> Recent Notification Logs</CardTitle>
            <span className="text-xs text-slate-400">{notifications.length} notifications</span>
          </div>
        </CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Bell className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium">No notifications sent yet</p>
              <p className="text-xs mt-1">Notifications will appear here after orders are completed</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notif) => (
                <div key={notif.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100 transition-colors" data-testid={`notif-${notif.id}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      {statusIcon(notif.status)}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-800">{notif.customer_name}</span>
                          <span className="text-xs text-slate-400">{notif.customer_phone}</span>
                          <span className="text-xs font-mono text-slate-400">#{notif.order_number}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{notif.message}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                            notif.status === 'sent' ? 'bg-green-100 text-green-700'
                            : notif.status === 'failed' ? 'bg-red-100 text-red-700'
                            : 'bg-slate-200 text-slate-600'
                          }`}>SMS: {notif.status}</span>
                          {notif.whatsapp_status && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                              notif.whatsapp_status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>WhatsApp: {notif.whatsapp_status}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">{new Date(notif.created_at).toLocaleString()}</span>
                  </div>
                  {notif.error && <p className="text-[10px] text-red-500 mt-1 bg-red-50 rounded p-1.5 font-mono">{notif.error}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
