// Moteur de calcul salaire — MODE RH.
// Principe fondamental : un jour = un seul statut = un seul traitement.
// Aucun cumul possible entre CP / RC / ABS / férié / heures travaillées.
//
// Priorité stricte de résolution du statut journalier :
//   1. ABS   → 0 €, aucune heure, aucune prime, aucune majoration
//   2. CP    → 5,5 × taux horaire, aucune autre logique
//   3. RC    → 12  × taux horaire, aucune autre logique
//   4. HOLIDAY_WORKED → uniquement majoration férié (si shift réel)
//   5. WORK  → heures normales, primes panier, majo nuit/dimanche
//
// L'API publique (SalaryInput / SalaryBreakdown) est conservée à l'identique
// pour ne pas casser SalaryPage.tsx ni aucun autre consommateur.
import { ScheduleEntry } from './scheduleStore';
import { DynamicShift } from './shiftsStore';
import { SalarySettings } from './salaryStore';
import { findCycleForDate, cycleBaseHours } from './cycles';

export interface AbsenceOverride {
  date: string;     // YYYY-MM-DD
  hours: 8 | 12;    // conservé pour compat UI (non utilisé pour le calcul ABS qui vaut 0)
}

export interface ExtraReplacement {
  type: 'semaine' | 'weekend';
  qty: number;
}

export interface SalaryInput {
  userId: string;
  hourlyRate: number;
  monthEntries: ScheduleEntry[];
  cycleEntries: ScheduleEntry[];
  shiftsByCode: Map<string, DynamicShift>;
  settings: SalarySettings;
  year: number;
  month: number; // 0-11
  absences: AbsenceOverride[];
  replacements: ExtraReplacement[];
  holidays?: string[];
}

export interface SalaryBreakdown {
  baseSalary: number;
  workedHoursMonth: number;
  // Heures sup (calcul cycle)
  cycleIndex: number | null;
  cycleHours: number;
  cycleBase: number;
  cycleOvertime: number;
  cetHours: number;
  paidOvertime1: number;
  paidOvertime2: number;
  amountOvertime1: number;
  amountOvertime2: number;
  // Majorations
  nightHours: number;
  amountNight: number;
  sundayHours: number;
  amountSunday: number;
  holidayHours: number;
  amountHoliday: number;
  // Primes fixes
  primeHabillage: number;
  primeCarburant: number;
  primePanier: number;
  workedDaysCount: number;
  // Primes remplacement
  primeRemplacement: number;
  // Absences / statuts payés
  absenceDeduction: number;     // toujours 0 en mode RH (ABS = 0 €, pas de déduction sur base)
  absenceHours: number;         // pour compat UI : nb d'heures d'ABS choisies (info)
  // Total
  total: number;

  // ---- Champs additionnels mode RH (optionnels, non requis par l'UI existante) ----
  cpDays?: number;
  cpAmount?: number;
  rcDays?: number;
  rcAmount?: number;
  absDays?: number;
}

type DayStatus = 'WORK' | 'HOLIDAY_WORKED' | 'CP' | 'RC' | 'ABS' | 'NONE';

const NIGHT_START_HOUR = 22;
const NIGHT_END_HOUR = 6;

/** Renvoie le nombre d'heures qui tombent entre 22h et 06h pour un shift `time` "HH:MM-HH:MM". */
function hoursAtNight(time?: string): number {
  if (!time || !time.includes('-')) return 0;
  const [s, e] = time.split('-').map(t => t.trim());
  const [sh, sm] = s.split(':').map(Number);
  const [eh, em] = e.split(':').map(Number);
  if ([sh, sm, eh, em].some(n => Number.isNaN(n))) return 0;
  const start = sh + sm / 60;
  let end = eh + em / 60;
  if (end <= start) end += 24;
  let nightTotal = 0;
  const stepHours = 1 / 60;
  for (let t = start; t < end; t += stepHours) {
    const h = ((t % 24) + 24) % 24;
    if (h >= NIGHT_START_HOUR || h < NIGHT_END_HOUR) nightTotal += stepHours;
  }
  return +nightTotal.toFixed(2);
}

