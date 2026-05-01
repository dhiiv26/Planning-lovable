// Firestore-backed dynamic shifts (codes horaires personnalisables par l'admin).
// Document layout: shifts/{code} => { code, label, hours, time, color, category }
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import { addLog } from './logger';
import { SHIFT_CODES, ShiftCode as StaticShift } from '@/config/shiftCodes';

export interface DynamicShift {
  code: string;
  label: string;
  hours: number;
  time: string;
  color: string; // hex (#RRGGBB) — fond du badge
  category?: StaticShift['category'];
  /** Si true, ce code génère une prime panier le jour travaillé. Par défaut: true sauf rest/absence. */
  countForMealBonus?: boolean;
}

/** Valeur par défaut de countForMealBonus selon la catégorie. */
export function defaultCountForMealBonus(category?: StaticShift['category']): boolean {
  if (category === 'rest' || category === 'absence') return false;
  return true;
}

const COL = 'shifts';

// Couleurs de seed par catégorie (pour la première initialisation)
const CATEGORY_COLORS: Record<StaticShift['category'], string> = {
  night: '#3b82f6',
  day: '#facc15',
  rest: '#9ca3af',
  formation: '#10b981',
  long: '#f97316',
  absence: '#ef4444',
};

export function defaultColorFor(category?: StaticShift['category']): string {
  return CATEGORY_COLORS[category || 'day'] || '#9ca3af';
}

export async function seedShiftsIfEmpty(): Promise<void> {
  try {
    const snap = await getDocs(collection(db, COL));
    if (!snap.empty) {
      // Garantit que ABS existe (pour les bases déjà initialisées)
      const hasAbs = snap.docs.some(d => d.id === 'ABS');
      if (!hasAbs) {
        const abs = SHIFT_CODES.find(s => s.code === 'ABS');
        if (abs) {
          await setDoc(doc(db, COL, 'ABS'), {
            code: abs.code,
            label: abs.label,
            hours: abs.hours,
            time: abs.time,
            category: abs.category,
            color: defaultColorFor(abs.category),
            countForMealBonus: defaultCountForMealBonus(abs.category),
          } as DynamicShift);
          addLog('info', 'Shift ABS ajouté automatiquement');
        }
      }
      return;
    }
    await Promise.all(
      SHIFT_CODES.map(s =>
        setDoc(doc(db, COL, s.code), {
          code: s.code,
          label: s.label,
          hours: s.hours,
          time: s.time,
          category: s.category,
          color: defaultColorFor(s.category),
          countForMealBonus: defaultCountForMealBonus(s.category),
        } as DynamicShift)
      )
    );
    addLog('info', `Shifts initialisés (${SHIFT_CODES.length} codes par défaut)`);
  } catch (e: any) {
    addLog('warn', `Seed shifts ignoré: ${e?.message}`);
  }
}

export function subscribeShifts(cb: (shifts: DynamicShift[]) => void): Unsubscribe {
  return onSnapshot(
    collection(db, COL),
    snap => cb(snap.docs.map(d => d.data() as DynamicShift)),
    err => addLog('error', `Erreur lecture shifts: ${err.message}`)
  );
}

export async function upsertShift(shift: DynamicShift): Promise<boolean> {
  try {
    await setDoc(doc(db, COL, shift.code), shift);
    addLog('info', `Shift enregistré: ${shift.code}`);
    return true;
  } catch (e: any) {
    addLog('error', `Erreur enregistrement shift ${shift.code}: ${e?.message}`);
    return false;
  }
}

export async function deleteShift(code: string): Promise<boolean> {
  try {
    await deleteDoc(doc(db, COL, code));
    addLog('warn', `Shift supprimé: ${code}`);
    return true;
  } catch (e: any) {
    addLog('error', `Erreur suppression shift ${code}: ${e?.message}`);
    return false;
  }
}
