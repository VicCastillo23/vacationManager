const {
  calculateVacationDays,
  calculateYearsOfService,
  getCurrentVacationPeriod,
  getNthWeekdayOfMonth,
  getEasterDates,
  getMexicanHolidays2026,
  isHoliday,
  getHolidayName
} = require('../../lib/helpers');

const TODAY = new Date('2026-03-27T00:00:00.000Z');
const ORIGINAL_DATE = global.Date;

beforeEach(() => {
  global.Date = class extends ORIGINAL_DATE {
    constructor(...args) {
      if (args.length === 0) return TODAY;
      return new ORIGINAL_DATE(...args);
    }
    static now() {
      return TODAY.getTime();
    }
  };
});

afterAll(() => {
  global.Date = ORIGINAL_DATE;
});

describe('calculateVacationDays', () => {
  test('Menos de 1 año: 12 días', () => {
    const result = calculateVacationDays('2025-12-01', TODAY);
    expect(result).toBe(12);
  });

  test('1 año exacto: 12 días', () => {
    const result = calculateVacationDays('2025-03-27', TODAY);
    expect(result).toBe(12);
  });

  test('2 años: 16 días', () => {
    const result = calculateVacationDays('2024-03-26', TODAY);
    expect(result).toBe(16);
  });

  test('3 años: 18 días', () => {
    const result = calculateVacationDays('2023-03-27', TODAY);
    expect(result).toBe(18);
  });

  test('4 años: 20 días', () => {
    const result = calculateVacationDays('2022-03-27', TODAY);
    expect(result).toBe(20);
  });

  test('5 años: 22 días', () => {
    const result = calculateVacationDays('2021-03-26', TODAY);
    expect(result).toBe(22);
  });

  test('6-9 años: 24 días', () => {
    expect(calculateVacationDays('2017-03-27', TODAY)).toBe(24);
    expect(calculateVacationDays('2019-03-27', TODAY)).toBe(24);
    expect(calculateVacationDays('2019-03-26', TODAY)).toBe(24);
  });

  test('10-14 años: 26 días', () => {
    expect(calculateVacationDays('2016-03-26', TODAY)).toBe(26);
    expect(calculateVacationDays('2015-03-26', TODAY)).toBe(26);
  });

  test('15-19 años: 28 días', () => {
    expect(calculateVacationDays('2011-03-27', TODAY)).toBe(28);
    expect(calculateVacationDays('2007-03-27', TODAY)).toBe(28);
  });

  test('20-24 años: 30 días', () => {
    expect(calculateVacationDays('2006-03-27', TODAY)).toBe(30);
    expect(calculateVacationDays('2002-03-27', TODAY)).toBe(30);
  });

  test('25-29 años: 32 días', () => {
    expect(calculateVacationDays('2000-03-27', TODAY)).toBe(32);
    expect(calculateVacationDays('1997-03-27', TODAY)).toBe(32);
  });

  test('30+ años: 34 días', () => {
    expect(calculateVacationDays('1995-03-27', TODAY)).toBe(34);
    expect(calculateVacationDays('1990-03-27', TODAY)).toBe(34);
    expect(calculateVacationDays('1985-03-27', TODAY)).toBe(34);
  });
});

describe('calculateYearsOfService', () => {
  test('0-1 año', () => {
    expect(calculateYearsOfService('2025-12-01', TODAY)).toBe(0);
  });

  test('1-5 años', () => {
    expect(calculateYearsOfService('2025-03-26', TODAY)).toBe(1);
    expect(calculateYearsOfService('2021-03-26', TODAY)).toBe(5);
  });

  test('10-30 años', () => {
    expect(calculateYearsOfService('2016-03-26', TODAY)).toBe(10);
    expect(calculateYearsOfService('2006-03-26', TODAY)).toBe(20);
    expect(calculateYearsOfService('1996-03-26', TODAY)).toBe(30);
  });
});

describe('getCurrentVacationPeriod', () => {
  test('Contrato hace 1 año', () => {
    const result = getCurrentVacationPeriod('2025-03-15', TODAY);
    expect(result.periodStart).toBe('2026-03-15');
    expect(result.periodEnd).toBe('2027-03-14');
  });

  test('Contrato hace 2 años', () => {
    const result = getCurrentVacationPeriod('2024-03-15', TODAY);
    expect(result.periodStart).toBe('2026-03-15');
    expect(result.periodEnd).toBe('2027-03-14');
  });
});

