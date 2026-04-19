import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { addLog } from '@/lib/logger';
import logo from '@/assets/logo.jpeg';

const LoginPage = () => {
  const { user, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [resetting, setResetting] = useState(false);

  if (user) return <Navigate to="/planning" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    const ok = await login(email, password);
    if (!ok) setError('Email ou mot de passe incorrect');
  };

  const handleReset = async () => {
    setError('');
    setInfo('');
    const target = email.trim();
    if (!target) {
      setError('Saisissez votre email puis cliquez à nouveau sur « Mot de passe oublié ? »');
      return;
    }
    setResetting(true);
    try {
      await sendPasswordResetEmail(auth, target);
      setInfo('Un email de réinitialisation a été envoyé');
      addLog('info', `Email de réinitialisation envoyé à ${target}`);
    } catch (e: any) {
      const code = e?.code || '';
      let msg = 'Erreur lors de l\'envoi de l\'email';
      if (code === 'auth/invalid-email') msg = 'Adresse email invalide';
      else if (code === 'auth/user-not-found') msg = 'Aucun compte associé à cet email';
      else if (code === 'auth/network-request-failed') msg = 'Erreur réseau, vérifiez votre connexion';
      else if (code === 'auth/too-many-requests') msg = 'Trop de tentatives, réessayez plus tard';
      setError(msg);
      addLog('error', `Réinitialisation échouée pour ${target}: ${code || e?.message}`);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-3">
          <img
            src={logo}
            alt="CDPNT"
            className="mx-auto h-24 w-24 rounded-xl object-contain shadow-sm"
          />
          <CardTitle className="text-2xl">Planning Sécurité</CardTitle>
          <p className="text-sm text-muted-foreground">Connectez-vous pour accéder au planning</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {info && (
              <div className="flex items-center gap-2 rounded-md bg-primary/10 p-3 text-sm text-primary">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{info}</span>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="email@securite.fr"
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Mot de passe</label>
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={resetting}
                  className="text-xs text-primary hover:underline disabled:opacity-50"
                >
                  {resetting ? (
                    <span className="inline-flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> Envoi…
                    </span>
                  ) : (
                    'Mot de passe oublié ?'
                  )}
                </button>
              </div>
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full">Se connecter</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginPage;
