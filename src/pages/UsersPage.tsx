import React, { useState } from 'react';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

const UsersPage = () => {
  const { isAdmin, users, addUser, removeUser } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('agent');

  if (!isAdmin) return <Navigate to="/planning" replace />;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await addUser(email, name, password, role);
    if (ok) {
      toast.success(`${name} ajouté`);
      setName(''); setEmail(''); setPassword(''); setRole('agent');
    } else {
      toast.error('Ajout impossible (email déjà utilisé ou mot de passe trop faible)');
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-2xl">
        <h1 className="text-2xl font-bold">Gestion des utilisateurs</h1>

        <Card>
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><UserPlus className="h-5 w-5" /> Ajouter un utilisateur</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nom</label>
                  <Input value={name} onChange={e => setName(e.target.value)} required placeholder="Jean Dupont" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="jean@securite.fr" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Mot de passe</label>
                  <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Rôle</label>
                  <Select value={role} onValueChange={v => setRole(v as UserRole)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="agent">Agent</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button type="submit">Ajouter</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Utilisateurs ({users.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {users.map(u => (
              <div key={u.id} className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="font-medium">{u.name}</p>
                  <p className="text-sm text-muted-foreground">{u.email}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={async () => {
                  const ok = await removeUser(u.id);
                  if (ok) toast.success('Utilisateur supprimé');
                  else toast.error('Impossible de supprimer');
                }} className="text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default UsersPage;
