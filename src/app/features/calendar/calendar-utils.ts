import { Params } from '@angular/router';
import { ContentItem, isValidDate } from '../../core/models/content.model';

export const TURKISH_MONTHS: readonly string[] = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
];

export const WEEKDAY_HEADERS: readonly string[] = [
  'Pzt',
  'Sal',
  'Çar',
  'Per',
  'Cum',
  'Cmt',
  'Paz',
];

export const MAX_CELL_PREVIEWS = 2;

export interface CalendarCell {
  date: string;
  yearMonth: string;
  dayNumber: number;
  inCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  items: ContentItem[];
  previewItems: ContentItem[];
  overflowCount: number;
  completedCount: number;
  ariaLabel: string;
}

export interface CalendarViewState {
  month: string;
  selectedDate: string;
}

export function isValidYearMonth(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month] = value.split('-').map(Number);
  return year >= 1900 && year <= 9999 && month >= 1 && month <= 12;
}

export function formatLocalDate(date: Date): string {
  // toISOString kullanma; UTC kaynaklı gün kaymasını önle.
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatYearMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function parseYearMonth(yearMonth: string): { year: number; month: number } {
  const [year, month] = yearMonth.split('-').map(Number);
  return { year, month };
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function formatMonthTitle(yearMonth: string): string {
  if (!isValidYearMonth(yearMonth)) {
    return yearMonth;
  }
  const { year, month } = parseYearMonth(yearMonth);
  return `${TURKISH_MONTHS[month - 1]} ${year}`;
}

export function formatFullTurkishDate(dateStr: string): string {
  if (!isValidDate(dateStr)) {
    return dateStr;
  }
  const [year, month, day] = dateStr.split('-').map(Number);
  return `${day} ${TURKISH_MONTHS[month - 1]} ${year}`;
}

export function shiftYearMonth(yearMonth: string, deltaMonths: number): string {
  const { year, month } = parseYearMonth(yearMonth);
  const shifted = new Date(year, month - 1 + deltaMonths, 1);
  return formatYearMonth(shifted.getFullYear(), shifted.getMonth() + 1);
}

export function defaultSelectedDateForMonth(yearMonth: string, todayStr: string): string {
  if (todayStr.startsWith(`${yearMonth}-`) && isValidDate(todayStr)) {
    return todayStr;
  }
  return `${yearMonth}-01`;
}

export function getItemsForDate(
  items: readonly ContentItem[],
  dateStr: string,
): ContentItem[] {
  return items
    .filter((item) => item.date === dateStr)
    .slice()
    .sort(
      (a, b) =>
        a.time.localeCompare(b.time) ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.id.localeCompare(b.id),
    );
}

export function buildCalendarGrid(
  yearMonth: string,
  items: readonly ContentItem[],
  todayStr: string,
  selectedDate: string,
): CalendarCell[] {
  const { year, month } = parseYearMonth(yearMonth);
  const firstOfMonth = new Date(year, month - 1, 1);
  // Pazartesi başlangıçlı hafta.
  const leadingDays = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = getDaysInMonth(year, month);
  const totalCells = Math.max(35, Math.ceil((leadingDays + daysInMonth) / 7) * 7);

  const itemsByDate = new Map<string, ContentItem[]>();
  for (const item of items) {
    const existing = itemsByDate.get(item.date);
    if (existing) {
      existing.push(item);
    } else {
      itemsByDate.set(item.date, [item]);
    }
  }
  for (const [dateKey, list] of itemsByDate.entries()) {
    itemsByDate.set(
      dateKey,
      list
        .slice()
        .sort(
          (a, b) =>
            a.time.localeCompare(b.time) ||
            a.createdAt.localeCompare(b.createdAt) ||
            a.id.localeCompare(b.id),
        ),
    );
  }

  const cells: CalendarCell[] = [];
  for (let i = 0; i < totalCells; i++) {
    const cellDate = new Date(year, month - 1, 1 - leadingDays + i);
    const dateStr = formatLocalDate(cellDate);
    const cellYearMonth = dateStr.slice(0, 7);
    const dayNumber = cellDate.getDate();
    const inCurrentMonth = cellYearMonth === yearMonth;
    const isToday = dateStr === todayStr;
    const isSelected = dateStr === selectedDate;
    const dayItems = itemsByDate.get(dateStr) ?? [];
    const previewItems = dayItems.slice(0, MAX_CELL_PREVIEWS);
    const overflowCount = Math.max(0, dayItems.length - MAX_CELL_PREVIEWS);
    const completedCount = dayItems.filter((item) => item.status === 'completed').length;

    const countText = dayItems.length > 0 ? `${dayItems.length} içerik` : 'içerik yok';
    const completedSuffix = completedCount > 0 ? `, ${completedCount} tamamlandı` : '';
    const todaySuffix = isToday ? ', bugün' : '';
    const ariaLabel = `${formatFullTurkishDate(dateStr)}, ${countText}${completedSuffix}${todaySuffix}`;

    cells.push({
      date: dateStr,
      yearMonth: cellYearMonth,
      dayNumber,
      inCurrentMonth,
      isToday,
      isSelected,
      items: dayItems,
      previewItems,
      overflowCount,
      completedCount,
      ariaLabel,
    });
  }

  return cells;
}

export function resolveCalendarStateFromParams(
  params: Params,
  today: Date = new Date(),
): CalendarViewState {
  const todayStr = formatLocalDate(today);
  const todayMonth = todayStr.slice(0, 7);

  const rawMonth = params['ay'];
  const rawDate = params['gun'];
  const validMonth = isValidYearMonth(rawMonth) ? rawMonth : null;
  const validDate = isValidDate(rawDate) ? rawDate : null;

  if (validMonth && validDate) {
    if (validDate.startsWith(`${validMonth}-`)) {
      return { month: validMonth, selectedDate: validDate };
    }
    return {
      month: validMonth,
      selectedDate: defaultSelectedDateForMonth(validMonth, todayStr),
    };
  }

  if (validDate) {
    return {
      month: validDate.slice(0, 7),
      selectedDate: validDate,
    };
  }

  if (validMonth) {
    return {
      month: validMonth,
      selectedDate: defaultSelectedDateForMonth(validMonth, todayStr),
    };
  }

  return {
    month: todayMonth,
    selectedDate: todayStr,
  };
}
