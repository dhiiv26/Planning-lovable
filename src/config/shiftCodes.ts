export interface ShiftCode {
  code: string;
  label: string;
  hours: number;
  time: string;
  category: 'night' | 'day' | 'rest' | 'formation' | 'long';
}

export const SHIFT_CODES: ShiftCode[] = [
  { code: "CJ", label: "Chef jour", hours: 12, time: "07:00-19:00", category: "day" },
  { code: "CN", label: "Chef nuit", hours: 12, time: "19:00-07:00", category: "night" },
  { code: "J12", label: "Jour", hours: 12, time: "07:00-19:00", category: "day" },
  { code: "N12", label: "Nuit", hours: 12, time: "19:00-07:00", category: "night" },
  { code: "M12", label: "Journée longue", hours: 12, time: "10:00-22:00", category: "long" },
  { code: "M8", label: "Matin", hours: 8, time: "06:00-14:00", category: "day" },
  { code: "S8", label: "Après-midi", hours: 8, time: "14:00-22:00", category: "day" },
  { code: "RS", label: "Renfort samedi", hours: 10, time: "10:00-20:00", category: "day" },
  { code: "F7", label: "Formation", hours: 7, time: "09:00-17:00", category: "formation" },
  { code: "CP", label: "Congé payé", hours: 5.5, time: "N/A", category: "rest" },
];

export function getShiftByCode(code: string): ShiftCode | undefined {
  return SHIFT_CODES.find(s => s.code === code);
}

export function getShiftClass(code: string): string {
  const shift = getShiftByCode(code);
  if (!shift) return '';
  return `shift-${shift.category}`;
}
