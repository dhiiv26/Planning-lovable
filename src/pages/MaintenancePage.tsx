import React, { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, Save, Pencil, X, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import { useShifts, shiftStyle } from '@/hooks/useShifts';
import { upsertShift, deleteShift, defaultColorFor, DynamicShift } from '@/lib/shiftsStore';
import { useDisplaySettings } from '@/hooks/useDisplaySettings';
import { applyAgentOrder, saveAgentOrder } from '@/lib/displayStore';
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
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="shifts">Horaires</TabsTrigger>
            <TabsTrigger value="display">Affichage</TabsTrigger>
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
        </Tabs>
      </div>
    </AppLayout>
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
        <p className="text-xs text-muted-foreground capitalize">{role}</p>
      </div>
    </li>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1">
    <label className="text-xs font-medium text-muted-foreground">{label}</label>
    {children}
  </div>
);

export default MaintenancePage;
