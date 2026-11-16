import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { ContentInput } from '../../core/models/content.model';
import { ContentService } from '../../core/services/content.service';
import { APP_STORAGE } from '../../core/services/storage.service';
import { TodoService } from '../../core/services/todo.service';
import { STORAGE_KEYS } from '../../core/storage-keys';
import { MemoryStorage } from '../../core/testing/memory-storage.testing';
import { ContentDetail } from '../contents/content-detail/content-detail';
import { PLATFORM_LOGOS } from '../contents/content-labels';
import { Contents } from '../contents/contents';
import { Calendar } from './calendar';
import {
  WEEKDAY_HEADERS,
  buildCalendarGrid,
  formatFullTurkishDate,
  formatMonthTitle,
  getDaysInMonth,
  getItemsForDate,
  resolveCalendarStateFromParams,
  shiftYearMonth,
} from './calendar-utils';

const sampleKick: ContentInput = {
  title: 'Akşam Kick Yayını',
  platform: 'kick',
  contentType: 'live',
  gameOrEvent: 'Valorant',
  date: '2026-11-21',
  time: '21:00',
  status: 'planned',
  tags: ['valorant', '#şogunlar'],
  team: ['GÖGÖ'],
};

describe('Calendar & CalendarUtils', () => {
  let memory: MemoryStorage;
  let harness: RouterTestingHarness;
  let component: Calendar;
  let el: HTMLElement;
  let contentService: ContentService;
  let router: Router;

  const fixedToday = new Date(2026, 10, 15, 14, 0); // 15 Kasım 2026

  async function openCalendar(url = '/takvim'): Promise<void> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'takvim', component: Calendar },
          { path: 'icerikler', component: Contents },
          { path: 'icerikler/:id', component: ContentDetail },
        ]),
        { provide: APP_STORAGE, useValue: memory },
      ],
    }).compileComponents();

    contentService = TestBed.inject(ContentService);
    router = TestBed.inject(Router);
    harness = await RouterTestingHarness.create();
    component = await harness.navigateByUrl(url, Calendar);
    component.setReferenceToday(fixedToday);
    harness.detectChanges();
    el = harness.routeNativeElement as HTMLElement;
  }

  beforeEach(() => {
    memory = new MemoryStorage();
  });

  it('should compute weekday headers starting on Monday, days in 28/29/30/31-day months, leading/trailing cells, and year transitions', () => {
    // 1. Monday-first weekday headers
    expect(WEEKDAY_HEADERS).toEqual(['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']);

    // 2. 31-day months (Jan, Dec)
    expect(getDaysInMonth(2026, 1)).toBe(31);
    expect(getDaysInMonth(2026, 12)).toBe(31);

    // 3. 30-day months (Apr, Nov)
    expect(getDaysInMonth(2026, 4)).toBe(30);
    expect(getDaysInMonth(2026, 11)).toBe(30);

    // 4. Normal February (28 days)
    expect(getDaysInMonth(2026, 2)).toBe(28);
    const feb2026Cells = buildCalendarGrid('2026-02', [], '2026-02-10', '2026-02-10');
    expect(feb2026Cells.filter((c) => c.inCurrentMonth).length).toBe(28);

    // 5. Leap year February (29 days)
    expect(getDaysInMonth(2028, 2)).toBe(29);
    const feb2028Cells = buildCalendarGrid('2028-02', [], '2028-02-10', '2028-02-10');
    expect(feb2028Cells.filter((c) => c.inCurrentMonth).length).toBe(29);
    expect(feb2028Cells.some((c) => c.date === '2028-02-29' && c.inCurrentMonth)).toBe(true);

    // 6. Leading & trailing cells for November 2026 (2026-11-01 is Sunday -> 6 leading days from Oct)
    const nov2026Cells = buildCalendarGrid('2026-11', [], '2026-11-15', '2026-11-15');
    expect(nov2026Cells.length).toBe(42);
    expect(nov2026Cells[0].date).toBe('2026-10-26');
    expect(nov2026Cells[0].inCurrentMonth).toBe(false);
    expect(nov2026Cells[6].date).toBe('2026-11-01');
    expect(nov2026Cells[6].inCurrentMonth).toBe(true);
    expect(nov2026Cells[35].date).toBe('2026-11-30');
    expect(nov2026Cells[35].inCurrentMonth).toBe(true);
    expect(nov2026Cells[36].date).toBe('2026-12-01');
    expect(nov2026Cells[36].inCurrentMonth).toBe(false);

    // 7 & 8. Dec <-> Jan year transitions and Turkish titles
    expect(shiftYearMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftYearMonth('2026-01', -1)).toBe('2025-12');
    expect(formatMonthTitle('2026-11')).toBe('Kasım 2026');
    expect(formatFullTurkishDate('2026-11-21')).toBe('21 Kasım 2026');
  });

  it('should display items in their day cells, sort same-day items by time asc without mutating source array, and show 2 previews + overflow badge', async () => {
    await openCalendar('/takvim?ay=2026-11&gun=2026-11-21');

    // Add 4 items on 2026-11-21 in non-chronological order across all 4 statuses & platforms
    contentService.create({
      ...sampleKick,
      title: 'Gece Kapanış Yayını',
      platform: 'kick',
      contentType: 'live',
      date: '2026-11-21',
      time: '23:30',
      status: 'completed',
    });
    contentService.create({
      ...sampleKick,
      title: 'Sabah Kısa Video',
      platform: 'tiktok',
      contentType: 'short_video',
      date: '2026-11-21',
      time: '11:00',
      status: 'planned',
    });
    contentService.create({
      ...sampleKick,
      title: 'Akşamüstü Reels',
      platform: 'instagram',
      contentType: 'reels',
      date: '2026-11-21',
      time: '18:30',
      status: 'in_progress',
    });
    contentService.create({
      ...sampleKick,
      title: 'Discord Sohbet Etkinliği',
      platform: 'discord',
      contentType: 'event',
      date: '2026-11-21',
      time: '21:00',
      status: 'cancelled',
      tags: ['discord', '#şogunlar'],
    });

    const originalOrderIds = contentService.getAll().map((i) => i.id);
    harness.detectChanges();

    // Check day cell for 2026-11-21: 2 previews + "+2 içerik" overflow badge
    const dayCell = el.querySelector('.calendar-cell[data-date="2026-11-21"]') as HTMLButtonElement;
    expect(dayCell).toBeTruthy();
    expect(dayCell.getAttribute('aria-pressed')).toBe('true');
    expect(dayCell.getAttribute('aria-label')).toContain('21 Kasım 2026, 4 içerik');

    const previews = Array.from(dayCell.querySelectorAll('.cell-preview-title')).map((n) =>
      n.textContent?.trim(),
    );
    expect(previews).toEqual(['Sabah Kısa Video', 'Akşamüstü Reels']);
    expect(dayCell.querySelector('.cell-overflow-badge')?.textContent?.trim()).toBe('+2 içerik');

    // Check daily list heading and time-sorted items (all 4 statuses and platform logos shown)
    expect(el.querySelector('#daily-contents-heading')?.textContent?.trim()).toBe(
      '21 Kasım 2026 — Günlük İçerikler',
    );
    const dailyTitles = Array.from(el.querySelectorAll('.daily-item .daily-item-title')).map((n) =>
      n.textContent?.trim(),
    );
    expect(dailyTitles).toEqual([
      'Sabah Kısa Video',
      'Akşamüstü Reels',
      'Discord Sohbet Etkinliği',
      'Gece Kapanış Yayını',
    ]);

    const dailyLogos = Array.from(
      el.querySelectorAll('.daily-item img.platform-logo'),
    ) as HTMLImageElement[];
    expect(dailyLogos.map((img) => img.getAttribute('src'))).toEqual([
      PLATFORM_LOGOS.tiktok,
      PLATFORM_LOGOS.instagram,
      PLATFORM_LOGOS.discord,
      PLATFORM_LOGOS.kick,
    ]);

    const dailyStatuses = Array.from(el.querySelectorAll('.daily-item .status')).map((s) =>
      s.textContent?.trim(),
    );
    expect(dailyStatuses).toEqual(['Planlandı', 'Devam Ediyor', 'İptal Edildi', 'Tamamlandı']);

    const dailyTags = Array.from(el.querySelectorAll('.daily-item .tag-badge')).map((t) =>
      t.textContent?.trim(),
    );
    expect(dailyTags).toContain('#discord');
    expect(dailyTags).toContain('#şogunlar');

    // Source array in ContentService must not be mutated
    expect(contentService.getAll().map((i) => i.id)).toEqual(originalOrderIds);
    const rawItems = contentService.getAll();
    const sortedCopy = getItemsForDate(rawItems, '2026-11-21');
    expect(sortedCopy.length).toBe(4);
    expect(rawItems.map((i) => i.id)).toEqual(originalOrderIds);
  });

  it('should update reactively on create/delete, show empty day message when no items exist for day, and show loadError alert when storage is corrupt', async () => {
    await openCalendar('/takvim?ay=2026-11&gun=2026-11-20');

    // Empty day state
    expect(el.querySelector('.daily-empty')?.textContent).toContain(
      'Bu gün için planlanmış içerik bulunmuyor.',
    );

    // Reactive create
    const created = contentService.create({
      ...sampleKick,
      title: 'Cuma Özel Yayını',
      date: '2026-11-20',
    });
    harness.detectChanges();
    expect(el.querySelector('.daily-empty')).toBeNull();
    expect(el.querySelector('.daily-item-title')?.textContent).toContain('Cuma Özel Yayını');

    // Reactive delete
    if (created.ok) {
      contentService.delete(created.value.id);
      harness.detectChanges();
      expect(el.querySelector('.daily-empty')?.textContent).toContain(
        'Bu gün için planlanmış içerik bulunmuyor.',
      );
    }

    // Corrupt storage -> loadError alert instead of empty calendar
    memory.setItem(STORAGE_KEYS.contents, '{bozuk-takvim-json');
    contentService.reload();
    harness.detectChanges();

    const alert = el.querySelector('.load-error');
    expect(alert).toBeTruthy();
    expect(alert?.textContent).toContain(
      'Takvim verileri yüklenemedi. Mevcut içerik kayıtlarının korunması için veri işlemleri durduruldu.',
    );
    expect(el.querySelector('.calendar-grid')).toBeNull();
    expect(el.querySelector('.daily-empty')).toBeNull();
  });

  it('should navigate previous/next month, return to today, select leading/trailing days, and sync/validate ay & gun query params', async () => {
    await openCalendar('/takvim');

    // Default state uses referenceToday (2026-11-15)
    expect(el.querySelector('#calendar-month-heading')?.textContent?.trim()).toBe('Kasım 2026');
    expect(el.querySelector('#daily-contents-heading')?.textContent?.trim()).toBe(
      '15 Kasım 2026 — Günlük İçerikler',
    );

    // Click another day in the same month (2026-11-21)
    const day21 = el.querySelector('.calendar-cell[data-date="2026-11-21"]') as HTMLButtonElement;
    day21.click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(router.url).toContain('ay=2026-11');
    expect(router.url).toContain('gun=2026-11-21');
    expect(el.querySelector('#daily-contents-heading')?.textContent?.trim()).toBe(
      '21 Kasım 2026 — Günlük İçerikler',
    );

    // Click "Sonraki Ay" -> December 2026 (2026-12-01)
    (el.querySelector('button[aria-label="Sonraki ay"]') as HTMLButtonElement).click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(el.querySelector('#calendar-month-heading')?.textContent?.trim()).toBe('Aralık 2026');
    expect(router.url).toContain('ay=2026-12');
    expect(router.url).toContain('gun=2026-12-01');

    // Click "Sonraki Ay" again -> January 2027 (Dec -> Jan transition)
    (el.querySelector('button[aria-label="Sonraki ay"]') as HTMLButtonElement).click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(el.querySelector('#calendar-month-heading')?.textContent?.trim()).toBe('Ocak 2027');
    expect(router.url).toContain('ay=2027-01');

    // Click "Önceki Ay" -> December 2026 (Jan -> Dec transition)
    (el.querySelector('button[aria-label="Önceki ay"]') as HTMLButtonElement).click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(el.querySelector('#calendar-month-heading')?.textContent?.trim()).toBe('Aralık 2026');

    // Click "Bugüne Dön" -> returns to November 2026 and 15 Kasım 2026
    const todayBtn = Array.from(el.querySelectorAll('.calendar-actions button')).find((b) =>
      b.textContent?.includes('Bugüne Dön'),
    ) as HTMLButtonElement;
    todayBtn.click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(el.querySelector('#calendar-month-heading')?.textContent?.trim()).toBe('Kasım 2026');
    expect(router.url).toContain('ay=2026-11');
    expect(router.url).toContain('gun=2026-11-15');

    // Click a leading outside-month day (2026-10-31 in November 2026 grid) -> switches to Ekim 2026 & 31 Ekim 2026
    const outsideOctCell = el.querySelector(
      '.calendar-cell[data-date="2026-10-31"]',
    ) as HTMLButtonElement;
    expect(outsideOctCell.classList).toContain('is-outside');
    outsideOctCell.click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(el.querySelector('#calendar-month-heading')?.textContent?.trim()).toBe('Ekim 2026');
    expect(el.querySelector('#daily-contents-heading')?.textContent?.trim()).toBe(
      '31 Ekim 2026 — Günlük İçerikler',
    );
    expect(router.url).toContain('ay=2026-10');
    expect(router.url).toContain('gun=2026-10-31');

    // Invalid query params fallback safely to referenceToday
    expect(resolveCalendarStateFromParams({ ay: '2026-13', gun: '2026-02-30' }, fixedToday)).toEqual({
      month: '2026-11',
      selectedDate: '2026-11-15',
    });
    expect(resolveCalendarStateFromParams({ ay: 'gecersiz', gun: '2026-12-05' }, fixedToday)).toEqual(
      {
        month: '2026-12',
        selectedDate: '2026-12-05',
      },
    );
    expect(resolveCalendarStateFromParams({ ay: '2026-12', gun: 'gecersiz' }, fixedToday)).toEqual({
      month: '2026-12',
      selectedDate: '2026-12-01',
    });
  });

  it('should link daily items to /icerikler/:id detail page and provide plan link to /icerikler?yeni=1&tarih=YYYY-MM-DD', async () => {
    await openCalendar('/takvim?ay=2026-11&gun=2026-11-21');
    const created = contentService.create(sampleKick);
    if (!created.ok) {
      throw new Error('create failed');
    }
    harness.detectChanges();

    const detailLink = el.querySelector('.daily-item-actions a') as HTMLAnchorElement;
    expect(detailLink).toBeTruthy();
    expect(detailLink.getAttribute('href')).toContain(`/icerikler/${created.value.id}`);
    expect(detailLink.getAttribute('href')).toContain('kaynak=takvim');
    expect(detailLink.getAttribute('href')).toContain('ay=2026-11');
    expect(detailLink.getAttribute('href')).toContain('gun=2026-11-21');

    const planLink = el.querySelector('a.plan-day-link') as HTMLAnchorElement;
    expect(planLink).toBeTruthy();
    expect(planLink.getAttribute('href')).toContain('/icerikler');
    expect(planLink.getAttribute('href')).toContain('yeni=1');
    expect(planLink.getAttribute('href')).toContain('tarih=2026-11-21');
  });

  it('should show green completed checkmark only for status===completed in desktop preview, mobile badge, and daily list, react to status/delete changes, and stay independent of TodoService', async () => {
    await openCalendar('/takvim?ay=2026-11&gun=2026-11-10');
    const todoService = TestBed.inject(TodoService);

    // Past date (2026-11-10 < 2026-11-15 fixedToday) with 4 items in different statuses:
    // Item 1 (preview 1): completed -> gets green check
    const completedItem = contentService.create({
      ...sampleKick,
      title: 'Minecraft Şogunlar Yayını',
      platform: 'kick',
      contentType: 'live',
      date: '2026-11-10',
      time: '18:00',
      status: 'completed',
    });
    // Item 2 (preview 2): planned (even though date is in the past!) -> NO green check
    const plannedItem = contentService.create({
      ...sampleKick,
      title: 'Discord Topluluk Etkinliği',
      platform: 'discord',
      contentType: 'event',
      date: '2026-11-10',
      time: '20:00',
      status: 'planned',
    });
    // Item 3: in_progress -> NO green check
    contentService.create({
      ...sampleKick,
      title: 'Instagram Reels Kesiti',
      platform: 'instagram',
      contentType: 'reels',
      date: '2026-11-10',
      time: '21:30',
      status: 'in_progress',
    });
    // Item 4: cancelled -> NO green check
    contentService.create({
      ...sampleKick,
      title: 'TikTok İptal Video',
      platform: 'tiktok',
      contentType: 'short_video',
      date: '2026-11-10',
      time: '23:00',
      status: 'cancelled',
    });

    if (!completedItem.ok || !plannedItem.ok) {
      throw new Error('setup failed');
    }

    const rawBeforeRender = memory.getItem(STORAGE_KEYS.contents);
    harness.detectChanges();
    // Rendering calendar green checks must never write or mutate LocalStorage
    expect(memory.getItem(STORAGE_KEYS.contents)).toBe(rawBeforeRender);

    const dayCell = el.querySelector('.calendar-cell[data-date="2026-11-10"]') as HTMLButtonElement;
    expect(dayCell).toBeTruthy();

    // 1. Accessible day cell label distinguishes total vs completed counts
    expect(dayCell.getAttribute('aria-label')).toBe('10 Kasım 2026, 4 içerik, 1 tamamlandı');

    // 2. Mobile badges show total count (4) and completed count (✓ 1) separately
    expect(dayCell.querySelector('.cell-count-badge')?.textContent?.trim()).toBe('4');
    const mobileCompletedBadge = dayCell.querySelector('.cell-completed-badge');
    expect(mobileCompletedBadge).toBeTruthy();
    expect(mobileCompletedBadge?.textContent?.trim()).toBe('✓ 1');

    // 3. Desktop preview chips: first chip (completed) has .cell-preview-check, second chip (planned) does NOT
    const previewChips = Array.from(dayCell.querySelectorAll('.cell-preview-chip'));
    expect(previewChips.length).toBe(2);
    expect(previewChips[0].classList).toContain('is-completed');
    expect(previewChips[0].querySelector('.cell-preview-check')?.textContent?.trim()).toBe('✓');
    expect(
      previewChips[0].querySelector('.cell-preview-check')?.getAttribute('aria-label'),
    ).toBe('Tamamlandı');
    expect(previewChips[1].classList).not.toContain('is-completed');
    expect(previewChips[1].querySelector('.cell-preview-check')).toBeNull();

    // 4. Daily list items: only completed item has .daily-completed-check and status-completed
    const dailyItems = Array.from(el.querySelectorAll('.daily-item'));
    expect(dailyItems.length).toBe(4);
    expect(dailyItems[0].classList).toContain('is-completed');
    expect(dailyItems[0].querySelector('.daily-completed-check')?.textContent?.trim()).toBe('✓');
    expect(dailyItems[0].querySelector('.status')?.textContent?.trim()).toBe('Tamamlandı');

    // Planned, in_progress, cancelled items in daily list have NO .daily-completed-check
    expect(dailyItems[1].classList).not.toContain('is-completed');
    expect(dailyItems[1].querySelector('.daily-completed-check')).toBeNull();
    expect(dailyItems[2].classList).not.toContain('is-completed');
    expect(dailyItems[2].querySelector('.daily-completed-check')).toBeNull();
    expect(dailyItems[3].classList).not.toContain('is-completed');
    expect(dailyItems[3].querySelector('.daily-completed-check')).toBeNull();

    // 5. Reactive update: planned -> completed adds green check and updates mobile count to ✓ 2
    contentService.update(plannedItem.value.id, { status: 'completed' });
    harness.detectChanges();
    expect(dayCell.getAttribute('aria-label')).toBe('10 Kasım 2026, 4 içerik, 2 tamamlandı');
    expect(dayCell.querySelector('.cell-completed-badge')?.textContent?.trim()).toBe('✓ 2');
    expect(dayCell.querySelectorAll('.cell-preview-check').length).toBe(2);
    expect(el.querySelectorAll('.daily-item .daily-completed-check').length).toBe(2);

    // 6. Reactive update: completed -> planned removes green check
    contentService.update(plannedItem.value.id, { status: 'planned' });
    contentService.update(completedItem.value.id, { status: 'planned' });
    harness.detectChanges();
    expect(dayCell.getAttribute('aria-label')).toBe('10 Kasım 2026, 4 içerik');
    expect(dayCell.querySelector('.cell-completed-badge')).toBeNull();
    expect(dayCell.querySelectorAll('.cell-preview-check').length).toBe(0);
    expect(el.querySelectorAll('.daily-item .daily-completed-check').length).toBe(0);

    // 7. Re-complete and then delete completed item -> indicator disappears
    contentService.update(completedItem.value.id, { status: 'completed' });
    harness.detectChanges();
    expect(dayCell.querySelector('.cell-completed-badge')?.textContent?.trim()).toBe('✓ 1');

    contentService.delete(completedItem.value.id);
    harness.detectChanges();
    expect(dayCell.querySelector('.cell-count-badge')?.textContent?.trim()).toBe('3');
    expect(dayCell.querySelector('.cell-completed-badge')).toBeNull();
    expect(el.querySelectorAll('.daily-item .daily-completed-check').length).toBe(0);

    // 8. Completing a TODO task does NOT add green checkmarks to Calendar items
    const todo = todoService.create({ title: 'Minecraft Şogunlar Yayını' });
    if (todo.ok) {
      todoService.toggleCompleted(todo.value.id);
    }
    harness.detectChanges();
    expect(dayCell.querySelector('.cell-completed-badge')).toBeNull();
    expect(el.querySelectorAll('.daily-item .daily-completed-check').length).toBe(0);
  });
});
