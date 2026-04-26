import React, { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Save, Pencil, X, GripVertical, ShieldCheck, ShieldOff, Mail, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { useShifts, shiftStyle } from '@/hooks/useShifts';
import { upsertShift, deleteShift, defaultColorFor, DynamicShift } from '@/lib/shiftsStore';
import { useDisplaySettings } from '@/hooks/useDisplaySettings';
import { applyAgentOrder, saveAgentOrder } from '@/lib/displayStore';
import { useSalarySettings } from '@/hooks/useSalarySettings';
import { saveSalarySettings, SalarySettings } from '@/lib/salaryStore';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const emptyDraft: DynamicShift = {
  code: '',
  label: '',
  hours: 8,
  time: '',
  color: defaultColorFor('day'),
  category: 'day',
};

const MaintenancePage = () => {
  const { isAdmin } = useAuth();
  const { shifts } = useShifts();
  const [editing, setEditing] = useState<Record<string, DynamicShift>>({});
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<DynamicShift>(emptyDraft);

  if (!isAdmin) return <Navigate to="/planning" replace />;

  const startEdit = (s: DynamicShift) => setEditing(prev => ({ ...prev, [s.code]: { ...s } }));
  const cancelEdit = (code: string) =>
    setEditing(prev => {
      const next = { ...prev };
      delete next[code];
      return next;
    });

  const saveEdit = async (code: string) => {
    const v = editing[code];
    if (!v.label.trim()) return toast.error('Le nom est requis');
    const ok = await upsertShift({ ...v, code });
    if (ok) {
      toast.success(`${code} mis à jour`);
      cancelEdit(code);
    } else toast.error('Échec de la mise à jour');
  };

  const handleDelete = async (code: string) => {
    if (!confirm(`Supprimer l'horaire "${code}" ?`)) return;
    const ok = await deleteShift(code);
    if (ok) toast.success('Horaire supprimé');
    else toast.error('Suppression impossible');
  };

  const handleCreate = async () => {
    const code = draft.code.trim().toUpperCase();
    if (!code) return toast.error('Code requis (ex: J12)');
    if (!draft.label.trim()) return toast.error('Nom requis');
    if (shifts.some(s => s.code === code)) return toast.error('Ce code existe déjà');
    const ok = await upsertShift({ ...draft, code });
    if (ok) {
      toast.success(`${code} créé`);
      setDraft(emptyDraft);
      setCreating(false);
    } else toast.error('Création impossible');
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold">Maintenance</h1>
          <p className="text-sm text-muted-foreground">Gérer les horaires et l'affichage du planning</p>
        </div>

        <Tabs defaultValue="shifts" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="shifts">Horaires</TabsTrigger>
            <TabsTrigger value="display">Affichage</TabsTrigger>
            <TabsTrigger value="users">Utilisateurs</TabsTrigger>
            <TabsTrigger value="salary">Salaire</TabsTrigger>
          </TabsList>

          {/* ---- Onglet Horaires ---- */}
          <TabsContent value="shifts" className="space-y-4 mt-4">
            <div className="flex justify-end">
              <Button onClick={() => setCreating(c => !c)} variant={creating ? 'outline' : 'default'} size="sm">
                {creating ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {creating ? 'Annuler' : 'Ajouter'}
              </Button>
            </div>

            {creating && (
              <Card>
                <CardHeader><CardTitle className="text-lg">Nouvel horaire</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Code (ex: J12)">
                      <Input value={draft.code} onChange={e => setDraft({ ...draft, code: e.target.value })} placeholder="J12" />
                    </Field>
                    <Field label="Nom affiché">
                      <Input value={draft.label} onChange={e => setDraft({ ...draft, label: e.target.value })} placeholder="Agent de journée" />
                    </Field>
                    <Field label="Heures">
                      <Input type="number" step="0.5" value={draft.hours} onChange={e => setDraft({ ...draft, hours: parseFloat(e.target.value) || 0 })} />
                    </Field>
                    <Field label="Plage horaire">
                      <Input value={draft.time} onChange={e => setDraft({ ...draft, time: e.target.value })} placeholder="07:00-19:00" />
                    </Field>
                    <Field label="Couleur">
                      <div className="flex items-center gap-2">
                        <input type="color" value={draft.color} onChange={e => setDraft({ ...draft, color: e.target.value })} className="h-10 w-14 rounded border cursor-pointer" />
                        <Input value={draft.color} onChange={e => setDraft({ ...draft, color: e.target.value })} placeholder="#3b82f6" />
                      </div>
                    </Field>
                    <Field label="Aperçu">
                      <span className="inline-block px-3 py-1 rounded border text-xs font-semibold" style={shiftStyle(draft.color)}>
                        {draft.code || 'CODE'}
                      </span>
                    </Field>
                  </div>
                  <Button onClick={handleCreate} className="w-full"><Save className="h-4 w-4" /> Créer</Button>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader><CardTitle className="text-lg">Horaires ({shifts.length})</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {shifts.map(s => {
                  const e = editing[s.code];
                  if (e) {
                    return (
                      <div key={s.code} className="rounded-md border p-3 space-y-3 bg-muted/20">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="Code"><Input value={s.code} disabled /></Field>
                          <Field label="Nom"><Input value={e.label} onChange={ev => setEditing({ ...editing, [s.code]: { ...e, label: ev.target.value } })} /></Field>
                          <Field label="Heures"><Input type="number" step="0.5" value={e.hours} onChange={ev => setEditing({ ...editing, [s.code]: { ...e, hours: parseFloat(ev.target.value) || 0 } })} /></Field>
                          <Field label="Plage"><Input value={e.time} onChange={ev => setEditing({ ...editing, [s.code]: { ...e, time: ev.target.value } })} /></Field>
                          <Field label="Couleur">
                            <div className="flex items-center gap-2">
                              <input type="color" value={e.color} onChange={ev => setEditing({ ...editing, [s.code]: { ...e, color: ev.target.value } })} className="h-10 w-14 rounded border cursor-pointer" />
                              <Input value={e.color} onChange={ev => setEditing({ ...editing, [s.code]: { ...e, color: ev.target.value } })} />
                            </div>
                          </Field>
                          <Field label="Aperçu">
                            <span className="inline-block px-3 py-1 rounded border text-xs font-semibold" style={shiftStyle(e.color)}>
                              {s.code}
                            </span>
                          </Field>
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={() => saveEdit(s.code)} size="sm"><Save className="h-4 w-4" /> Enregistrer</Button>
                          <Button onClick={() => cancelEdit(s.code)} size="sm" variant="outline">Annuler</Button>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={s.code} className="flex items-center justify-between rounded-md border p-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="inline-block px-2 py-1 rounded border text-xs font-semibold min-w-[48px] text-center" style={shiftStyle(s.color)}>
                          {s.code}
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{s.label}</p>
                          <p className="text-xs text-muted-foreground">{s.hours}h • {s.time || '—'}</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => startEdit(s)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(s.code)} className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ---- Onglet Affichage ---- */}
          <TabsContent value="display" className="space-y-4 mt-4">
            <AgentOrderEditor />
          </TabsContent>

          {/* ---- Onglet Utilisateurs (rôles) ---- */}
          <TabsContent value="users" className="space-y-4 mt-4">
            <UserRolesEditor />
          </TabsContent>

          {/* ---- Onglet Salaire ---- */}
          <TabsContent value="salary" className="space-y-4 mt-4">
            <SalaryEditor />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

// =================== Sous-composant : gestion des rôles ===================
const UserRolesEditor: React.FC = () => {
  const { user, users, updateUserRole, sendPasswordReset, updateUserEmail } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [emailDraft, setEmailDraft] = useState<Record<string, string>>({});
  const [editingEmail, setEditingEmail] = useState<string | null>(null);

  const handleChange = async (id: string, role: UserRole) => {
    setBusy(id);
    const ok = await updateUserRole(id, role);
    setBusy(null);
    if (ok) toast.success('Rôle mis à jour');
    else toast.error('Modification impossible');
  };

  const handleResetPassword = async (email: string) => {
    if (!confirm(`Envoyer un email de réinitialisation à ${email} ?`)) return;
    const ok = await sendPasswordReset(email);
    if (ok) toast.success('Email de réinitialisation envoyé');
    else toast.error("Échec de l'envoi");
  };

  const handleSaveEmail = async (uid: string) => {
    const newEmail = (emailDraft[uid] || '').trim();
    if (!/^\S+@\S+\.\S+$/.test(newEmail)) return toast.error('Email invalide');
    setBusy(uid);
    const ok = await updateUserEmail(uid, newEmail);
    setBusy(null);
    if (ok) {
      toast.success('Email mis à jour');
      setEditingEmail(null);
    } else {
      toast.error('Échec — Cloud Function déployée ?');
    }
  };

  const sorted = [...users].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Utilisateurs ({sorted.length})</CardTitle>
        <p className="text-xs text-muted-foreground">
          Rôles, réinitialisation de mot de passe et modification d'email. Vous ne pouvez pas
          retirer votre propre rôle admin.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {sorted.map(u => {
          const isSelf = u.id === user?.id;
          const isEditingThis = editingEmail === u.id;
          return (
            <div key={u.id} className="rounded-md border p-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate flex items-center gap-2">
                    {u.role === 'admin' ? (
                      <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                    ) : (
                      <ShieldOff className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    {u.name}
                    {isSelf && <span className="text-xs text-muted-foreground">(vous)</span>}
                  </p>
                  {!isEditingThis && (
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  )}
                </div>
                <Select
                  value={u.role}
                  onValueChange={(v) => handleChange(u.id, v as UserRole)}
                  disabled={busy === u.id || (isSelf && u.role === 'admin')}
                >
                  <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agent">Agent</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isEditingThis && (
                <div className="flex gap-2">
                  <Input
                    type="email"
                    value={emailDraft[u.id] ?? u.email}
                    onChange={e => setEmailDraft({ ...emailDraft, [u.id]: e.target.value })}
                    placeholder="nouveau@email.fr"
                    className="h-8"
                  />
                  <Button size="sm" onClick={() => handleSaveEmail(u.id)} disabled={busy === u.id}>
                    <Save className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingEmail(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleResetPassword(u.email)}
                  className="h-8 text-xs"
                >
                  <KeyRound className="h-3 w-3" /> Reset mot de passe
                </Button>
                {!isEditingThis && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingEmail(u.id);
                      setEmailDraft({ ...emailDraft, [u.id]: u.email });
                    }}
                    className="h-8 text-xs"
                  >
                    <Mail className="h-3 w-3" /> Modifier email
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

// =================== Sous-composant : ordre des agents ===================
const AgentOrderEditor: React.FC = () => {
  const { users } = useAuth();
  const { settings, loading } = useDisplaySettings();
  const [order, setOrder] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Synchronise l'ordre local avec les utilisateurs disponibles + ordre stocké.
  useEffect(() => {
    if (loading) return;
    const sorted = applyAgentOrder(users, settings.agentOrder).map(u => u.id);
    setOrder(sorted);
    setDirty(false);
  }, [users, settings.agentOrder, loading]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const userMap = useMemo(() => new Map(users.map(u => [u.id, u])), [users]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrder(prev => {
      const oldIndex = prev.indexOf(String(active.id));
      const newIndex = prev.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const ok = await saveAgentOrder(order);
    setSaving(false);
    if (ok) {
      toast.success('Ordre des agents enregistré');
      setDirty(false);
    } else toast.error("Échec de l'enregistrement");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Ordre des agents</CardTitle>
        <p className="text-xs text-muted-foreground">
          Glissez-déposez pour réorganiser l'affichage des agents dans le planning.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={order} strategy={verticalListSortingStrategy}>
            <ul className="space-y-2">
              {order.map(id => {
                const u = userMap.get(id);
                if (!u) return null;
                return <SortableAgent key={id} id={id} name={u.name} role={u.role} />;
              })}
            </ul>
          </SortableContext>
        </DndContext>
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={!dirty || saving} size="sm">
            <Save className="h-4 w-4" />
            {saving ? 'Enregistrement…' : 'Enregistrer l\'ordre'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

const SortableAgent: React.FC<{ id: string; name: string; role: string }> = ({ id, name, role }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-md border bg-card p-3"
    >
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
        aria-label="Réorganiser"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">
        <p className="font-medium truncate">{name}</p>
      </div>
    </li>
  );
};

// =================== Sous-composant : paramètres salaire ===================
const SalaryEditor: React.FC = () => {
  const { settings, loading } = useSalarySettings();
  const [draft, setDraft] = useState<SalarySettings>(settings);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setDraft(settings); }, [settings]);

  const update = (k: keyof SalarySettings, v: number) => setDraft(d => ({ ...d, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    const ok = await saveSalarySettings(draft);
    setSaving(false);
    if (ok) toast.success('Paramètres salaire enregistrés');
    else toast.error('Échec — vérifiez vos droits');
  };

  if (loading) return <p className="text-sm text-muted-foreground">Chargement…</p>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-lg">Heures supplémentaires (cycle)</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Field label="Seuil 1 (CET, h)">
            <Input type="number" step="0.5" value={draft.threshold1} onChange={e => update('threshold1', parseFloat(e.target.value) || 0)} />
          </Field>
          <Field label="Seuil 2 (limite +25%, h)">
            <Input type="number" step="0.5" value={draft.threshold2} onChange={e => update('threshold2', parseFloat(e.target.value) || 0)} />
          </Field>
          <Field label="Taux HS tranche 1 (ex: 1.25)">
            <Input type="number" step="0.05" value={draft.overtimeRate1} onChange={e => update('overtimeRate1', parseFloat(e.target.value) || 0)} />
          </Field>
          <Field label="Taux HS tranche 2 (ex: 1.50)">
            <Input type="number" step="0.05" value={draft.overtimeRate2} onChange={e => update('overtimeRate2', parseFloat(e.target.value) || 0)} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Primes fixes (€)</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Field label="Prime habillage (1×/mois)">
            <Input type="number" step="0.01" value={draft.primeHabillage} onChange={e => update('primeHabillage', parseFloat(e.target.value) || 0)} />
          </Field>
          <Field label="Prime carburant (1×/mois)">
            <Input type="number" step="0.01" value={draft.primeCarburant} onChange={e => update('primeCarburant', parseFloat(e.target.value) || 0)} />
          </Field>
          <Field label="Prime panier (par jour)">
            <Input type="number" step="0.01" value={draft.primePanier} onChange={e => update('primePanier', parseFloat(e.target.value) || 0)} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Primes de remplacement (€)</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Field label="Remplacement semaine">
            <Input type="number" step="0.01" value={draft.remplacementSemaine} onChange={e => update('remplacementSemaine', parseFloat(e.target.value) || 0)} />
          </Field>
          <Field label="Remplacement week-end">
            <Input type="number" step="0.01" value={draft.remplacementWeekend} onChange={e => update('remplacementWeekend', parseFloat(e.target.value) || 0)} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Majorations (%)</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <Field label="Nuit (22h-06h)">
            <Input type="number" step="1" value={draft.majorationNuit} onChange={e => update('majorationNuit', parseFloat(e.target.value) || 0)} />
          </Field>
          <Field label="Dimanche">
            <Input type="number" step="1" value={draft.majorationDimanche} onChange={e => update('majorationDimanche', parseFloat(e.target.value) || 0)} />
          </Field>
          <Field label="Férié (100 = ×2)">
            <Input type="number" step="1" value={draft.majorationFerie} onChange={e => update('majorationFerie', parseFloat(e.target.value) || 0)} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Conversion Brut → Net</CardTitle>
          <p className="text-xs text-muted-foreground">Coefficient appliqué au brut pour estimer le net (ex: 0.78 = 78%).</p>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Field label="Coefficient net (0 à 1)">
            <Input type="number" step="0.01" min="0" max="1" value={draft.netCoefficient} onChange={e => update('netCoefficient', parseFloat(e.target.value) || 0)} />
          </Field>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4" /> {saving ? 'Enregistrement…' : 'Enregistrer les paramètres'}
        </Button>
      </div>
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1">
    <label className="text-xs font-medium text-muted-foreground">{label}</label>
    {children}
  </div>
);

export default MaintenancePage;
