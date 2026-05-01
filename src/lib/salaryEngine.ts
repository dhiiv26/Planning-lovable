// Moteur de calcul salaire — basé sur planning réel (Firestore schedules) + paramètres admin.
// Toute la logique reste isolée par userId (jamais d'agrégation inter-utilisateurs).
import { ScheduleEntry } from './scheduleStore';
import { DynamicShift } from './shiftsStore';
import { SalarySettings } from './salaryStore';
import { findCycleForDate, cycleBaseHours, WORK_CYCLES, cycleDays } from './cycles';

export interface AbsenceOverride {
  date: string;     // YYYY-MM-DD
  hours: 8 | 12;    // choisi à la saisie
}

export interface ExtraReplacement {
  type: 'semaine' | 'weekend';
  qty: number;
}

export interface SalaryInput {
  userId: string;
  hourlyRate: number;
  monthEntries: ScheduleEntry[];     // déjà filtré pour l'user et le mois
  cycleEntries: ScheduleEntry[];     // déjà filtré pour l'user et le cycle (pour HS)
  shiftsByCode: Map<string, DynamicShift>;
  settings: SalarySettings;
  year: number;
  month: number; // 0-11
  absences: AbsenceOverride[];       // pour les codes ABS
  replacements: ExtraReplacement[];
  holidays?: string[];               // YYYY-MM-DD jours fériés
}

export interface SalaryBreakdown {
  baseSalary: number;          // taux horaire × 151.67
  workedHoursMonth: number;    // total heures planifiées dans le mois (hors ABS)
  // Heures sup (calcul cycle)
  cycleIndex: number | null;
  cycleHours: number;
  cycleBase: number;
  cycleOvertime: number;
  cetHours: number;            // 0..threshold1
  paidOvertime1: number;       // tranche threshold1..threshold2
  paidOvertime2: number;       // au-delà
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
  // Absences
  absenceDeduction: number;
  absenceHours: number;
  // Total
  total: number;
}

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
  if (end <= start) end += 24; // shift de nuit qui passe minuit
  let nightTotal = 0;
  // Découpe par tranches d'1 minute
  const stepHours = 1 / 60;
  for (let t = start; t < end; t += stepHours) {
    const h = ((t % 24) + 24) % 24;
    if (h >= NIGHT_START_HOUR || h < NIGHT_END_HOUR) nightTotal += stepHours;
  }
  return +nightTotal.toFixed(2);
}

export function computeSalary(input: SalaryInput): SalaryBreakdown {
  const {
    hourlyRate, monthEntries, cycleEntries, shiftsByCode, settings,
    absences, replacements, holidays = [],
  } = input;

  const baseSalary = +(hourlyRate * 151.67).toFixed(2);

  // ---- Mois courant : heures, primes, majorations ----
  let workedHoursMonth = 0;
  let nightHours = 0;
  let sundayHours = 0;
  let holidayHours = 0;
  const workedDays = new Set<string>();
  const mealBonusDays = new Set<string>();

  for (const e of monthEntries) {
    const shift = shiftsByCode.get(e.shiftCode);
    // Compte la prime panier si le code est marqué comme éligible (par défaut true)
    if (shift && shift.countForMealBonus !== false) {
      mealBonusDays.add(e.date);
    }
    if (e.shiftCode === 'ABS') continue;
    if (!shift) continue;
    const h = shift.hours || 0;
    workedHoursMonth += h;
    workedDays.add(e.date);

    nightHours += hoursAtNight(shift.time);

    const dow = new Date(e.date + 'T00:00:00').getDay();
    if (dow === 0) sundayHours += h;
    if (holidays.includes(e.date)) holidayHours += h;
  }

  // ---- ABS : déduction directe ----
  let absenceHours = 0;
  for (const a of absences) {
    absenceHours += a.hours;
  }
  const absenceDeduction = +(absenceHours * hourlyRate).toFixed(2);

  // ---- Heures sup (cycle) ----
  let cycleIndex: number | null = null;
  let cycleHours = 0;
  let cycleBase = 0;
  let cycleOvertime = 0;
  let cetHours = 0;
  let paidOvertime1 = 0;
  let paidOvertime2 = 0;

  // Trouve le cycle de référence : celui qui contient le 15 du mois affiché
  const refDate = `${input.year}-${String(input.month + 1).padStart(2, '0')}-15`;
  const cycle = findCycleForDate(refDate);
  if (cycle) {
    cycleIndex = cycle.index;
    cycleBase = cycleBaseHours(cycle);
    cycleHours = cycleEntries
      .filter(e => e.shiftCode !== 'ABS')
      .reduce((sum, e) => sum + (shiftsByCode.get(e.shiftCode)?.hours || 0), 0);
    cycleOvertime = Math.max(0, +(cycleHours - cycleBase).toFixed(2));
    cetHours = Math.min(cycleOvertime, settings.threshold1);
    const remaining1 = Math.max(0, cycleOvertime - settings.threshold1);
    paidOvertime1 = Math.min(remaining1, settings.threshold2 - settings.threshold1);
    paidOvertime2 = Math.max(0, cycleOvertime - settings.threshold2);
  }

  const amountOvertime1 = +(paidOvertime1 * hourlyRate * settings.overtimeRate1).toFixed(2);
  const amountOvertime2 = +(paidOvertime2 * hourlyRate * settings.overtimeRate2).toFixed(2);

  // ---- Majorations sur heures réelles du mois ----
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
  };
}
