import React, { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useShifts } from '@/hooks/useShifts';
import { useMonthSchedules } from '@/hooks/useMonthSchedules';
import { useSalarySettings } from '@/hooks/useSalarySettings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Save, Plus, Trash2, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { getUserHourlyRate, setUserHourlyRate } from '@/lib/salaryStore';
import { fetchUserSchedulesRange } from '@/lib/scheduleQueries';
import { findCycleForDate } from '@/lib/cycles';
import { computeSalary, AbsenceOverride, ExtraReplacement } from '@/lib/salaryEngine';
import type { ScheduleEntry } from '@/lib/scheduleStore';

const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

const fmt = (n: number) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

const SalaryPage: React.FC = () => {
  const { user } = useAuth();
  const { byCode } = useShifts();
  const { settings } = useSalarySettings();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [hourlyRate, setHourlyRateState] = useState<number>(0);
  const [savingRate, setSavingRate] = useState(false);
  const [cycleEntries, setCycleEntries] = useState<ScheduleEntry[]>([]);
  const [absences, setAbsences] = useState<AbsenceOverride[]>([]);
  const [replacements, setReplacements] = useState<ExtraReplacement[]>([]);

  const { entries: monthEntries } = useMonthSchedules(year, month);
  const myMonthEntries = useMemo(
    () => monthEntries.filter(e => e.userId === user?.id),
    [monthEntries, user?.id]
  );

  // Charge le taux horaire de l'utilisateur
  useEffect(() => {
    if (!user) return;
    getUserHourlyRate(user.id).then(setHourlyRateState);
  }, [user?.id]);

  // Détecte automatiquement les ABS planifiées et les ajoute (8h par défaut, modifiable)
  useEffect(() => {
    setAbsences(prev => {
      const fromSchedule = myMonthEntries
        .filter(e => e.shiftCode === 'ABS')
        .map<AbsenceOverride>(e => {
          const existing = prev.find(a => a.date === e.date);
          return { date: e.date, hours: existing?.hours ?? 8 };
        });
      return fromSchedule;
    });
  }, [myMonthEntries]);

  // Charge les schedules du cycle qui contient ce mois
  useEffect(() => {
    if (!user) return;
    const refDate = `${year}-${String(month + 1).padStart(2, '0')}-15`;
    const cycle = findCycleForDate(refDate);
    if (!cycle) {
      setCycleEntries([]);
      return;
    }
    fetchUserSchedulesRange(user.id, cycle.start, cycle.end).then(setCycleEntries);
  }, [user?.id, year, month, monthEntries]);

  const saveRate = async () => {
    if (!user) return;
    setSavingRate(true);
    const ok = await setUserHourlyRate(user.id, hourlyRate);
    setSavingRate(false);
    if (ok) toast.success('Taux horaire enregistré');
    else toast.error('Échec — vérifiez vos droits');
  };

  const breakdown = useMemo(() => {
    if (!user) return null;
    return computeSalary({
      userId: user.id,
      hourlyRate,
      monthEntries: myMonthEntries,
      cycleEntries,
      shiftsByCode: byCode,
      settings,
      year,
      month,
      absences,
      replacements,
      holidays: [],
    });
  }, [user, hourlyRate, myMonthEntries, cycleEntries, byCode, settings, year, month, absences, replacements]);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1);
  };

  const updateAbsence = (date: string, hours: 8 | 12) => {
    setAbsences(prev => prev.map(a => a.date === date ? { ...a, hours } : a));
  };

  const addReplacement = () =>
    setReplacements(prev => [...prev, { type: 'semaine', qty: 1 }]);
  const updateReplacement = (i: number, patch: Partial<ExtraReplacement>) =>
    setReplacements(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  const removeReplacement = (i: number) =>
    setReplacements(prev => prev.filter((_, idx) => idx !== i));

  return (
    <AppLayout>
      <div className="space-y-4 max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Wallet className="h-6 w-6" /> Estimation salaire
            </h1>
            <p className="text-sm text-muted-foreground">Simulation basée sur votre planning réel</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="font-semibold min-w-[140px] text-center">{MONTHS[month]} {year}</span>
            <Button variant="outline" size="icon" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-lg">Mon taux horaire</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Taux horaire brut (€)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={hourlyRate || ''}
                  onChange={e => setHourlyRateState(parseFloat(e.target.value) || 0)}
                  placeholder="ex: 12.50"
                />
              </div>
              <Button onClick={saveRate} disabled={savingRate}>
                <Save className="h-4 w-4" /> {savingRate ? '…' : 'Enregistrer'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {absences.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Absences (ABS) du mois</CardTitle>
              <p className="text-xs text-muted-foreground">Choisissez le volume horaire à déduire pour chaque absence.</p>
            </CardHeader>
            <CardContent className="space-y-2">
              {absences.map(a => (
                <div key={a.date} className="flex items-center justify-between rounded-md border p-2">
                  <span className="text-sm">{new Date(a.date + 'T00:00').toLocaleDateString('fr-FR')}</span>
                  <Select value={String(a.hours)} onValueChange={v => updateAbsence(a.date, Number(v) as 8 | 12)}>
                    <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="8">8h</SelectItem>
                      <SelectItem value="12">12h</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Primes de remplacement</CardTitle>
              <Button size="sm" variant="outline" onClick={addReplacement}>
                <Plus className="h-4 w-4" /> Ajouter
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {replacements.length === 0 && (
              <p className="text-sm text-muted-foreground">Aucune prime de remplacement</p>
            )}
            {replacements.map((r, i) => (
              <div key={i} className="flex items-center gap-2 rounded-md border p-2">
                <Select value={r.type} onValueChange={v => updateReplacement(i, { type: v as any })}>
                  <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="semaine">Semaine ({fmt(settings.remplacementSemaine)})</SelectItem>
                    <SelectItem value="weekend">Week-end ({fmt(settings.remplacementWeekend)})</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min="1"
                  value={r.qty}
                  onChange={e => updateReplacement(i, { qty: parseInt(e.target.value) || 0 })}
                  className="w-20"
                />
                <Button variant="ghost" size="icon" onClick={() => removeReplacement(i)} className="text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {breakdown && (
          <Card>
            <CardHeader><CardTitle className="text-lg">Détail du salaire</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <Row label={`Salaire de base (${hourlyRate}€ × 151.67h)`} value={fmt(breakdown.baseSalary)} />

              {breakdown.cycleIndex !== null && (
                <div className="rounded-md bg-muted/40 p-2 my-2 space-y-1">
                  <p className="text-xs font-semibold">Cycle {breakdown.cycleIndex} — {breakdown.cycleHours}h / base {breakdown.cycleBase}h</p>
                  <Row sub label={`CET (non payé, ${breakdown.cetHours}h)`} value="—" />
                  <Row sub label={`HS +${(settings.overtimeRate1 - 1) * 100}% (${breakdown.paidOvertime1}h)`} value={fmt(breakdown.amountOvertime1)} />
                  <Row sub label={`HS +${(settings.overtimeRate2 - 1) * 100}% (${breakdown.paidOvertime2}h)`} value={fmt(breakdown.amountOvertime2)} />
                </div>
              )}

              <Row label={`Majoration nuit (${breakdown.nightHours}h × ${settings.majorationNuit}%)`} value={fmt(breakdown.amountNight)} />
              <Row label={`Majoration dimanche (${breakdown.sundayHours}h × ${settings.majorationDimanche}%)`} value={fmt(breakdown.amountSunday)} />
              <Row label={`Majoration férié (${breakdown.holidayHours}h)`} value={fmt(breakdown.amountHoliday)} />

              <div className="h-px bg-border my-2" />

              <Row label="Prime habillage" value={fmt(breakdown.primeHabillage)} />
              <Row label="Prime carburant" value={fmt(breakdown.primeCarburant)} />
              <Row label={`Prime panier (${breakdown.workedDaysCount} jours)`} value={fmt(breakdown.primePanier)} />
              <Row label="Primes remplacement" value={fmt(breakdown.primeRemplacement)} />

              {breakdown.absenceHours > 0 && (
                <Row label={`Absences (${breakdown.absenceHours}h déduites)`} value={'– ' + fmt(breakdown.absenceDeduction)} negative />
              )}

              <div className="h-px bg-border my-2" />

              <div className="flex items-center justify-between pt-2">
                <span className="text-base font-bold">SALAIRE BRUT</span>
                <span className="text-xl font-bold text-primary">{fmt(breakdown.total)}</span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-sm font-semibold text-muted-foreground">
                  Salaire net estimé ({Math.round((settings.netCoefficient || 0) * 100)}%)
                </span>
                <span className="text-lg font-bold text-foreground">
                  {fmt(+(breakdown.total * (settings.netCoefficient || 0)).toFixed(2))}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        <p className="text-xs text-muted-foreground italic">
          Estimation indicative — ne remplace pas le bulletin de paie officiel.
        </p>
      </div>
    </AppLayout>
  );
};

const Row: React.FC<{ label: string; value: string; sub?: boolean; negative?: boolean }> = ({ label, value, sub, negative }) => (
  <div className={`flex justify-between ${sub ? 'pl-3 text-xs' : ''}`}>
    <span className={sub ? 'text-muted-foreground' : ''}>{label}</span>
    <span className={`font-medium ${negative ? 'text-destructive' : ''}`}>{value}</span>
  </div>
);

export default SalaryPage;
