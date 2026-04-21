import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import { useShifts, shiftStyle } from '@/hooks/useShifts';
import { setSchedule, removeSchedule, isMonthLocked } from '@/lib/scheduleStore';
import { useMonthSchedules } from '@/hooks/useMonthSchedules';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Trash2, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const SaisiePage = () => {
  const { user, users, isAdmin } = useAuth();
  const { shifts, byCode } = useShifts();
  const [selectedUserId, setSelectedUserId] = useState(user?.id || '');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedShift, setSelectedShift] = useState('');

  const targetUserId = isAdmin ? selectedUserId : user?.id || '';

  const now = new Date();
  const viewYear = selectedDate?.getFullYear() || now.getFullYear();
  const viewMonth = selectedDate?.getMonth() ?? now.getMonth();
  const locked = isMonthLocked(viewYear, viewMonth);

  // Realtime subscription — single listener per month, no polling
  const { entries: monthEntries } = useMonthSchedules(viewYear, viewMonth);
  const entries = useMemo(
    () => monthEntries.filter(e => e.userId === targetUserId),
    [monthEntries, targetUserId]
  );

  const handleAdd = async () => {
    if (!selectedDate || !selectedShift || !targetUserId) return;
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const ok = await setSchedule(targetUserId, dateStr, selectedShift);
    if (ok) {
      toast.success(`Horaire ${selectedShift} ajouté pour le ${format(selectedDate, 'dd/MM/yyyy')}`);
      setSelectedShift('');
    } else {
      toast.error('Impossible de modifier ce mois (verrouillé ou erreur réseau)');
    }
  };

  const handleRemove = async (date: string) => {
    const ok = await removeSchedule(targetUserId, date);
    if (ok) toast.success('Horaire supprimé');
    else toast.error('Suppression impossible');
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold">Saisie des horaires</h1>
          <p className="text-sm text-muted-foreground">
            {locked ? (
              <span className="flex items-center gap-1 text-destructive"><Lock className="h-3 w-3" /> Ce mois est en lecture seule</span>
            ) : 'Sélectionnez une date et un code horaire'}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Nouvel horaire</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isAdmin && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Agent</label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger><SelectValue placeholder="Choisir un agent" /></SelectTrigger>
                  <SelectContent>
                    {users.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.name} ({u.role})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left", !selectedDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, 'PPP', { locale: fr }) : 'Choisir une date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    locale={fr}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Code horaire</label>
              <Select value={selectedShift} onValueChange={setSelectedShift}>
                <SelectTrigger><SelectValue placeholder="Choisir un horaire" /></SelectTrigger>
                <SelectContent>
                  {shifts.map(s => (
                    <SelectItem key={s.code} value={s.code}>
                      <span className="flex items-center gap-2">
                        <span className="inline-block w-3 h-3 rounded-full border" style={{ backgroundColor: s.color }} />
                        {s.code} — {s.label} ({s.hours}h{s.time ? `, ${s.time}` : ''})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleAdd} disabled={!selectedDate || !selectedShift || !targetUserId || locked} className="w-full">
              Enregistrer
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Horaires du mois ({format(new Date(viewYear, viewMonth), 'MMMM yyyy', { locale: fr })})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {entries.length === 0 ? (
              <p className="text-muted-foreground text-sm">Aucun horaire saisi</p>
            ) : (
              <div className="space-y-2">
                {entries
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map(entry => {
                    const shift = byCode.get(entry.shiftCode);
                    return (
                      <div key={entry.date} className="flex items-center justify-between rounded-md border p-3">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium min-w-[80px]">
                            {format(new Date(entry.date + 'T00:00'), 'dd/MM/yyyy')}
                          </span>
                          <span className="px-2 py-0.5 rounded text-xs font-semibold border" style={shiftStyle(shift?.color)}>
                            {entry.shiftCode}
                          </span>
                          <span className="text-sm text-muted-foreground">{shift?.label} — {shift?.hours}h</span>
                        </div>
                        {!locked && (
                          <Button variant="ghost" size="icon" onClick={() => handleRemove(entry.date)} className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default SaisiePage;
