import React, { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import { isMonthLocked } from '@/lib/scheduleStore';
import { useMonthSchedules } from '@/hooks/useMonthSchedules';
import { getShiftByCode, getShiftClass, SHIFT_CODES } from '@/config/shiftCodes';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react';

const PlanningPage = () => {
  const { users, user, isAdmin } = useAuth();
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());

  const locked = isMonthLocked(year, month);
  const visibleUsers = isAdmin ? users : users.filter(u => u.id === user?.id);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const { entries: schedules } = useMonthSchedules(year, month);

  const getEntry = (userId: string, day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return schedules.find(e => e.userId === userId && e.date === dateStr);
  };

  const calcWeeklyHours = (userId: string) => {
    const userSchedules = schedules.filter(s => s.userId === userId);
    const weeks: Record<number, number> = {};
    userSchedules.forEach(s => {
      const d = new Date(s.date);
      const weekNum = getISOWeek(d);
      const shift = getShiftByCode(s.shiftCode);
      weeks[weekNum] = (weeks[weekNum] || 0) + (shift?.hours || 0);
    });
    return weeks;
  };

  const totalHours = (userId: string) =>
    schedules
      .filter(s => s.userId === userId)
      .reduce((sum, s) => sum + (getShiftByCode(s.shiftCode)?.hours || 0), 0);

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
            <Button variant="outline" size="icon" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="font-semibold min-w-[160px] text-center">{monthNames[month]} {year}</span>
            <Button variant="outline" size="icon" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          {SHIFT_CODES.map(s => (
            <span key={s.code} className={`px-2 py-1 rounded border ${getShiftClass(s.code)}`}>
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
                  return (
                    <th key={d} className={`px-1 py-2 text-center min-w-[36px] ${isWeekend ? 'bg-muted/50' : ''}`}>
                      <div className="text-muted-foreground">{dayNames[dow]}</div>
                      <div>{d}</div>
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
                    <span className="block text-muted-foreground text-[10px] capitalize">{u.role}</span>
                  </td>
                  {days.map(d => {
                    const entry = getEntry(u.id, d);
                    const dow = new Date(year, month, d).getDay();
                    const isWeekend = dow === 0 || dow === 6;
                    return (
                      <td key={d} className={`px-1 py-1 text-center ${isWeekend ? 'bg-muted/30' : ''}`}>
                        {entry && (
                          <span className={`inline-block px-1 py-0.5 rounded text-[10px] font-semibold border ${getShiftClass(entry.shiftCode)}`}>
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
