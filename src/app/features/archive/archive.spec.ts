import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { vi } from 'vitest';
import { ContentInput } from '../../core/models/content.model';
import { ContentService } from '../../core/services/content.service';
import { APP_STORAGE } from '../../core/services/storage.service';
import { STORAGE_KEYS } from '../../core/storage-keys';
import { MemoryStorage } from '../../core/testing/memory-storage.testing';
import { Calendar } from '../calendar/calendar';
import { ContentDetail } from '../contents/content-detail/content-detail';
import { PLATFORM_LOGOS } from '../contents/content-labels';
import { Contents } from '../contents/contents';
import { Archive } from './archive';

const completedKickInput: ContentInput = {
  title: 'İstanbul Valorant Turnuvası',
  platform: 'kick',
  contentType: 'live',
  gameOrEvent: 'Valorant Işık Kupası',
  date: '2026-11-10',
  time: '21:00',
  status: 'completed',
  description: 'Büyük final yayını tamamlandı.',
  notes: 'VOD kaydı alındı.',
  team: ['GÖGÖ', 'Samurai Cat'],
  tags: ['valorant', '#şogunlar'],
};

function setControlValue(el: HTMLElement, selector: string, value: string): void {
  const input = el.querySelector(selector) as
    | HTMLInputElement
    | HTMLSelectElement
    | HTMLTextAreaElement;
  input.value = value;
  input.dispatchEvent(new Event('input'));
  input.dispatchEvent(new Event('change'));
}

