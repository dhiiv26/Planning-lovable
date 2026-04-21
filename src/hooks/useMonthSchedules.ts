import { useEffect, useState } from 'react';
import { subscribeMonthSchedules, ScheduleEntry } from '@/lib/scheduleStore';

/**
 * Subscribes to a single month of schedules using one Firestore listener.
 * The listener automatically updates state on local writes (offline cache too),
 * so no manual refresh / refetch is required after setSchedule/removeSchedule.
 */
export function useMonthSchedules(year: number, month: number) {
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeMonthSchedules(year, month, list => {
      setEntries(list);
      setLoading(false);
    });
    return unsub;
  }, [year, month]);

  return { entries, loading };
}
