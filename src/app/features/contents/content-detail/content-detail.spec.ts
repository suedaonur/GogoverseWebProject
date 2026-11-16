import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../../app.routes';
import { ContentInput } from '../../../core/models/content.model';
import { ContentService } from '../../../core/services/content.service';
import { APP_STORAGE } from '../../../core/services/storage.service';
import { STORAGE_KEYS } from '../../../core/storage-keys';
import { MemoryStorage } from '../../../core/testing/memory-storage.testing';
import { PLATFORM_LOGOS } from '../content-labels';

const fullInput: ContentInput = {
  title: 'Valorant Şogun Turnuvası',
  platform: 'kick',
  contentType: 'live',
  gameOrEvent: 'Valorant',
  date: '2026-12-20',
  time: '21:00',
  status: 'planned',
  description: 'Takımlar arası büyük ödüllü turnuva yayını.',
  notes: 'Turnuva tablosunu yayından 15 dk önce paylaş.',
  team: ['GÖGÖ', 'Samurai Cat', 'Şogunlar'],
  tags: ['valorant', 'turnuva', 'kick'],
};

describe('ContentDetail', () => {
  let memory: MemoryStorage;
  let service: ContentService;

  beforeEach(async () => {
    memory = new MemoryStorage();
    await TestBed.configureTestingModule({
      providers: [provideRouter(routes), { provide: APP_STORAGE, useValue: memory }],
    }).compileComponents();
    service = TestBed.inject(ContentService);
  });

  it('should display content details, platform logo, description, notes, team, tags and timestamps for a valid ID', async () => {
    const created = service.create(fullInput);
    if (!created.ok) {
      throw new Error('create failed');
    }

    const harness = await RouterTestingHarness.create(`/icerikler/${created.value.id}`);
    harness.detectChanges();
    const el = harness.routeNativeElement as HTMLElement;

    expect(el.querySelector('h1.page-title')?.textContent).toContain('İçerik Detayı');
    expect(el.querySelector('#detail-heading')?.textContent).toContain('Valorant Şogun Turnuvası');
    expect(el.textContent).toContain('Kick');
    expect(el.textContent).toContain('Canlı Yayın');
    expect(el.textContent).toContain('Valorant');
    expect(el.textContent).toContain('20.12.2026');
    expect(el.textContent).toContain('21:00');
    expect(el.textContent).toContain('Planlandı');
    expect(el.textContent).toContain('Takımlar arası büyük ödüllü turnuva yayını.');
    expect(el.textContent).toContain('Turnuva tablosunu yayından 15 dk önce paylaş.');
    expect(el.textContent).toContain('GÖGÖ');
    expect(el.textContent).toContain('Samurai Cat');
    expect(el.textContent).toContain('#valorant');
    expect(el.textContent).toContain('#turnuva');

    const logo = el.querySelector('img.platform-logo') as HTMLImageElement;
    expect(logo).toBeTruthy();
    expect(logo.getAttribute('src')).toBe(PLATFORM_LOGOS.kick);
    expect(logo.getAttribute('alt')).toBe('');

    const contentsNav = Array.from(el.querySelectorAll('a.nav-item')).find((a) =>
      a.textContent?.includes('İçerikler'),
    );
    expect(contentsNav?.classList).toContain('is-active');
  });

  it('should show "Belirtilmedi" for optional fields when they are empty', async () => {
    const created = service.create({
      title: 'Kısa TikTok Videosu',
      platform: 'tiktok',
      contentType: 'short_video',
      date: '2026-12-22',
      time: '20:30',
      status: 'completed',
    });
    if (!created.ok) {
      throw new Error('create failed');
    }

    const harness = await RouterTestingHarness.create(`/icerikler/${created.value.id}`);
    harness.detectChanges();
    const el = harness.routeNativeElement as HTMLElement;

    const emptyNodes = el.querySelectorAll('.is-empty');
    expect(emptyNodes.length).toBe(5);
    emptyNodes.forEach((node) => expect(node.textContent).toContain('Belirtilmedi'));
  });

  it('should show "Aradığın içerik bulunamadı." and back link for an invalid ID', async () => {
    const harness = await RouterTestingHarness.create('/icerikler/gecersiz-id-999');
    harness.detectChanges();
    const el = harness.routeNativeElement as HTMLElement;

    expect(el.querySelector('.not-found-title')?.textContent).toContain(
      'Aradığın içerik bulunamadı.',
    );
    const backLink = el.querySelector('.not-found-card a') as HTMLAnchorElement;
    expect(backLink).toBeTruthy();
    expect(backLink.textContent).toContain('İçerik Listesine Dön');
    expect(backLink.getAttribute('href')).toBe('/icerikler');
  });

  it('should display loadError alert instead of not-found when LocalStorage has corrupt JSON', async () => {
    memory.setItem(STORAGE_KEYS.contents, '{bozuk-veri');
    service.reload();

    const harness = await RouterTestingHarness.create('/icerikler/herhangi-id');
    harness.detectChanges();
    const el = harness.routeNativeElement as HTMLElement;

    expect(el.querySelector('.load-error')).toBeTruthy();
    expect(el.querySelector('.load-error')?.textContent).toContain(
      'İçerik verileri yüklenemedi. Kayıtlarının korunması için değişiklik işlemleri durduruldu.',
    );
    expect(el.querySelector('.not-found-card')).toBeNull();
  });

  it('should preserve search and filter query parameters when navigating from list to detail and back to list', async () => {
    const first = service.create(fullInput);
    const second = service.create({
      title: 'Discord Sohbet Etkinliği',
      platform: 'discord',
      contentType: 'event',
      date: '2026-12-21',
      time: '22:00',
      status: 'completed',
      tags: ['sohbet'],
    });
    if (!first.ok || !second.ok) {
      throw new Error('setup failed');
    }

    const harness = await RouterTestingHarness.create(
      '/icerikler?q=Valorant&platform=kick&status=planned&tag=turnuva&sort=title_asc',
    );
    harness.detectChanges();
    const listEl = harness.routeNativeElement as HTMLElement;

    expect(listEl.querySelectorAll('tbody tr').length).toBe(1);
    const detailLink = listEl.querySelector('a[aria-label*="detaylarını gör"]') as HTMLAnchorElement;
    expect(detailLink).toBeTruthy();
    const detailHref = detailLink.getAttribute('href')!;
    expect(detailHref).toContain(`/icerikler/${first.value.id}`);
    expect(detailHref).toContain('q=Valorant');
    expect(detailHref).toContain('platform=kick');

    await harness.navigateByUrl(detailHref);
    harness.detectChanges();
    const detailEl = harness.routeNativeElement as HTMLElement;
    expect(detailEl.querySelector('#detail-heading')?.textContent).toContain(
      'Valorant Şogun Turnuvası',
    );

    const backLink = detailEl.querySelector('a.back-link') as HTMLAnchorElement;
    const backHref = backLink.getAttribute('href')!;
    expect(backHref).toContain('/icerikler');
    expect(backHref).toContain('q=Valorant');
    expect(backHref).toContain('platform=kick');
    expect(backHref).toContain('status=planned');
    expect(backHref).toContain('tag=turnuva');
    expect(backHref).toContain('sort=title_asc');

    await harness.navigateByUrl(backHref);
    harness.detectChanges();
    const restoredEl = harness.routeNativeElement as HTMLElement;
    expect((restoredEl.querySelector('#filter-query') as HTMLInputElement).value).toBe('Valorant');
    expect((restoredEl.querySelector('#filter-platform') as HTMLSelectElement).value).toBe('kick');
    expect((restoredEl.querySelector('#filter-status') as HTMLSelectElement).value).toBe('planned');
    expect((restoredEl.querySelector('#filter-tag') as HTMLSelectElement).value).toBe('turnuva');
    expect((restoredEl.querySelector('#filter-sort') as HTMLSelectElement).value).toBe('title_asc');
    expect(restoredEl.querySelectorAll('tbody tr').length).toBe(1);
  });
});