describe('Archive (İçerik Arşivi & Yeniden Planlama)', () => {
  let memory: MemoryStorage;
  let harness: RouterTestingHarness;
  let contentService: ContentService;
  let router: Router;
  let el: HTMLElement;

  async function openRoute(url = '/arsiv'): Promise<void> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'arsiv', component: Archive },
          { path: 'icerikler', component: Contents },
          { path: 'icerikler/:id', component: ContentDetail },
          { path: 'takvim', component: Calendar },
        ]),
        { provide: APP_STORAGE, useValue: memory },
      ],
    }).compileComponents();

    contentService = TestBed.inject(ContentService);
    router = TestBed.inject(Router);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    harness.detectChanges();
    el = harness.routeNativeElement as HTMLElement;
  }

  beforeEach(() => {
    memory = new MemoryStorage();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should show empty archive state with safe 0% platform stats, only include completed items, and reactively enter/exit archive on status/delete changes', async () => {
    await openRoute('/arsiv');

    // Empty state & safe 0% platform distribution
    expect(el.querySelector('[data-archive-stat="total"]')?.textContent?.trim()).toBe('0');
    expect(el.querySelector('.archive-empty-state')?.textContent).toContain(
      'Henüz tamamlanmış içerik bulunmuyor. İçeriklerini tamamlandı olarak işaretlediğinde burada görebilirsin.',
    );
    for (const platform of ['kick', 'discord', 'instagram', 'tiktok'] as const) {
      const dist = el.querySelector(`[data-archive-platform="${platform}"]`)!;
      expect(dist.textContent).toContain('0 içerik');
      expect(dist.textContent).toContain('(%0)');
      expect(
        (dist.querySelector('img.platform-logo') as HTMLImageElement).getAttribute('src'),
      ).toBe(PLATFORM_LOGOS[platform]);
    }

    // Create planned, in_progress, cancelled items -> none appear in archive
    const planned = contentService.create({
      ...completedKickInput,
      title: 'Planlanan Yayın',
      status: 'planned',
    });
    contentService.create({
      ...completedKickInput,
      title: 'Devam Eden Yayın',
      status: 'in_progress',
    });
    contentService.create({
      ...completedKickInput,
      title: 'İptal Yayın',
      status: 'cancelled',
    });
    harness.detectChanges();
    expect(el.querySelector('[data-archive-stat="total"]')?.textContent?.trim()).toBe('0');
    expect(el.querySelectorAll('tbody tr').length).toBe(0);

    // Mark planned item as completed -> enters archive automatically
    if (!planned.ok) {
      throw new Error('setup failed');
    }
    contentService.update(planned.value.id, { status: 'completed' });
    harness.detectChanges();
    expect(el.querySelector('[data-archive-stat="total"]')?.textContent?.trim()).toBe('1');
    expect(el.querySelectorAll('tbody tr').length).toBe(1);
    expect(el.querySelector('tbody tr')?.textContent).toContain('Planlanan Yayın');
    expect(el.querySelector('[data-archive-platform="kick"]')?.textContent).toContain('1 içerik');
    expect(el.querySelector('[data-archive-platform="kick"]')?.textContent).toContain('(%100)');

    // Add 3 more completed items across Discord, Instagram, TikTok -> total 4 (25% each)
    contentService.create({
      ...completedKickInput,
      title: 'Discord Etkinliği',
      platform: 'discord',
      contentType: 'event',
      status: 'completed',
    });
    contentService.create({
      ...completedKickInput,
      title: 'Instagram Reels',
      platform: 'instagram',
      contentType: 'reels',
      status: 'completed',
    });
    const tiktokDone = contentService.create({
      ...completedKickInput,
      title: 'TikTok Kısa Video',
      platform: 'tiktok',
      contentType: 'short_video',
      status: 'completed',
    });
    harness.detectChanges();

    expect(el.querySelector('[data-archive-stat="total"]')?.textContent?.trim()).toBe('4');
    for (const platform of ['kick', 'discord', 'instagram', 'tiktok'] as const) {
      const dist = el.querySelector(`[data-archive-platform="${platform}"]`)!;
      expect(dist.textContent).toContain('1 içerik');
      expect(dist.textContent).toContain('(%25)');
    }

    // Change status back to planned -> exits archive without deleting record
    contentService.update(planned.value.id, { status: 'planned' });
    harness.detectChanges();
    expect(el.querySelector('[data-archive-stat="total"]')?.textContent?.trim()).toBe('3');
    expect(contentService.getById(planned.value.id)?.status).toBe('planned');

    // Delete a completed item -> disappears from archive
    if (tiktokDone.ok) {
      contentService.delete(tiktokDone.value.id);
      harness.detectChanges();
      expect(el.querySelector('[data-archive-stat="total"]')?.textContent?.trim()).toBe('2');
    }
  });

  it('should search, filter (platform, type, tag, date range), sort across all 6 options, clear filters, and show loadError when storage is corrupt', async () => {
    vi.useFakeTimers();
    await openRoute('/arsiv');

    vi.setSystemTime(new Date('2026-01-01T10:00:00.000Z'));
    contentService.create({
      ...completedKickInput,
      title: 'Çarşamba Minecraft Yayını',
      platform: 'kick',
      contentType: 'live',
      gameOrEvent: 'Minecraft',
      date: '2026-11-10',
      time: '20:30',
      status: 'completed',
      team: ['GÖGÖ'],
      tags: ['minecraft', '#şogunlar'],
    });

    vi.setSystemTime(new Date('2026-01-03T10:00:00.000Z'));
    contentService.create({
      ...completedKickInput,
      title: 'İstanbul Özel Etkinliği',
      platform: 'discord',
      contentType: 'event',
      gameOrEvent: 'Işık Festivali',
      date: '2026-11-15',
      time: '22:00',
      status: 'completed',
      team: ['Batu'],
      tags: ['etkinlik'],
    });

    vi.setSystemTime(new Date('2026-01-02T10:00:00.000Z'));
    contentService.create({
      ...completedKickInput,
      title: 'Açılış Reels Videosu',
      platform: 'instagram',
      contentType: 'reels',
      gameOrEvent: 'Valorant',
      date: '2026-11-05',
      time: '19:00',
      status: 'completed',
      team: ['Samurai Cat'],
      tags: ['kesit'],
    });

    // Also add a planned item with matching query to ensure non-completed items never leak into archive search
    contentService.create({
      ...completedKickInput,
      title: 'Planlanan Minecraft Yayını',
      status: 'planned',
      tags: ['minecraft'],
    });
    harness.detectChanges();

    const getRowTitles = () =>
      Array.from(el.querySelectorAll('tbody tr .title-cell')).map((c) => c.textContent?.trim());

    // Default sort: date_desc
    expect(getRowTitles()).toEqual([
      'İstanbul Özel Etkinliği',
      'Çarşamba Minecraft Yayını',
      'Açılış Reels Videosu',
    ]);

    // Test all 6 sort options
    setControlValue(el, '#archive-sort', 'date_asc');
    harness.detectChanges();
    expect(getRowTitles()).toEqual([
      'Açılış Reels Videosu',
      'Çarşamba Minecraft Yayını',
      'İstanbul Özel Etkinliği',
    ]);

    setControlValue(el, '#archive-sort', 'created_desc');
    harness.detectChanges();
    expect(getRowTitles()).toEqual([
      'İstanbul Özel Etkinliği',
      'Açılış Reels Videosu',
      'Çarşamba Minecraft Yayını',
    ]);

    setControlValue(el, '#archive-sort', 'created_asc');
    harness.detectChanges();
    expect(getRowTitles()).toEqual([
      'Çarşamba Minecraft Yayını',
      'Açılış Reels Videosu',
      'İstanbul Özel Etkinliği',
    ]);

    setControlValue(el, '#archive-sort', 'title_asc');
    harness.detectChanges();
    expect(getRowTitles()).toEqual([
      'Açılış Reels Videosu',
      'Çarşamba Minecraft Yayını',
      'İstanbul Özel Etkinliği',
    ]);

    setControlValue(el, '#archive-sort', 'title_desc');
    harness.detectChanges();
    expect(getRowTitles()).toEqual([
      'İstanbul Özel Etkinliği',
      'Çarşamba Minecraft Yayını',
      'Açılış Reels Videosu',
    ]);

    // Search with Turkish case-insensitivity ('istanbul', 'ışık', 'batu', '#şogunlar')
    setControlValue(el, '#archive-query', 'istanbul');
    harness.detectChanges();
    expect(getRowTitles()).toEqual(['İstanbul Özel Etkinliği']);

    setControlValue(el, '#archive-query', 'ışık');
    harness.detectChanges();
    expect(getRowTitles()).toEqual(['İstanbul Özel Etkinliği']);

    setControlValue(el, '#archive-query', 'batu');
    harness.detectChanges();
    expect(getRowTitles()).toEqual(['İstanbul Özel Etkinliği']);

    // Combined filter: query + platform + type + tag + date range
    setControlValue(el, '#archive-query', 'Minecraft');
    setControlValue(el, '#archive-platform', 'kick');
    setControlValue(el, '#archive-type', 'live');
    setControlValue(el, '#archive-tag', '#şogunlar');
    setControlValue(el, '#archive-from', '2026-11-01');
    setControlValue(el, '#archive-to', '2026-11-12');
    harness.detectChanges();
    expect(getRowTitles()).toEqual(['Çarşamba Minecraft Yayını']);
    expect(el.querySelector('.result-summary')?.textContent).toContain(
      '3 tamamlanan içerikten 1 tanesi gösteriliyor.',
    );

    // Invalid date range shows warning and filter empty state
    setControlValue(el, '#archive-from', '2026-11-20');
    harness.detectChanges();
    expect(el.querySelector('#archive-date-range-error')?.textContent).toContain(
      'Başlangıç tarihi, bitiş tarihinden sonra olamaz.',
    );
    expect(el.querySelector('.filter-empty-state')?.textContent).toContain(
      'Arama ve filtrelerine uygun tamamlanmış içerik bulunamadı.',
    );

    // Clear filters restores all 3 completed items
    (el.querySelector('#clear-archive-filters') as HTMLButtonElement).click();
    harness.detectChanges();
    expect(el.querySelectorAll('tbody tr').length).toBe(3);

    // Corrupt storage shows loadError alert instead of empty archive or false 0 stats
    memory.setItem(STORAGE_KEYS.contents, '{bozuk-arsiv');
    contentService.reload();
    harness.detectChanges();
    expect(el.querySelector('.load-error')?.textContent).toContain(
      'Arşiv verileri yüklenemedi. Mevcut kayıtlarının korunması için veri işlemleri durduruldu.',
    );
    expect(el.querySelector('[data-archive-stat="total"]')).toBeNull();
    expect(el.querySelector('.archive-empty-state')).toBeNull();
  });

  it('should persist archive filters in URL query params and navigate to detail page with ← Arşive Dön link preserving filters', async () => {
    await openRoute('/arsiv');
    const created = contentService.create(completedKickInput);
    if (!created.ok) {
      throw new Error('create failed');
    }

    // Navigate with URL query params (simulating F5 reload)
    await harness.navigateByUrl('/arsiv?q=Valorant&platform=kick&sort=title_asc');
    harness.detectChanges();
    el = harness.routeNativeElement as HTMLElement;

    expect((el.querySelector('#archive-query') as HTMLInputElement).value).toBe('Valorant');
    expect((el.querySelector('#archive-platform') as HTMLSelectElement).value).toBe('kick');
    expect((el.querySelector('#archive-sort') as HTMLSelectElement).value).toBe('title_asc');

    const detailLink = el.querySelector('a[aria-label*="detaylarını gör"]') as HTMLAnchorElement;
    const detailHref = detailLink.getAttribute('href')!;
    expect(detailHref).toContain(`/icerikler/${created.value.id}`);
    expect(detailHref).toContain('kaynak=arsiv');
    expect(detailHref).toContain('q=Valorant');
    expect(detailHref).toContain('platform=kick');

    await harness.navigateByUrl(detailHref);
    harness.detectChanges();
    const detailEl = harness.routeNativeElement as HTMLElement;

    const backArchiveLink = detailEl.querySelector('a.back-archive-link') as HTMLAnchorElement;
    expect(backArchiveLink).toBeTruthy();
    expect(backArchiveLink.textContent).toContain('← Arşive Dön');
    expect(backArchiveLink.getAttribute('href')).toContain('/arsiv');
    expect(backArchiveLink.getAttribute('href')).toContain('q=Valorant');
    expect(backArchiveLink.getAttribute('href')).toContain('platform=kick');
    expect(backArchiveLink.getAttribute('href')).toContain('sort=title_asc');
  });

  it('should reschedule a completed archive item as a brand-new planned item without modifying the original completed record, and reject invalid/non-completed source IDs', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-10T18:00:00.000Z'));
    await openRoute('/arsiv');

    const original = contentService.create(completedKickInput);
    const plannedItem = contentService.create({
      ...completedKickInput,
      title: 'Henüz Tamamlanmamış Yayın',
      status: 'planned',
    });
    if (!original.ok || !plannedItem.ok) {
      throw new Error('setup failed');
    }
    const snapshotBefore = JSON.parse(JSON.stringify(original.value));
    harness.detectChanges();

    // 1. Invalid source ID is rejected with Turkish warning
    await harness.navigateByUrl('/icerikler?yenidenPlanla=olmayan-id');
    await harness.fixture.whenStable();
    harness.detectChanges();
    el = harness.routeNativeElement as HTMLElement;
    expect(el.querySelector('app-content-form')).toBeNull();
    expect(el.querySelector('.reschedule-error')?.textContent).toContain(
      'Yeniden planlanacak arşiv içeriği bulunamadı.',
    );
    expect(router.url).not.toContain('yenidenPlanla=');

    // 2. Non-completed source ID is rejected with Turkish warning
    await harness.navigateByUrl(`/icerikler?yenidenPlanla=${plannedItem.value.id}`);
    await harness.fixture.whenStable();
    harness.detectChanges();
    el = harness.routeNativeElement as HTMLElement;
    expect(el.querySelector('app-content-form')).toBeNull();
    expect(el.querySelector('.reschedule-error')?.textContent).toContain(
      'Yalnızca tamamlanmış arşiv içerikleri yeniden planlanabilir.',
    );

    // 3. Valid completed item opens reschedule form with pre-filled fields, status='planned', and empty date
    await harness.navigateByUrl(`/icerikler?yenidenPlanla=${original.value.id}`);
    harness.detectChanges();
    el = harness.routeNativeElement as HTMLElement;

    expect(el.querySelector('.form-heading')?.textContent).toContain('İçeriği Yeniden Planla');
    expect(el.querySelector('button[type="submit"]')?.textContent).toContain('Yeni Plan Oluştur');
    expect((el.querySelector('#content-title') as HTMLInputElement).value).toBe(
      original.value.title,
    );
    expect((el.querySelector('#content-platform') as HTMLSelectElement).value).toBe('kick');
    expect((el.querySelector('#content-type') as HTMLSelectElement).value).toBe('live');
    expect((el.querySelector('#content-game') as HTMLInputElement).value).toBe(
      'Valorant Işık Kupası',
    );
    expect((el.querySelector('#content-date') as HTMLInputElement).value).toBe('');
    expect((el.querySelector('#content-time') as HTMLInputElement).value).toBe('21:00');
    expect((el.querySelector('#content-status') as HTMLSelectElement).value).toBe('planned');
    expect((el.querySelector('#content-team') as HTMLInputElement).value).toBe(
      'GÖGÖ, Samurai Cat',
    );
    expect((el.querySelector('#content-tags') as HTMLInputElement).value).toBe(
      'valorant, #şogunlar',
    );

    // 4. Submitting without choosing a new date fails validation and does not create a record
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    harness.detectChanges();
    expect(el.querySelector('#date-error')?.textContent).toContain('Geçerli bir tarih seçmelisin.');
    expect(contentService.getAll().length).toBe(2);

    // 5. Cancel does not create a record and cleans up query param
    const cancelBtn = Array.from(el.querySelectorAll('.form-actions button')).find((b) =>
      b.textContent?.includes('Vazgeç'),
    ) as HTMLButtonElement;
    cancelBtn.click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(el.querySelector('app-content-form')).toBeNull();
    expect(contentService.getAll().length).toBe(2);
    expect(router.url).not.toContain('yenidenPlanla=');

    // 6. Re-open reschedule form, modify team/tags & pick new date, verify storage error safety first, then save
    vi.setSystemTime(new Date('2026-11-15T20:00:00.000Z'));
    await harness.navigateByUrl(`/icerikler?yenidenPlanla=${original.value.id}`);
    harness.detectChanges();
    el = harness.routeNativeElement as HTMLElement;

    setControlValue(el, '#content-date', '2026-11-28');
    setControlValue(el, '#content-time', '22:00');
    setControlValue(el, '#content-team', 'GÖGÖ, Yeni Üye');
    setControlValue(el, '#content-tags', 'valorant, yeni_tur');

    // Storage failure keeps form open and does not corrupt original
    memory.failOnSet = new DOMException('full', 'QuotaExceededError');
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    harness.detectChanges();
    expect(el.querySelector('app-content-form .alert-danger')?.textContent).toContain(
      'İçerikler kaydedilemedi',
    );
    expect(contentService.getAll().length).toBe(2);

    // Succeeds when storage works
    memory.failOnSet = null;
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(contentService.getAll().length).toBe(3);
    expect(router.url).not.toContain('yenidenPlanla=');

    // Verify original completed record is 100% untouched
    const storedOriginal = contentService.getById(original.value.id)!;
    expect(storedOriginal).toEqual(snapshotBefore);

    // Verify newly created record has new ID, new timestamps, status='planned', and independent arrays
    const newRecord = contentService
      .getAll()
      .find((i) => i.id !== original.value.id && i.id !== plannedItem.value.id)!;
    expect(newRecord).toBeTruthy();
    expect(newRecord.id).not.toBe(original.value.id);
    expect(newRecord.status).toBe('planned');
    expect(newRecord.date).toBe('2026-11-28');
    expect(newRecord.time).toBe('22:00');
    expect(newRecord.createdAt).toBe('2026-11-15T20:00:00.000Z');
    expect(newRecord.updatedAt).toBe('2026-11-15T20:00:00.000Z');
    expect(newRecord.team).toEqual(['GÖGÖ', 'Yeni Üye']);
    expect(newRecord.tags).toEqual(['valorant', 'yeni_tur']);
    expect(newRecord.team).not.toBe(storedOriginal.team);
    expect(newRecord.tags).not.toBe(storedOriginal.tags);

    // 7. New planned record appears in Calendar on 2026-11-28, NOT in Archive yet
    await harness.navigateByUrl('/takvim?ay=2026-11&gun=2026-11-28');
    harness.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain('İstanbul Valorant Turnuvası');

    await harness.navigateByUrl('/arsiv');
    harness.detectChanges();
    expect(
      harness.routeNativeElement?.querySelector('[data-archive-stat="total"]')?.textContent?.trim(),
    ).toBe('1');

    // 8. When new record is later marked completed, both appear in Archive as separate records
    contentService.update(newRecord.id, { status: 'completed' });
    harness.detectChanges();
    expect(
      harness.routeNativeElement?.querySelector('[data-archive-stat="total"]')?.textContent?.trim(),
    ).toBe('2');
  });
});
