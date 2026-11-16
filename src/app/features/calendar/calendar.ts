import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { ContentService } from '../../core/services/content.service';
import {
  PLATFORM_LABELS,
  PLATFORM_LOGOS,
  STATUS_LABELS,
  TYPE_LABELS,
  formatDate,
  formatTagLabel,
} from '../contents/content-labels';
import {
  CalendarCell,
  WEEKDAY_HEADERS,
  buildCalendarGrid,
  defaultSelectedDateForMonth,
  formatFullTurkishDate,
  formatLocalDate,
  formatMonthTitle,
  getItemsForDate,
  resolveCalendarStateFromParams,
  shiftYearMonth,
} from './calendar-utils';

@Component({
  selector: 'app-calendar',
  imports: [RouterLink],
  templateUrl: './calendar.html',
  styleUrl: './calendar.css',
})
export class Calendar {
  private readonly contentService = inject(ContentService);
  private readonly route = inject(ActivatedRoute, { optional: true });
  private readonly router = inject(Router, { optional: true });
  private readonly destroyRef = inject(DestroyRef);

  protected readonly items = this.contentService.items;
  protected readonly loadError = this.contentService.loadError;

  protected readonly weekdayHeaders = WEEKDAY_HEADERS;
  protected readonly platformLabels = PLATFORM_LABELS;
  protected readonly platformLogos = PLATFORM_LOGOS;
  protected readonly typeLabels = TYPE_LABELS;
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly formatDate = formatDate;
  protected readonly formatTagLabel = formatTagLabel;

  protected readonly referenceToday = signal<Date>(new Date());
  protected readonly todayStr = computed(() => formatLocalDate(this.referenceToday()));

  protected readonly currentMonth = signal<string>(this.todayStr().slice(0, 7));
  protected readonly selectedDate = signal<string>(this.todayStr());

  protected readonly monthTitle = computed(() => formatMonthTitle(this.currentMonth()));
  protected readonly selectedDateTitle = computed(() =>
    formatFullTurkishDate(this.selectedDate()),
  );

  protected readonly cells = computed(() =>
    buildCalendarGrid(
      this.currentMonth(),
      this.items(),
      this.todayStr(),
      this.selectedDate(),
    ),
  );

  protected readonly selectedDayItems = computed(() =>
    getItemsForDate(this.items(), this.selectedDate()),
  );

  constructor() {
    this.applyQueryParams(this.route?.snapshot.queryParams ?? {});
    if (this.route) {
      this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
        this.applyQueryParams(params);
      });
    }
  }

  public setReferenceToday(today: Date): void {
    this.referenceToday.set(today);
    this.applyQueryParams(this.route?.snapshot.queryParams ?? {});
  }

  protected previousMonth(): void {
    const nextMonth = shiftYearMonth(this.currentMonth(), -1);
    const nextDate = defaultSelectedDateForMonth(nextMonth, this.todayStr());
    this.updateCalendarState(nextMonth, nextDate);
  }

  protected nextMonth(): void {
    const nextMonth = shiftYearMonth(this.currentMonth(), 1);
    const nextDate = defaultSelectedDateForMonth(nextMonth, this.todayStr());
    this.updateCalendarState(nextMonth, nextDate);
  }

  protected goToToday(): void {
    const today = this.todayStr();
    this.updateCalendarState(today.slice(0, 7), today);
  }

  protected selectCell(cell: CalendarCell): void {
    this.updateCalendarState(cell.yearMonth, cell.date);
  }

  protected reload(): void {
    this.contentService.reload();
  }

  private applyQueryParams(params: Params): void {
    const resolved = resolveCalendarStateFromParams(params, this.referenceToday());
    if (this.currentMonth() !== resolved.month) {
      this.currentMonth.set(resolved.month);
    }
    if (this.selectedDate() !== resolved.selectedDate) {
      this.selectedDate.set(resolved.selectedDate);
    }
  }

  private updateCalendarState(month: string, selectedDate: string): void {
    this.currentMonth.set(month);
    this.selectedDate.set(selectedDate);
    this.syncQueryParams(month, selectedDate);
  }

  private syncQueryParams(month: string, selectedDate: string): void {
    if (!this.router || !this.route) {
      return;
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { ay: month, gun: selectedDate },
      replaceUrl: true,
    });
  }
}
