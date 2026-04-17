// Firestore-backed schedule store.
// Document layout: schedules/{userId}_{date}  =>  { userId, date, shiftCode }
// Doc id is deterministic so writing the same (user, date) always replaces the entry.

import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import { addLog } from './logger';

export interface ScheduleEntry {
  userId: string;
  date: string; // YYYY-MM-DD
  shiftCode: string;
}

const COL = 'schedules';
const docId = (userId: string, date: string) => `${userId}_${date}`;

/** Returns true if the month is in the past (read-only) */
export function isMonthLocked(year: number, month: number): boolean {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  return year < currentYear || (year === currentYear && month < currentMonth);
}

/** Set or replace a schedule entry */
export async function setSchedule(userId: string, date: string, shiftCode: string): Promise<boolean> {
  const [yearStr, monthStr] = date.split('-');
  if (isMonthLocked(parseInt(yearStr), parseInt(monthStr) - 1)) {
    addLog('error', `Modification refusée: mois ${monthStr}/${yearStr} verrouillé`);
    return false;
  }
  try {
    await setDoc(doc(db, COL, docId(userId, date)), { userId, date, shiftCode });
    addLog('info', `Horaire enregistré: ${date} → ${shiftCode}`);
    return true;
  } catch (e: any) {
    addLog('error', `Erreur enregistrement horaire: ${e?.message}`);
    return false;
  }
}

/** Remove a schedule entry */
export async function removeSchedule(userId: string, date: string): Promise<boolean> {
  const [yearStr, monthStr] = date.split('-');
  if (isMonthLocked(parseInt(yearStr), parseInt(monthStr) - 1)) {
    addLog('error', `Suppression refusée: mois verrouillé`);
    return false;
  }
  try {
    await deleteDoc(doc(db, COL, docId(userId, date)));
    addLog('info', `Horaire supprimé: ${date}`);
    return true;
  } catch (e: any) {
    addLog('error', `Erreur suppression horaire: ${e?.message}`);
    return false;
  }
}

/**
 * Subscribe to all schedules of a given month (string-prefix filter on the `date` field).
 * Single Firestore listener — the cache & onSnapshot diff handle subsequent changes.
 */
export function subscribeMonthSchedules(
  year: number,
  month: number,
  cb: (entries: ScheduleEntry[]) => void
): Unsubscribe {
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const end = `${prefix}-32`; // safe upper bound (any date in the month is < "...-32")
  const q = query(
    collection(db, COL),
    where('date', '>=', `${prefix}-00`),
    where('date', '<', end)
  );
  return onSnapshot(
    q,
    snap => cb(snap.docs.map(d => d.data() as ScheduleEntry)),
    err => addLog('error', `Erreur lecture planning: ${err.message}`)
  );
}