/**
 * Résout le statut unique d'un jour selon la priorité RH stricte.
 * Le code shift est analysé en priorité (ABS/CP/RC dominent toujours sur tout le reste).
 */
function resolveDayStatus(
  shiftCode: string | undefined,
  shift: DynamicShift | undefined,
  isHolidayDay: boolean,
): DayStatus {
  if (!shiftCode) return 'NONE';
  // Priorité 1 : ABS
  if (shiftCode === 'ABS') return 'ABS';
  // Priorité 2 : CP
  if (shiftCode === 'CP') return 'CP';
  // Priorité 3 : RC (codes de repos compensateur courants)
  if (shiftCode === 'RC' || shiftCode === 'REC') return 'RC';
  // Catégorie rest non listée explicitement : on traite comme RC payé uniquement
  // si le code commence par RC, sinon comme NONE (jour off non payé).
  if (shift?.category === 'rest') {
    // Codes de repos non rémunérés (ex : RH, OFF, R) → aucun calcul
    return 'NONE';
  }
  if (shift?.category === 'absence') return 'ABS';
  // Shift réel travaillé
  if (shift && shift.hours > 0) {
    return isHolidayDay ? 'HOLIDAY_WORKED' : 'WORK';
  }
  return 'NONE';
}

export function computeSalary(input: SalaryInput): SalaryBreakdown {
  const {
    hourlyRate, monthEntries, cycleEntries, shiftsByCode, settings,
    replacements, holidays = [],
  } = input;

  const baseSalary = +(hourlyRate * 151.67).toFixed(2);

  // ---- Résolution unique par jour, mois courant ----
  let workedHoursMonth = 0;
  let nightHours = 0;
  let sundayHours = 0;
  let holidayHours = 0;
  const workedDays = new Set<string>();        // jours WORK + HOLIDAY_WORKED
  const mealBonusDays = new Set<string>();     // jours éligibles prime panier

  let cpDays = 0;
  let rcDays = 0;
  let absDays = 0;

  // Garde un seul statut par date (au cas où plusieurs entrées existeraient pour la même date)
  const seen = new Set<string>();

  for (const e of monthEntries) {
    if (seen.has(e.date)) continue; // un jour = un statut
    seen.add(e.date);

    const shift = shiftsByCode.get(e.shiftCode);
    const isHolidayDay = holidays.includes(e.date);
    const status = resolveDayStatus(e.shiftCode, shift, isHolidayDay);

    switch (status) {
      case 'ABS': {
        absDays++;
        // 0 € — aucune autre logique
        break;
      }
      case 'CP': {
        cpDays++;
        // payé forfaitairement, aucune prime ni majoration
        break;
      }
      case 'RC': {
        rcDays++;
        // payé forfaitairement, aucune prime ni majoration
        break;
      }
      case 'WORK': {
        if (!shift) break;
        const h = shift.hours || 0;
        workedHoursMonth += h;
        workedDays.add(e.date);
        if (shift.countForMealBonus !== false) mealBonusDays.add(e.date);
        nightHours += hoursAtNight(shift.time);
        const dow = new Date(e.date + 'T00:00:00').getDay();
        if (dow === 0) sundayHours += h;
        // PAS de holidayHours ici (jour non férié)
        break;
      }
      case 'HOLIDAY_WORKED': {
        if (!shift) break;
        const h = shift.hours || 0;
        workedHoursMonth += h;
        workedDays.add(e.date);
        if (shift.countForMealBonus !== false) mealBonusDays.add(e.date);
        // RÈGLE RH : férié travaillé → uniquement la majoration férié.
        // On NE compte PAS la majo nuit ni dimanche pour ce jour (un seul traitement).
        holidayHours += h;
        break;
      }
      case 'NONE':
      default:
        break;
    }
  }

  // ---- Statuts payés (mode mensualisé français) ----
  // En mensualisation, CP et RC sont DÉJÀ inclus dans le salaire de base (151,67h).
  // Ils ne doivent donc JAMAIS être ajoutés au total. On conserve cpDays/rcDays
  // pour l'affichage et les statistiques uniquement.
  const cpAmount = 0;
  const rcAmount = 0;
  // ABS = 0 € (pas de déduction additionnelle ici).
  const absenceDeduction = 0;
  const absenceHours = 0;

  // ---- Heures sup (cycle) — uniquement à partir des jours WORK/HOLIDAY_WORKED du cycle ----
  let cycleIndex: number | null = null;
  let cycleHours = 0;
  let cycleBase = 0;
  let cycleOvertime = 0;
  let cetHours = 0;
  let paidOvertime1 = 0;
  let paidOvertime2 = 0;

  const refDate = `${input.year}-${String(input.month + 1).padStart(2, '0')}-15`;
  const cycle = findCycleForDate(refDate);
  if (cycle) {
    cycleIndex = cycle.index;
    cycleBase = cycleBaseHours(cycle);
    const seenCycle = new Set<string>();
    cycleHours = cycleEntries.reduce((sum, e) => {
      if (seenCycle.has(e.date)) return sum;
      seenCycle.add(e.date);
      const shift = shiftsByCode.get(e.shiftCode);
      const isH = holidays.includes(e.date);
      const status = resolveDayStatus(e.shiftCode, shift, isH);
      if (status === 'WORK' || status === 'HOLIDAY_WORKED') {
        return sum + (shift?.hours || 0);
      }
      return sum;
    }, 0);
    cycleOvertime = Math.max(0, +(cycleHours - cycleBase).toFixed(2));
    cetHours = Math.min(cycleOvertime, settings.threshold1);
    const remaining1 = Math.max(0, cycleOvertime - settings.threshold1);
    paidOvertime1 = Math.min(remaining1, settings.threshold2 - settings.threshold1);
    paidOvertime2 = Math.max(0, cycleOvertime - settings.threshold2);
  }

  const amountOvertime1 = +(paidOvertime1 * hourlyRate * settings.overtimeRate1).toFixed(2);
  const amountOvertime2 = +(paidOvertime2 * hourlyRate * settings.overtimeRate2).toFixed(2);

  // ---- Majorations ----
  const amountNight = +(nightHours * hourlyRate * (settings.majorationNuit / 100)).toFixed(2);
  const amountSunday = +(sundayHours * hourlyRate * (settings.majorationDimanche / 100)).toFixed(2);
  const amountHoliday = +(holidayHours * hourlyRate * (settings.majorationFerie / 100)).toFixed(2);

  // ---- Primes fixes ----
  const primeHabillage = workedDays.size > 0 ? settings.primeHabillage : 0;
  const primeCarburant = workedDays.size > 0 ? settings.primeCarburant : 0;
  const primePanier = +(mealBonusDays.size * settings.primePanier).toFixed(2);

  // ---- Primes remplacement ----
  const primeRemplacement = replacements.reduce((sum, r) => {
    const unit = r.type === 'weekend' ? settings.remplacementWeekend : settings.remplacementSemaine;
    return sum + unit * Math.max(0, r.qty);
  }, 0);

  const total = +(
    baseSalary
    + amountOvertime1 + amountOvertime2
    + amountNight + amountSunday + amountHoliday
    + primeHabillage + primeCarburant + primePanier
    + primeRemplacement
    - absenceDeduction
  ).toFixed(2);

  return {
    baseSalary,
    workedHoursMonth: +workedHoursMonth.toFixed(2),
    cycleIndex,
    cycleHours: +cycleHours.toFixed(2),
    cycleBase,
    cycleOvertime,
    cetHours,
    paidOvertime1,
    paidOvertime2,
    amountOvertime1,
    amountOvertime2,
    nightHours: +nightHours.toFixed(2),
    amountNight,
    sundayHours: +sundayHours.toFixed(2),
    amountSunday,
    holidayHours: +holidayHours.toFixed(2),
    amountHoliday,
    primeHabillage,
    primeCarburant,
    primePanier,
    workedDaysCount: workedDays.size,
    primeRemplacement,
    absenceDeduction,
    absenceHours,
    total,
    cpDays,
    cpAmount,
    rcDays,
    rcAmount,
    absDays,
  };
}
