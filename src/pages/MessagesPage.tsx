import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Send, Trash2, Clock, Globe, User as UserIcon, Users as UsersIcon, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  Message,
  MessageTarget,
  deleteMessage,
  sendMessage,
  subscribeMessages,
} from '@/lib/messagesStore';

type Duration = 24 | 48 | 72;

const MessagesPage = () => {
  const { user, users } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState('');
  const [targetType, setTargetType] = useState<MessageTarget>('global');
  const [duration, setDuration] = useState<Duration>(24);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeMessages(user.id, setMessages);
    return unsub;
  }, [user?.id]);

  const otherUsers = useMemo(
    () => users.filter(u => u.id !== user?.id),
    [users, user?.id]
  );

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.trim().toLowerCase();
    return otherUsers
      .filter(u => !recipients.includes(u.id))
      .filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
      .slice(0, 6);
  }, [search, otherUsers, recipients]);

  const userById = useMemo(() => new Map(users.map(u => [u.id, u])), [users]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!content.trim()) return toast.error('Le message est vide');
    if (targetType === 'user' && recipients.length !== 1) {
      return toast.error('Sélectionnez exactement 1 destinataire');
    }
    if (targetType === 'group' && recipients.length < 2) {
      return toast.error('Sélectionnez au moins 2 destinataires');
    }

    setSending(true);
    const ok = await sendMessage({
      senderId: user.id,
      senderName: user.name,
      content,
      targetType,
      targetIds: targetType === 'global' ? [] : recipients,
      durationHours: duration,
    });
    setSending(false);

    if (ok) {
      toast.success('Message envoyé');
      setContent('');
      setRecipients([]);
      setSearch('');
    } else {
      toast.error("Échec de l'envoi");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce message ?')) return;
    const ok = await deleteMessage(id);
    if (ok) toast.success('Message supprimé');
    else toast.error('Suppression impossible');
  };

  const formatRemaining = (expiresAt: Date) => {
    const ms = expiresAt.getTime() - Date.now();
    if (ms <= 0) return 'expiré';
    const h = Math.floor(ms / (60 * 60 * 1000));
    const m = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
    if (h >= 1) return `${h}h${m.toString().padStart(2, '0')}`;
    return `${m}min`;
  };

  const targetIcon = (t: MessageTarget) => {
    if (t === 'global') return <Globe className="h-3.5 w-3.5" />;
    if (t === 'user') return <UserIcon className="h-3.5 w-3.5" />;
    return <UsersIcon className="h-3.5 w-3.5" />;
  };

  const targetLabel = (m: Message) => {
    if (m.targetType === 'global') return 'Tous';
    const names = m.targetIds.map(id => userById.get(id)?.name || '?').join(', ');
    return names || '—';
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold">Messages</h1>
          <p className="text-sm text-muted-foreground">
            Messagerie temporaire — les messages disparaissent automatiquement à expiration.
          </p>
        </div>

        {/* ===== Composer ===== */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Nouveau message</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSend} className="space-y-4">
              {/* Target type */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Destinataires</label>
                <Tabs
                  value={targetType}
                  onValueChange={v => {
                    setTargetType(v as MessageTarget);
                    setRecipients([]);
                  }}
                >
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="global"><Globe className="h-4 w-4" /> Tous</TabsTrigger>
                    <TabsTrigger value="user"><UserIcon className="h-4 w-4" /> Individuel</TabsTrigger>
                    <TabsTrigger value="group"><UsersIcon className="h-4 w-4" /> Groupe</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* Recipient picker */}
              {targetType !== 'global' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {targetType === 'user' ? 'Destinataire' : 'Destinataires'}
                  </label>
                  {recipients.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {recipients.map(id => {
                        const u = userById.get(id);
                        return (
                          <span
                            key={id}
                            className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs"
                          >
                            {u?.name || id}
                            <button
                              type="button"
                              onClick={() => setRecipients(r => r.filter(x => x !== id))}
                              className="hover:text-destructive"
                              aria-label="Retirer"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <div className="relative">
                    <Input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Rechercher un utilisateur…"
                    />
                    {searchResults.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md">
                        {searchResults.map(u => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => {
                              if (targetType === 'user') {
                                setRecipients([u.id]);
                              } else {
                                setRecipients(r => [...r, u.id]);
                              }
                              setSearch('');
                            }}
                            className="block w-full text-left px-3 py-2 text-sm hover:bg-accent"
                          >
                            <span className="font-medium">{u.name}</span>
                            <span className="block text-xs text-muted-foreground">{u.email}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Content */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Message</label>
                <Textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="Votre message…"
                  required
                />
              </div>

              {/* Duration */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Durée d'affichage</label>
                <Tabs value={String(duration)} onValueChange={v => setDuration(Number(v) as Duration)}>
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="24">24h</TabsTrigger>
                    <TabsTrigger value="48">48h</TabsTrigger>
                    <TabsTrigger value="72">72h</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <Button type="submit" disabled={sending} className="w-full gap-2">
                <Send className="h-4 w-4" /> {sending ? 'Envoi…' : 'Envoyer'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* ===== Messages list ===== */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Messages actifs ({messages.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {messages.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Aucun message pour le moment.
              </p>
            )}
            {messages.map(m => {
              const canDelete = m.senderId === user?.id;
              return (
                <div key={m.id} className="rounded-md border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{m.senderName}</span>
                        <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5">
                          {targetIcon(m.targetType)} {targetLabel(m)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {formatRemaining(m.expiresAt)}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap break-words">{m.content}</p>
                    </div>
                    {canDelete && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDelete(m.id)}
                        className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default MessagesPage;
