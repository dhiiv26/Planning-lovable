import React, { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import { isMonthLocked } from '@/lib/scheduleStore';
import { useMonthSchedules } from '@/hooks/useMonthSchedules';
import { useShifts, shiftStyle } from '@/hooks/useShifts';
import { useDisplaySettings } from '@/hooks/useDisplaySettings';
import { applyAgentOrder } from '@/lib/displayStore';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Lock, Users, FileDown } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { exportPlanningPDF } from '@/lib/planningPdf';
import { fetchUserSchedulesRange } from '@/lib/scheduleQueries';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';

type ViewMode = 'all' | 'mine' | 'today';

const PlanningPage = () => {
  const { users, user, isAdmin } = useAuth();
  const { shifts, byCode } = useShifts();
  const { settings } = useDisplaySettings();
  const today0 = new Date();
  const [year, setYear] = useState(today0.getFullYear());
  const [month, setMonth] = useState(today0.getMonth());
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [selectedDay, setSelectedDay] = useState<number>(today0.getDate());
  const [withMe, setWithMe] = useState(false);

  const locked = isMonthLocked(year, month);
  const orderedUsers = useMemo(
    () => applyAgentOrder(users, settings.agentOrder),
    [users, settings.agentOrder]
  );

  const today = new Date();
  const todayDay =
    today.getFullYear() === year && today.getMonth() === month ? today.getDate() : -1;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const safeSelectedDay = Math.min(Math.max(1, selectedDay), daysInMonth);

  const { entries: schedules } = useMonthSchedules(year, month);

  const getEntry = (userId: string, day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return schedules.find(e => e.userId === userId && e.date === dateStr);
  };

  const selectedDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(safeSelectedDay).padStart(2, '0')}`;

  const visibleUsers = useMemo(() => {
    if (withMe) {
      if (!user) return [];
      const myEntry = schedules.find(s => s.userId === user.id && s.date === selectedDateStr);
      if (!myEntry) return [];
      const coworkerIds = new Set(
        schedules.filter(s => s.date === selectedDateStr).map(s => s.userId)
      );
      return orderedUsers.filter(u => coworkerIds.has(u.id));
    }
    if (viewMode === 'mine') {
      return user ? orderedUsers.filter(u => u.id === user.id) : [];
    }
    if (viewMode === 'today') {
      const workingIds = new Set(
        schedules.filter(s => s.date === selectedDateStr).map(s => s.userId)
      );
      return orderedUsers.filter(u => workingIds.has(u.id));
    }
    return orderedUsers;
  }, [orderedUsers, viewMode, withMe, user, schedules, selectedDateStr]);

  const withMeNoVacation =
    withMe && user && !schedules.find(s => s.userId === user.id && s.date === selectedDateStr);

  const calcWeeklyHours = (userId: string) => {
    const userSchedules = schedules.filter(s => s.userId === userId);
    const weeks: Record<number, number> = {};
    userSchedules.forEach(s => {
      const d = new Date(s.date);
      const weekNum = getISOWeek(d);
      const shift = byCode.get(s.shiftCode);
      weeks[weekNum] = (weeks[weekNum] || 0) + (shift?.hours || 0);
    });
    return weeks;
  };

  const totalHours = (userId: string) =>
    schedules
      .filter(s => s.userId === userId)
      .reduce((sum, s) => sum + (byCode.get(s.shiftCode)?.hours || 0), 0);

  const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  const dayNames = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const handleExport = async (which: 'current' | 'previous') => {
    const now = new Date();
    let y = now.getFullYear();
    let m = now.getMonth();
    if (which === 'previous') {
      if (m === 0) { m = 11; y -= 1; } else m -= 1;
    }
    const start = `${y}-${String(m + 1).padStart(2, '0')}-01`;
    const end = `${y}-${String(m + 1).padStart(2, '0')}-${String(new Date(y, m + 1, 0).getDate()).padStart(2, '0')}`;
    try {
      const snap = await getDocs(query(
        collection(db, 'schedules'),
        where('date', '>=', start),
        where('date', '<=', end),
      ));
      const monthEntries = snap.docs.map(d => d.data() as any);
      exportPlanningPDF({
        year: y, month: m,
        users: orderedUsers,
        entries: monthEntries,
        shiftsByCode: byCode,
      });
      toast.success('PDF généré');
    } catch (e: any) {
      toast.error(`Échec export : ${e?.message || 'erreur'}`);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Planning</h1>
            <p className="text-sm text-muted-foreground">
              {locked && <span className="inline-flex items-center gap-1 text-muted-foreground"><Lock className="h-3 w-3" /> Lecture seule</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <FileDown className="h-4 w-4" /> PDF
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport('current')}>
                  Mois en cours
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('previous')}>
                  Mois précédent
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="icon" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="font-semibold min-w-[160px] text-center">{monthNames[month]} {year}</span>
            <Button variant="outline" size="icon" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <Tabs
            value={viewMode}
            onValueChange={(v) => { setViewMode(v as ViewMode); setWithMe(false); }}
          >
            <TabsList>
              <TabsTrigger value="all">Planning général</TabsTrigger>
              <TabsTrigger value="mine" disabled={!user}>Mes vacations</TabsTrigger>
              <TabsTrigger value="today">Agents du jour</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button
            variant={withMe ? 'default' : 'secondary'}
            size="sm"
            onClick={() => setWithMe(v => !v)}
            disabled={!user}
            className="gap-2"
          >
            <Users className="h-4 w-4" />
            {withMe ? 'Affichage : avec moi' : 'Qui bosse avec moi ?'}
          </Button>
        </div>

        {(viewMode === 'today' || withMe) && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Date :</span>
            <Button variant="outline" size="sm" onClick={() => setSelectedDay(d => Math.max(1, d - 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-semibold min-w-[40px] text-center">{safeSelectedDay}</span>
            <Button variant="outline" size="sm" onClick={() => setSelectedDay(d => Math.min(daysInMonth, d + 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="text-muted-foreground">{monthNames[month]} {year}</span>
          </div>
        )}

        {withMeNoVacation && (
          <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
            Aucune vacation pour vous le {String(safeSelectedDay).padStart(2, '0')}/{String(month + 1).padStart(2, '0')}/{year}
          </div>
        )}

        <div className="flex flex-wrap gap-2 text-xs">
          {shifts.map(s => (
            <span key={s.code} className="px-2 py-1 rounded border" style={shiftStyle(s.color)}>
              {s.code} = {s.label} ({s.hours}h)
            </span>
          ))}
        </div>

        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                <th className="sticky left-0 bg-card z-10 px-3 py-2 text-left font-medium min-w-[120px]">Agent</th>
                {days.map(d => {
                  const dow = new Date(year, month, d).getDay();
                  const isWeekend = dow === 0 || dow === 6;
                  const isToday = d === todayDay;
                  const isSelected = (viewMode === 'today' || withMe) && d === safeSelectedDay;
                  return (
                    <th
                      key={d}
                      onClick={() => setSelectedDay(d)}
                      className={`px-1 py-2 text-center min-w-[36px] cursor-pointer select-none ${
                        isSelected
                          ? 'bg-primary/15 ring-1 ring-inset ring-primary'
                          : isToday
                          ? 'bg-muted ring-1 ring-inset ring-border'
                          : isWeekend
                          ? 'bg-muted/50'
                          : ''
                      }`}
                    >
                      <div className="text-muted-foreground">{dayNames[dow]}</div>
                      <div className={isToday || isSelected ? 'font-bold text-foreground' : ''}>{d}</div>
                    </th>
                  );
                })}
                <th className="px-3 py-2 text-center font-medium min-w-[60px]">Total</th>
              </tr>
            </thead>
            <tbody>
              {visibleUsers.map(u => (
                <tr key={u.id} className="border-b hover:bg-muted/30">
                  <td className="sticky left-0 bg-card z-10 px-3 py-2 font-medium whitespace-nowrap">
                    {u.name}
                  </td>
                  {days.map(d => {
                    const entry = getEntry(u.id, d);
                    const dow = new Date(year, month, d).getDay();
                    const isWeekend = dow === 0 || dow === 6;
                    const isToday = d === todayDay;
                    const isSelected = (viewMode === 'today' || withMe) && d === safeSelectedDay;
                    return (
                      <td
                        key={d}
                        className={`px-1 py-1 text-center ${
                          isSelected ? 'bg-primary/10' : isToday ? 'bg-muted/60' : isWeekend ? 'bg-muted/30' : ''
                        }`}
                      >
                        {entry && (
                          <span className="inline-block px-1 py-0.5 rounded text-[10px] font-semibold border" style={shiftStyle(byCode.get(entry.shiftCode)?.color)}>
                            {entry.shiftCode}
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-center font-bold">{totalHours(u.id)}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Heures par semaine</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {visibleUsers.map(u => {
              const weeks = calcWeeklyHours(u.id);
              return (
                <div key={u.id} className="rounded-lg border bg-card p-3">
                  <p className="font-medium mb-2">{u.name}</p>
                  <div className="space-y-1 text-sm">
                    {Object.entries(weeks).sort(([a], [b]) => Number(a) - Number(b)).map(([week, hours]) => (
                      <div key={week} className="flex justify-between">
                        <span className="text-muted-foreground">Semaine {week}</span>
                        <span className="font-medium">{hours}h</span>
                      </div>
                    ))}
                    {Object.keys(weeks).length === 0 && (
                      <p className="text-muted-foreground text-xs">Aucun horaire</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

function getISOWeek(d: Date): number {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

export default PlanningPage;
