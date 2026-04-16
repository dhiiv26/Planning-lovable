import { addLog } from './logger';

export interface ScheduleEntry {
  userId: string;
  date: string; // YYYY-MM-DD
  shiftCode: string;
}

function getKey() {
  return 'security_schedules';
}

export function getAllSchedules(): ScheduleEntry[] {
  const stored = localStorage.getItem(getKey());
  return stored ? JSON.parse(stored) : [];
}

function saveSchedules(entries: ScheduleEntry[]) {
  localStorage.setItem(getKey(), JSON.stringify(entries));
}

/** Returns true if the month is in the past (read-only) */
export function isMonthLocked(year: number, month: number): boolean {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed
  return year < currentYear || (year === currentYear && month < currentMonth);
}

/** Set or replace a schedule entry for a user on a date */
export function setSchedule(userId: string, date: string, shiftCode: string): boolean {
  const [yearStr, monthStr] = date.split('-');
  if (isMonthLocked(parseInt(yearStr), parseInt(monthStr) - 1)) {
    addLog('error', `Modification refusée: le mois ${monthStr}/${yearStr} est verrouillé`);
    return false;
  }

  const all = getAllSchedules();
  const idx = all.findIndex(e => e.userId === userId && e.date === date);

  if (idx >= 0) {
    all[idx].shiftCode = shiftCode;
    addLog('info', `Horaire modifié: ${date} → ${shiftCode}`);
  } else {
    all.push({ userId, date, shiftCode });
    addLog('info', `Horaire ajouté: ${date} → ${shiftCode}`);
  }

  saveSchedules(all);
  return true;
}

/** Remove a schedule entry */
export function removeSchedule(userId: string, date: string): boolean {
  const [yearStr, monthStr] = date.split('-');
  if (isMonthLocked(parseInt(yearStr), parseInt(monthStr) - 1)) {
    addLog('error', `Suppression refusée: mois verrouillé`);
    return false;
  }

  const all = getAllSchedules();
  const filtered = all.filter(e => !(e.userId === userId && e.date === date));
  if (filtered.length === all.length) return false;
  saveSchedules(filtered);
  addLog('info', `Horaire supprimé: ${date}`);
  return true;
}

/** Get schedules for a user in a given month */
export function getUserMonthSchedules(userId: string, year: number, month: number): ScheduleEntry[] {
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  return getAllSchedules().filter(e => e.userId === userId && e.date.startsWith(prefix));
}

/** Get all schedules for a given month */
export function getMonthSchedules(year: number, month: number): ScheduleEntry[] {
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  return getAllSchedules().filter(e => e.date.startsWith(prefix));
}