describe('getNthWeekdayOfMonth', () => {
  test('Primer lunes de enero 2026', () => {
    const result = getNthWeekdayOfMonth(2026, 0, 1, 1);
    expect(result).toBe('2026-01-05');
  });

  test('Tercer lunes de marzo 2026', () => {
    const result = getNthWeekdayOfMonth(2026, 2, 1, 3);
    expect(result).toBe('2026-03-16');
  });

  test('Tercer lunes de noviembre 2026', () => {
    const result = getNthWeekdayOfMonth(2026, 10, 1, 3);
    expect(result).toBe('2026-11-16');
  });
});

describe('getEasterDates', () => {
  test('Calcular Semana Santa 2026', () => {
    const result = getEasterDates(2026);
    expect(result.jueves).toBeTruthy();
    expect(result.viernes).toBeTruthy();
    expect(result.jueves).not.toBe(result.viernes);
  });

  test('Calcular Semana Santa 2025', () => {
    const result = getEasterDates(2025);
    expect(result.jueves).toBe('2025-04-17');
    expect(result.viernes).toBe('2025-04-18');
  });

  test('Calcular Semana Santa 2024', () => {
    const result = getEasterDates(2024);
    expect(result.jueves).toBe('2024-03-28');
    expect(result.viernes).toBe('2024-03-29');
  });

  test('Calcular Semana Santa 2027', () => {
    const result = getEasterDates(2027);
    expect(result.jueves).toBe('2027-03-25');
    expect(result.viernes).toBe('2027-03-26');
  });
});

describe('getMexicanHolidays2026', () => {
  test('Retornar 11 días festivos', () => {
    const holidays = getMexicanHolidays2026();
    expect(holidays).toHaveLength(11);
  });

  test('Incluir días festivos fijos', () => {
    const holidays = getMexicanHolidays2026();
    expect(holidays.some(h => h.date === '2026-01-01')).toBe(true);
    expect(holidays.some(h => h.date === '2026-05-01')).toBe(true);
    expect(holidays.some(h => h.date === '2026-12-25')).toBe(true);
  });

  test('Incluir días móviles calculados', () => {
    const holidays = getMexicanHolidays2026();
    expect(holidays.some(h => h.name === 'Día de la Constitución Mexicana')).toBe(true);
    expect(holidays.some(h => h.name === 'Natalicio de Benito Juárez')).toBe(true);
    expect(holidays.some(h => h.name === 'Jueves Santo')).toBe(true);
    expect(holidays.some(h => h.name === 'Viernes Santo')).toBe(true);
    expect(holidays.some(h => h.name === 'Día de la Revolución Mexicana')).toBe(true);
  });
});

describe('isHoliday', () => {
  test('Días festivos fijos reconocidos', () => {
    expect(isHoliday('2026-01-01')).toBe(true);
    expect(isHoliday('2026-05-01')).toBe(true);
    expect(isHoliday('2026-09-16')).toBe(true);
    expect(isHoliday('2026-12-25')).toBe(true);
  });

  test('Día normal no es festivo', () => {
    expect(isHoliday('2026-03-27')).toBe(false);
    expect(isHoliday('2026-06-15')).toBe(false);
  });

  test('Días festivos móviles reconocidos', () => {
    expect(isHoliday('2026-02-02')).toBe(true);
    expect(isHoliday('2026-03-16')).toBe(true);
  });
});

describe('getHolidayName', () => {
  test('Nombres de días festivos fijos', () => {
    expect(getHolidayName('2026-01-01')).toBe('Año Nuevo');
    expect(getHolidayName('2026-05-01')).toBe('Día del Trabajo');
    expect(getHolidayName('2026-09-16')).toBe('Día de la Independencia');
    expect(getHolidayName('2026-12-25')).toBe('Navidad');
  });

  test('Nombres de días festivos móviles', () => {
    expect(getHolidayName('2026-02-02')).toBe('Día de la Constitución Mexicana');
    expect(getHolidayName('2026-03-16')).toBe('Natalicio de Benito Juárez');
    expect(getHolidayName('2026-11-16')).toBe('Día de la Revolución Mexicana');
  });

  test('Nombres de Semana Santa', () => {
    expect(getHolidayName('2026-04-02')).toBe('Jueves Santo');
    expect(getHolidayName('2026-04-03')).toBe('Viernes Santo');
  });

  test('Nombres de días normales es null', () => {
    expect(getHolidayName('2026-03-27')).toBe(null);
  });

  test('Otros días festivos', () => {
    expect(getHolidayName('2026-11-02')).toBe('Día de Muertos');
    expect(getHolidayName('2026-12-12')).toBe('Virgen de Guadalupe');
  });
});