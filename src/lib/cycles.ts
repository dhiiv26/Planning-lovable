// Cycles de travail définis par l'employeur (28 jours).
// Base mensuelle 151.67h => base journalière = 151.67 / 30 ≈ 5.0557h
// Base cycle (28 jours) = 28 * (151.67 / 30) ≈ 141.56h
export interface WorkCycle {
  index: number;
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD inclusive
}

export const WORK_CYCLES: WorkCycle[] = [
  { index: 1,  start: '2025-01-29', end: '2026-01-25' }, // brouillon: cycle long initial
  { index: 2,  start: '2026-01-26', end: '2026-02-22' },
  { index: 3,  start: '2026-02-23', end: '2026-03-22' },
  { index: 4,  start: '2026-03-23', end: '2026-04-19' },
  { index: 5,  start: '2026-04-20', end: '2026-05-17' },
  { index: 6,  start: '2026-05-18', end: '2026-06-14' },
  { index: 7,  start: '2026-06-15', end: '2026-07-12' },
  { index: 8,  start: '2026-07-13', end: '2026-08-09' },
  { index: 9,  start: '2026-08-10', end: '2026-09-06' },
  { index: 10, start: '2026-09-07', end: '2026-10-04' },
  { index: 11, start: '2026-10-05', end: '2026-11-01' },
  { index: 12, start: '2026-11-02', end: '2026-11-29' },
  { index: 13, start: '2026-11-30', end: '2026-12-27' },
];

const MONTHLY_BASE = 151.67;
const DAILY_BASE = MONTHLY_BASE / 30;

export function findCycleForDate(date: string): WorkCycle | undefined {
  return WORK_CYCLES.find(c => date >= c.start && date <= c.end);
}

export function cycleDays(cycle: WorkCycle): number {
  const a = new Date(cycle.start + 'T00:00:00');
  const b = new Date(cycle.end + 'T00:00:00');
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
}

export function cycleBaseHours(cycle: WorkCycle): number {
  return +(cycleDays(cycle) * DAILY_BASE).toFixed(2);
}
