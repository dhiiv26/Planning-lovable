// Paramètres salaire globaux (admin uniquement).
// Stockés dans Firestore : display/settings (champ `salary`)
// + taux horaire individuel sur users/{uid}.hourlyRate
import { doc, setDoc, onSnapshot, updateDoc, getDoc, Unsubscribe } from 'firebase/firestore';
import { db } from './firebase';
import { addLog } from './logger';

export interface SalarySettings {
  // Heures sup
  threshold1: number;       // ex: 4 (heures CET, non payées)
  threshold2: number;       // ex: 8 (limite tranche +25%)
  overtimeRate1: number;    // ex: 1.25
  overtimeRate2: number;    // ex: 1.50
  // Primes fixes
  primeHabillage: number;   // 1x / mois
  primeCarburant: number;   // 1x / mois
  primePanier: number;      // par jour travaillé
  // Primes remplacement
  remplacementSemaine: number;
  remplacementWeekend: number;
  // Majorations (en %)
  majorationNuit: number;     // 10
  majorationDimanche: number; // 10
  majorationFerie: number;    // 100 (=> x2)
  // Coefficient de conversion brut -> net (estimation)
  netCoefficient: number;     // ex: 0.78
}

export const DEFAULT_SALARY: SalarySettings = {
  threshold1: 4,
  threshold2: 8,
  overtimeRate1: 1.25,
  overtimeRate2: 1.50,
  primeHabillage: 16.69,
  primeCarburant: 45.40,
  primePanier: 4.48,
  remplacementSemaine: 35,
  remplacementWeekend: 45,
  majorationNuit: 10,
  majorationDimanche: 10,
  majorationFerie: 100,
  netCoefficient: 0.78,
};

const REF = () => doc(db, 'display', 'settings');

export function subscribeSalarySettings(cb: (s: SalarySettings) => void): Unsubscribe {
  return onSnapshot(
    REF(),
    snap => {
      const data: any = snap.data() || {};
      const s = (data.salary || {}) as Partial<SalarySettings>;
      cb({ ...DEFAULT_SALARY, ...s });
    },
    err => addLog('error', `Erreur lecture salary: ${err.message}`)
  );
}

export async function saveSalarySettings(s: SalarySettings): Promise<boolean> {
  try {
    await setDoc(REF(), { salary: s }, { merge: true });
    addLog('info', 'Paramètres salaire mis à jour');
    return true;
  } catch (e: any) {
    addLog('error', `Erreur enregistrement salary: ${e?.message}`);
    return false;
  }
}

export async function getUserHourlyRate(userId: string): Promise<number> {
  try {
    const snap = await getDoc(doc(db, 'users', userId));
    const data: any = snap.data() || {};
    return Number(data.hourlyRate) || 0;
  } catch {
    return 0;
  }
}

export async function setUserHourlyRate(userId: string, rate: number): Promise<boolean> {
  try {
    await updateDoc(doc(db, 'users', userId), { hourlyRate: rate });
    addLog('info', `Taux horaire mis à jour: ${rate}€`);
    return true;
  } catch (e: any) {
    addLog('error', `Erreur taux horaire: ${e?.message}`);
    return false;
  }
}
