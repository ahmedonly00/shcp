import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Textarea } from '@/app/components/ui/textarea';
import { Badge } from '@/app/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/app/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';
import { Label } from '@/app/components/ui/label';
import {
  MessageSquare, Send, Search, Plus,
  Star, Check, CheckCheck,
  Phone, Video, Loader2, ShieldCheck
} from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { messagesApi, ApiConversation, ApiMessage } from '@/app/api/messages';
import { providersApi } from '@/app/api/providers';
import { mapApiAppointment } from '@/app/types';

interface ContactOption { id: string; name: string; role: string; }

// Poll the active thread every 8 s; poll conversation list every 20 s
const THREAD_POLL_MS  = 8_000;
const CONV_POLL_MS    = 20_000;

export const Messages: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const isProvider = user?.role === 'doctor';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);

  const [conversations, setConversations] = useState<ApiConversation[]>([]);
  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');

  // New conversation dialog
  const [showNewConvDialog, setShowNewConvDialog] = useState(false);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState('');
  const [startingConv, setStartingConv] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const threadPollRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const convPollRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  // Track last known message count so we only scroll on actual new messages
  const lastMsgCountRef = useRef(0);

  // ── Load conversation list ────────────────────────────────────────────────

  const loadConversations = useCallback(async (silent = false) => {
    if (!silent) setLoadingConvs(true);
    try {
      const convs = await messagesApi.listConversations();
      setConversations(convs);
    } catch {
      if (!silent) toast.error('Failed to load conversations');
    } finally {
      if (!silent) setLoadingConvs(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Poll conversation list in background to update unread counts
  useEffect(() => {
    convPollRef.current = setInterval(() => loadConversations(true), CONV_POLL_MS);
    return () => {
      if (convPollRef.current) clearInterval(convPollRef.current);
    };
  }, [loadConversations]);

  // ── Load messages + polling when a thread is selected ────────────────────

  const loadMessages = useCallback(async (convId: string, silent = false) => {
    if (!silent) { setLoadingMsgs(true); setMessages([]); }
    try {
      const msgs = await messagesApi.getMessages(convId);
      setMessages(prev => {
        // silent refresh: only update if there are genuinely new messages
        if (silent && msgs.length === prev.length) return prev;
        return msgs;
      });
      setConversations(prev =>
        prev.map(c => c.conversationId === convId ? { ...c, unreadCount: 0 } : c)
      );
    } catch {
      if (!silent) toast.error('Failed to load messages');
    } finally {
      if (!silent) setLoadingMsgs(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedConvId) return;
    lastMsgCountRef.current = 0;
    loadMessages(selectedConvId);

    // Start polling for new messages in this thread
    if (threadPollRef.current) clearInterval(threadPollRef.current);
    threadPollRef.current = setInterval(() => loadMessages(selectedConvId, true), THREAD_POLL_MS);

    return () => {
      if (threadPollRef.current) clearInterval(threadPollRef.current);
    };
  }, [selectedConvId, loadMessages]);

  // Scroll to bottom only when message count increases
  useEffect(() => {
    if (messages.length > lastMsgCountRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      lastMsgCountRef.current = messages.length;
    }
  }, [messages]);

  // ── Load contacts for "New Message" dialog ────────────────────────────────

  const loadContacts = useCallback(async () => {
    setLoadingContacts(true);
    try {
      if (isProvider) {
        // Provider → pick from patients in their appointment history
        const appts = await providersApi.getMyAppointments(0, 100);
        const seen = new Set<string>();
        const opts: ContactOption[] = [];
        (appts ?? []).map(mapApiAppointment).forEach(a => {
          if (!seen.has(a.patientId)) {
            seen.add(a.patientId);
            opts.push({ id: a.patientId, name: a.patientName, role: 'Patient' });
          }
        });
        setContacts(opts);
      } else {
        // Patient → pick from the provider directory
        const provs = await providersApi.list();
        setContacts((provs ?? []).map(p => ({
          id: p.providerId,
          name: p.name,
          role: p.specialty ?? 'Provider',
        })));
      }
    } catch {
      toast.error('Failed to load contacts');
    } finally {
      setLoadingContacts(false);
    }
  }, [isProvider]);

  const openNewConvDialog = () => {
    setSelectedContactId('');
    setShowNewConvDialog(true);
    loadContacts();
  };

  const handleStartConversation = async () => {
    if (!selectedContactId) return;
    setStartingConv(true);
    try {
      const conv = await messagesApi.startConversation(selectedContactId);
      // Add to list if it's a brand-new conversation, otherwise just select it
      setConversations(prev => {
        const existing = prev.find(c => c.conversationId === conv.conversationId);
        return existing ? prev : [conv, ...prev];
      });
      setSelectedConvId(conv.conversationId);
      setShowNewConvDialog(false);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e?.response?.data?.message || 'Failed to start conversation');
    } finally {
      setStartingConv(false);
    }
  };

  // ── Send message ──────────────────────────────────────────────────────────

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConvId) return;
    const text = newMessage.trim();
    setNewMessage('');
    setSending(true);
    try {
      const sent = await messagesApi.sendMessage(selectedConvId, text);
      setMessages(prev => [...prev, sent]);
      setConversations(prev =>
        prev.map(c =>
          c.conversationId === selectedConvId
            ? { ...c, lastMessage: text, lastMessageTime: sent.sentAt }
            : c
        )
      );
    } catch {
      toast.error('Failed to send message');
      setNewMessage(text); // restore on error
    } finally {
      setSending(false);
    }
  };

  // ── Star toggle ───────────────────────────────────────────────────────────

  const handleToggleStar = async (convId: string) => {
    try {
      const updated = await messagesApi.toggleStar(convId);
      setConversations(prev => prev.map(c => c.conversationId === convId ? updated : c));
    } catch {
      toast.error('Failed to update star');
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  const selectedConv = conversations.find(c => c.conversationId === selectedConvId) ?? null;

  const filteredConversations = conversations.filter(conv =>
    conv.participantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (conv.lastMessage ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const diffHours = (Date.now() - date.getTime()) / 3_600_000;
    if (diffHours < 24) return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    if (diffHours < 48) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Group messages by date for date separators
  const groupedMessages = (() => {
    const groups: { date: string; msgs: ApiMessage[] }[] = [];
    messages.forEach(msg => {
      const d = new Date(msg.sentAt);
      const label = (() => {
        const diff = (Date.now() - d.getTime()) / 86_400_000;
        if (diff < 1) return 'Today';
        if (diff < 2) return 'Yesterday';
        return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      })();
      const last = groups[groups.length - 1];
      if (!last || last.date !== label) groups.push({ date: label, msgs: [msg] });
      else last.msgs.push(msg);
    });
    return groups;
  })();

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[calc(100vh-130px)] gap-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h2 className="text-2xl font-bold">{t("messages.title")}</h2>
          <p className="text-muted-foreground text-sm">{t("messages.subtitle")}</p>
        </div>
        <Button onClick={openNewConvDialog} size="sm" className="bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-1" /> {t("messages.newMessage")}
        </Button>
      </div>

      {/* Main chat layout */}
      <div className="flex flex-1 min-h-0 rounded-xl border bg-card shadow-sm overflow-hidden">

        {/* ── Left: conversation list ─────────────────────────────────────── */}
        <div className="w-80 flex-shrink-0 flex flex-col border-r bg-muted/50">
          {/* Search */}
          <div className="p-3 border-b bg-card">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
              <Input
                placeholder={t("messages.searchMessages")}
                className="pl-9 h-9 bg-muted/50 border-border text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loadingConvs ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/70" />
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="text-center py-12 px-4">
                <MessageSquare className="h-10 w-10 mx-auto mb-3 text-muted-foreground/70" />
                <p className="text-sm font-medium text-muted-foreground">{t("messages.noConversations")}</p>
                <Button variant="link" size="sm" className="mt-1 text-primary text-xs" onClick={openNewConvDialog}>
                  Start a new conversation
                </Button>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isActive = selectedConvId === conv.conversationId;
                const initials = conv.participantName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                return (
                  <button
                    key={conv.conversationId}
                    onClick={() => setSelectedConvId(conv.conversationId)}
                    className={`w-full text-left px-4 py-3 border-b border-border transition-colors flex items-start gap-3 ${
                      isActive ? 'bg-secondary border-l-[3px] border-l-primary' : 'hover:bg-card'
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white text-sm font-semibold">
                        {initials}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-sm truncate ${conv.unreadCount > 0 ? 'font-semibold text-foreground' : 'font-medium text-foreground/80'}`}>
                          {conv.participantName}
                        </span>
                        <div className="flex items-center gap-1 flex-shrink-0 ml-1">
                          {conv.starred && <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />}
                          <span className="text-[10px] text-muted-foreground/70">{formatTime(conv.lastMessageTime)}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <p className={`text-xs truncate ${conv.unreadCount > 0 ? 'text-foreground/80' : 'text-muted-foreground/70'}`}>
                          {conv.lastMessage ?? 'No messages yet'}
                        </p>
                        {conv.unreadCount > 0 && (
                          <Badge className="h-4 min-w-4 text-[10px] px-1 ml-1 bg-primary flex-shrink-0">
                            {conv.unreadCount}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Secure badge at bottom of sidebar */}
          <div className="p-3 border-t bg-card flex items-center gap-2 text-xs text-muted-foreground/70">
            <ShieldCheck className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
            {t("messages.secureMessaging")}
          </div>
        </div>

        {/* ── Right: message thread ───────────────────────────────────────── */}
        {selectedConv ? (
          <div className="flex-1 flex flex-col min-w-0">
            {/* Thread header */}
            <div className="flex items-center justify-between px-5 py-3 border-b bg-card flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                  {selectedConv.participantName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-sm text-foreground">{selectedConv.participantName}</p>
                  <p className="text-xs text-muted-foreground/70 capitalize">{selectedConv.participantRole}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground/70 hover:text-foreground/80">
                  <Phone className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground/70 hover:text-foreground/80">
                  <Video className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-muted-foreground/70 hover:text-yellow-500"
                  onClick={() => handleToggleStar(selectedConv.conversationId)}
                >
                  <Star className={`h-4 w-4 ${selectedConv.starred ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                </Button>
              </div>
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto px-5 py-4 bg-background">
              {loadingMsgs ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/70" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <MessageSquare className="h-12 w-12 text-muted-foreground/70 mb-3" />
                  <p className="text-sm text-muted-foreground/70">{t('messages.noMessages')}</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">{t('messages.sendToStart')}</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {groupedMessages.map(({ date, msgs }) => (
                    <div key={date}>
                      {/* Date separator */}
                      <div className="flex items-center gap-3 my-4">
                        <div className="flex-1 h-px bg-muted" />
                        <span className="text-[11px] text-muted-foreground/70 font-medium px-2">{date}</span>
                        <div className="flex-1 h-px bg-muted" />
                      </div>

                      {msgs.map((msg, i) => {
                        const isOwn = msg.senderId === user?.id;
                        const prevMsg = i > 0 ? msgs[i - 1] : null;
                        const isFirstInGroup = !prevMsg || prevMsg.senderId !== msg.senderId;
                        const nextMsg = msgs[i + 1];
                        const isLastInGroup = !nextMsg || nextMsg.senderId !== msg.senderId;

                        return (
                          <div
                            key={msg.messageId}
                            className={`flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'} ${isFirstInGroup ? 'mt-3' : 'mt-0.5'}`}
                          >
                            {/* Avatar — only shown for last message in a group (received side) */}
                            {!isOwn ? (
                              <div className={`h-7 w-7 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-semibold bg-gradient-to-br from-primary to-primary/60 ${isLastInGroup ? 'opacity-100' : 'opacity-0'}`}>
                                {msg.senderName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                              </div>
                            ) : (
                              <div className="w-7 flex-shrink-0" />
                            )}

                            <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[65%]`}>
                              {/* Sender name — only on first in group for received */}
                              {!isOwn && isFirstInGroup && (
                                <p className="text-[11px] text-muted-foreground/70 font-medium mb-1 ml-1">{msg.senderName}</p>
                              )}

                              {/* Bubble */}
                              <div
                                className={`px-4 py-2.5 text-sm leading-relaxed break-words ${
                                  isOwn
                                    ? 'bg-primary text-white rounded-2xl rounded-br-sm'
                                    : 'bg-card text-foreground rounded-2xl rounded-bl-sm shadow-sm border border-border'
                                } ${isFirstInGroup && isOwn ? 'rounded-tr-2xl' : ''} ${isFirstInGroup && !isOwn ? 'rounded-tl-2xl' : ''}`}
                              >
                                {msg.body}
                              </div>

                              {/* Timestamp + read receipt — only on last in group */}
                              {isLastInGroup && (
                                <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                                  <span className="text-[10px] text-muted-foreground/70">
                                    {new Date(msg.sentAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  {isOwn && (
                                    <span className={msg.read ? 'text-blue-400' : 'text-muted-foreground/70'}>
                                      {msg.read ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input area */}
            <div className="px-5 py-3 border-t bg-card flex-shrink-0">
              <div className="flex items-end gap-2">
                <Textarea
                  placeholder={t("messages.typeMessage")}
                  value={newMessage}
                  rows={1}
                  className="flex-1 resize-none min-h-[40px] max-h-32 text-sm py-2.5 leading-relaxed border-border focus-visible:ring-primary rounded-xl"
                  onChange={(e) => {
                    setNewMessage(e.target.value);
                    // auto-grow
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px';
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || sending}
                  className="h-10 w-10 p-0 rounded-xl bg-primary hover:bg-primary/90 flex-shrink-0"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground/70 mt-1.5">Enter to send · Shift+Enter for new line · Updates every {THREAD_POLL_MS / 1000}s</p>
            </div>
          </div>
        ) : (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center bg-background text-center p-8">
            <div className="h-16 w-16 rounded-full bg-blue-50 flex items-center justify-center mb-4">
              <MessageSquare className="h-8 w-8 text-primary opacity-60" />
            </div>
            <h3 className="font-semibold text-foreground/80 mb-1">{t('messages.yourMessages')}</h3>
            <p className="text-sm text-muted-foreground/70 max-w-xs">{t('messages.selectOrStartNew')}</p>
            <Button onClick={openNewConvDialog} size="sm" className="mt-4 bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-1" /> {t('messages.newMessage')}
            </Button>
          </div>
        )}
      </div>

      {/* ── New Conversation Dialog ───────────────────────────────────────── */}
      <Dialog open={showNewConvDialog} onOpenChange={setShowNewConvDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("messages.newMessage")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{isProvider ? 'Select Patient' : 'Select Provider'}</Label>
              {loadingContacts ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/70" />
                </div>
              ) : contacts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  {isProvider
                    ? 'No patients found. Patients appear here once you have appointments with them.'
                    : 'No providers found.'}
                </p>
              ) : (
                <Select value={selectedContactId} onValueChange={setSelectedContactId}>
                  <SelectTrigger>
                    <SelectValue placeholder={isProvider ? 'Choose a patient...' : 'Choose a provider...'} />
                  </SelectTrigger>
                  <SelectContent>
                    {contacts.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="font-medium">{c.name}</span>
                        <span className="text-muted-foreground text-xs ml-2">— {c.role}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewConvDialog(false)}>{t("common.cancel")}</Button>
            <Button
              onClick={handleStartConversation}
              disabled={!selectedContactId || startingConv || contacts.length === 0}
            >
              {startingConv ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MessageSquare className="h-4 w-4 mr-2" />}
              Open Conversation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
