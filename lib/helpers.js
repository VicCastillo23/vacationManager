// ==================== HELPER FUNCTIONS ====================

// Helper: Calcular días de vacations según antigüedad
function calculateVacationDays(hireDate, referenceDate = new Date()) {
  const hire = new Date(hireDate);
  const today = new Date(referenceDate);
  const yearsOfService = Math.floor((today - hire) / (365.25 * 24 * 60 * 60 * 1000));
  
  // Tabla de días según años de servicio
  if (yearsOfService < 1) return 12;
  if (yearsOfService === 1) return 12;
  if (yearsOfService === 2) return 16;
  if (yearsOfService === 3) return 18;
  if (yearsOfService === 4) return 20;
  if (yearsOfService === 5) return 22;
  if (yearsOfService >= 6 && yearsOfService <= 9) return 24;
  if (yearsOfService >= 10 && yearsOfService <= 14) return 26;
  if (yearsOfService >= 15 && yearsOfService <= 19) return 28;
  if (yearsOfService >= 20 && yearsOfService <= 24) return 30;
  if (yearsOfService >= 25 && yearsOfService <= 29) return 32;
  if (yearsOfService >= 30) return 34;
  return 12;
}

// Helper: Calcular años de servicio
function calculateYearsOfService(hireDate, referenceDate = new Date()) {
  const hire = new Date(hireDate);
  const today = new Date(referenceDate);
  return Math.floor((today - hire) / (365.25 * 24 * 60 * 60 * 1000));
}

// Helper: Obtener el período de aniversario actual del empleado
function getCurrentVacationPeriod(hireDate, referenceDate = new Date()) {
  const hire = new Date(hireDate);
  const today = new Date(referenceDate);
  
  // Calcular el aniversario más reciente
  const periodStart = new Date(hire);
  periodStart.setFullYear(today.getFullYear());
  
  // Si aún no llega el aniversario de este año, retroceder un año
  if (periodStart > today) {
    periodStart.setFullYear(periodStart.getFullYear() - 1);
  }
  
  const periodEnd = new Date(periodStart);
  periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  periodEnd.setDate(periodEnd.getDate() - 1);
  
  const fmt = d => d.toISOString().split('T')[0];
  return { periodStart: fmt(periodStart), periodEnd: fmt(periodEnd) };
}

// Helper: Calcular lunes cívicos
function getNthWeekdayOfMonth(year, month, weekday, n) {
  const firstDay = new Date(year, month, 1);
  const firstWeekday = firstDay.getDay();
  const daysUntilWeekday = (weekday - firstWeekday + 7) % 7;
  const nthWeekday = 1 + daysUntilWeekday + (n - 1) * 7;
  return new Date(year, month, nthWeekday).toISOString().split('T')[0];
}

// Helper: Calcular Jueves y Viernes Santo (basado en la Pascua)
function getEasterDates(year) {
  // Algoritmo de Butcher para calcular la Pascua
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
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0-indexed
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  
  const easter = new Date(year, month, day);
  const juevesSanto = new Date(easter);
  juevesSanto.setDate(easter.getDate() - 3);
  const viernesSanto = new Date(easter);
  viernesSanto.setDate(easter.getDate() - 2);
  
  return {
    jueves: juevesSanto.toISOString().split('T')[0],
    viernes: viernesSanto.toISOString().split('T')[0]
  };
}

// Helper: Días festivos mexicanos (2026)
function getMexicanHolidays2026() {
  const easter = getEasterDates(2026);
  
  return [
    { date: '2026-01-01', name: 'Año Nuevo', type: 'fixed' },
    { date: getNthWeekdayOfMonth(2026, 1, 1, 1), name: 'Día de la Constitución Mexicana', type: 'movable' },
    { date: getNthWeekdayOfMonth(2026, 2, 1, 3), name: 'Natalicio de Benito Juárez', type: 'movable' },
    { date: easter.jueves, name: 'Jueves Santo', type: 'movable' },
    { date: easter.viernes, name: 'Viernes Santo', type: 'movable' },
    { date: '2026-05-01', name: 'Día del Trabajo', type: 'fixed' },
    { date: '2026-09-16', name: 'Día de la Independencia', type: 'fixed' },
    { date: '2026-11-02', name: 'Día de Muertos', type: 'fixed' },
    { date: getNthWeekdayOfMonth(2026, 10, 1, 3), name: 'Día de la Revolución Mexicana', type: 'movable' },
    { date: '2026-12-12', name: 'Virgen de Guadalupe', type: 'fixed' },
    { date: '2026-12-25', name: 'Navidad', type: 'fixed' }
  ];
}

const MEXICAN_HOLIDAYS_2026 = getMexicanHolidays2026();

// Helper: Verificar si una fecha es festivo
function isHoliday(dateStr) {
  return MEXICAN_HOLIDAYS_2026.some(h => h.date === dateStr);
}

// Helper: Obtener nombre del festivo
function getHolidayName(dateStr) {
  const holiday = MEXICAN_HOLIDAYS_2026.find(h => h.date === dateStr);
  return holiday ? holiday.name : null;
}

module.exports = {
  calculateVacationDays,
  calculateYearsOfService,
  getCurrentVacationPeriod,
  getNthWeekdayOfMonth,
  getEasterDates,
  getMexicanHolidays2026,
  isHoliday,
  getHolidayName
};