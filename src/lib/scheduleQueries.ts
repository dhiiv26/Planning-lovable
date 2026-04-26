// Récupère les schedules d'un user sur une plage de dates arbitraire (utilisé pour les cycles).
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { ScheduleEntry } from './scheduleStore';

export async function fetchUserSchedulesRange(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<ScheduleEntry[]> {
  const q = query(
    collection(db, 'schedules'),
    where('userId', '==', userId),
    where('date', '>=', startDate),
    where('date', '<=', endDate),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as ScheduleEntry);
}
