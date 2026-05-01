// Jours fériés français — calculés dynamiquement, sans Firestore ni hardcoding par année.
// Format : YYYY-MM-DD

const pad = (n: number) => String(n).padStart(2, '0');
const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Calcul de Pâques (algorithme de Meeus/Butcher, calendrier grégorien). */
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = mars, 4 = avril
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** Renvoie la liste des jours fériés français (format YYYY-MM-DD) pour l'année donnée. */
export function getHolidays(year: number): string[] {
  const easter = easterSunday(year);
  const fixed = [
    `${year}-01-01`, // Jour de l'an
    `${year}-05-01`, // Fête du travail
    `${year}-05-08`, // Victoire 1945
    `${year}-07-14`, // Fête nationale
    `${year}-08-15`, // Assomption
    `${year}-11-01`, // Toussaint
    `${year}-11-11`, // Armistice 1918
    `${year}-12-25`, // Noël
  ];
  const variable = [
    fmt(addDays(easter, 1)),  // Lundi de Pâques
    fmt(addDays(easter, 39)), // Ascension
    fmt(addDays(easter, 50)), // Lundi de Pentecôte
  ];
  return [...fixed, ...variable].sort();
}

/** True si la date YYYY-MM-DD est un jour férié français. */
export function isHoliday(dateStr: string): boolean {
  const year = parseInt(dateStr.slice(0, 4), 10);
  if (!Number.isFinite(year)) return false;
  return getHolidays(year).includes(dateStr);
}
