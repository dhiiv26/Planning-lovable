import { useEffect, useState, useMemo } from 'react';
import { subscribeShifts, seedShiftsIfEmpty, DynamicShift, defaultColorFor } from '@/lib/shiftsStore';
import { SHIFT_CODES } from '@/config/shiftCodes';

// Fallback à partir des codes statiques (utilisé tant que Firestore n'a pas répondu)
const FALLBACK: DynamicShift[] = SHIFT_CODES.map(s => ({
  code: s.code,
  label: s.label,
  hours: s.hours,
  time: s.time,
  category: s.category,
  color: defaultColorFor(s.category),
}));

export function useShifts() {
  const [shifts, setShifts] = useState<DynamicShift[]>(FALLBACK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    seedShiftsIfEmpty();
    const unsub = subscribeShifts(list => {
      if (list.length > 0) setShifts(list);
      setLoading(false);
    });
    return unsub;
  }, []);

  const byCode = useMemo(() => {
    const m = new Map<string, DynamicShift>();
    shifts.forEach(s => m.set(s.code, s));
    return m;
  }, [shifts]);

  return { shifts, byCode, loading };
}

// Génère style inline (background + texte lisible) à partir d'une couleur hex
export function shiftStyle(color?: string): React.CSSProperties {
  if (!color) return {};
  return {
    backgroundColor: color,
    color: pickReadableTextColor(color),
    borderColor: color,
  };
}

function pickReadableTextColor(hex: string): string {
  const c = hex.replace('#', '');
  if (c.length !== 6) return '#000';
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  // Luminance perçue
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#111' : '#fff';
}
