import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import { useShifts, shiftStyle } from '@/hooks/useShifts';
import { setSchedulesBulk, removeSchedule, isMonthLocked } from '@/lib/scheduleStore';
import { useMonthSchedules } from '@/hooks/useMonthSchedules';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Trash2, Lock, CalendarRange, X } from 'lucide-react';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';

const toKey = (d: Date) => format(d, 'yyyy-MM-dd');

const SaisiePage = () => {
  const { user, users, isAdmin } = useAuth();
  const { shifts, byCode } = useShifts();
  const [selectedUserId, setSelectedUserId] = useState(user?.id || '');
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [selectedShift, setSelectedShift] = useState('');
  const [confirmConflicts, setConfirmConflicts] = useState<string[] | null>(null);
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());

  const targetUserId = isAdmin ? selectedUserId : user?.id || '';

  const viewYear = calendarMonth.getFullYear();
  const viewMonth = calendarMonth.getMonth();
  const locked = isMonthLocked(viewYear, viewMonth);

  // Realtime subscription — single listener per month
  const { entries: monthEntries } = useMonthSchedules(viewYear, viewMonth);
  const entries = useMemo(
    () => monthEntries.filter(e => e.userId === targetUserId),
    [monthEntries, targetUserId]
  );
  const entriesByDate = useMemo(() => {
    const m = new Map<string, string>();
    entries.forEach(e => m.set(e.date, e.shiftCode));
    return m;
  }, [entries]);

  const sortedSelection = useMemo(
    () => [...selectedDates].sort((a, b) => a.getTime() - b.getTime()),
    [selectedDates]
  );

  const clearSelection = () => setSelectedDates([]);

  const selectCurrentWeek = () => {
    const ref = selectedDates[selectedDates.length - 1] || calendarMonth || new Date();
    const monday = startOfWeek(ref, { weekStartsOn: 1 });
    const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
    setSelectedDates(week);
  };

  const performApply = async (dates: string[]) => {
    if (!targetUserId || !selectedShift || dates.length === 0) return;
    const { ok, failed } = await setSchedulesBulk(targetUserId, dates, selectedShift);
    if (failed === 0) toast.success(`${ok} jour${ok > 1 ? 's' : ''} mis à jour`);
    else toast.error(`${failed} échec(s) — mois verrouillé ou erreur réseau`);
    if (ok > 0) {
      setSelectedDates([]);
      setSelectedShift('');
    }
  };

  const handleApply = async () => {
    if (!selectedShift || sortedSelection.length === 0 || !targetUserId) return;
    const dateStrs = sortedSelection.map(toKey);
    const conflicts = dateStrs.filter(d => {
      const existing = entriesByDate.get(d);
      return existing && existing !== selectedShift;
    });
    if (conflicts.length > 0) {
      setConfirmConflicts(dateStrs);
      return;
    }
    await performApply(dateStrs);
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
            ) : 'Sélectionnez un ou plusieurs jours, puis appliquez un horaire'}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sélection des jours</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isAdmin && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Agent</label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger><SelectValue placeholder="Choisir un agent" /></SelectTrigger>
                  <SelectContent>
                    {users.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex justify-center">
              <Calendar
                mode="multiple"
                selected={selectedDates}
                onSelect={(dates) => setSelectedDates(dates || [])}
                month={calendarMonth}
                onMonthChange={setCalendarMonth}
                locale={fr}
                weekStartsOn={1}
                className="p-3 pointer-events-auto rounded-md border"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={selectCurrentWeek}>
                <CalendarRange className="h-4 w-4" /> Sélectionner la semaine
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearSelection}
                disabled={selectedDates.length === 0}
              >
                <X className="h-4 w-4" /> Effacer
              </Button>
            </div>

            <div className="rounded-md border bg-muted/30 p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                Jours sélectionnés ({sortedSelection.length})
              </p>
              {sortedSelection.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun jour sélectionné</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {sortedSelection.map(d => {
                    const k = toKey(d);
                    const existing = entriesByDate.get(k);
                    return (
                      <span
                        key={k}
                        className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs"
                      >
                        {format(d, 'dd/MM', { locale: fr })}
                        {existing && (
                          <span
                            className="ml-1 rounded px-1 text-[10px] font-semibold border"
                            style={shiftStyle(byCode.get(existing)?.color)}
                          >
                            {existing}
                          </span>
                        )}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Code horaire à appliquer</label>
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

            <Button
              onClick={handleApply}
              disabled={!selectedShift || sortedSelection.length === 0 || !targetUserId || locked}
              className="w-full"
            >
              Appliquer à {sortedSelection.length} jour{sortedSelection.length > 1 ? 's' : ''}
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

      <AlertDialog open={!!confirmConflicts} onOpenChange={(o) => { if (!o) setConfirmConflicts(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remplacer les horaires existants ?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmConflicts && (
                <>
                  {confirmConflicts.filter(d => {
                    const existing = entriesByDate.get(d);
                    return existing && existing !== selectedShift;
                  }).length} jour(s) ont déjà un horaire différent. Voulez-vous les remplacer par <strong>{selectedShift}</strong> ?
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (confirmConflicts) {
                  const dates = confirmConflicts;
                  setConfirmConflicts(null);
                  await performApply(dates);
                }
              }}
            >
              Remplacer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default SaisiePage;
