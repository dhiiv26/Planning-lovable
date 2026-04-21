import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, Users, Activity, LogOut, Menu, X, Wrench } from 'lucide-react';
import { useState } from 'react';
import logo from '@/assets/logo.jpeg';

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const links = [
    { to: '/planning', label: 'Planning', icon: Calendar },
    { to: '/saisie', label: 'Saisie', icon: Clock },
    ...(isAdmin ? [{ to: '/utilisateurs', label: 'Utilisateurs', icon: Users }] : []),
    ...(isAdmin ? [{ to: '/maintenance', label: 'Maintenance', icon: Wrench }] : []),
    { to: '/diagnostic', label: 'Diagnostic', icon: Activity },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card">
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <button className="md:hidden" onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <Link to="/planning" className="flex items-center gap-2 font-semibold">
              <img
                src={logo}
                alt="CDPNT"
                className="h-9 w-9 rounded-md object-contain bg-background border"
                width={36}
                height={36}
              />
              <span className="hidden sm:inline">CDPNT Planning</span>
            </Link>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {links.map(link => (
              <Link key={link.to} to={link.to}>
                <Button
                  variant={location.pathname === link.to ? 'secondary' : 'ghost'}
                  size="sm"
                  className="gap-2"
                >
                  <link.icon className="h-4 w-4" />
                  {link.label}
                </Button>
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium leading-none">{user?.name}</p>
              <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Mobile nav */}
        {menuOpen && (
          <nav className="md:hidden border-t p-2 space-y-1">
            {links.map(link => (
              <Link key={link.to} to={link.to} onClick={() => setMenuOpen(false)}>
                <Button
                  variant={location.pathname === link.to ? 'secondary' : 'ghost'}
                  size="sm"
                  className="w-full justify-start gap-2"
                >
                  <link.icon className="h-4 w-4" />
                  {link.label}
                </Button>
              </Link>
            ))}
          </nav>
        )}
      </header>

      {/* Content */}
      <main className="flex-1 p-4 md:p-6 max-w-7xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
};

export default AppLayout;
