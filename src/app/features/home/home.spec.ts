import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ContentInput } from '../../core/models/content.model';
import { ContentService } from '../../core/services/content.service';
import { APP_STORAGE } from '../../core/services/storage.service';
import { TodoService } from '../../core/services/todo.service';
import { STORAGE_KEYS } from '../../core/storage-keys';
import { MemoryStorage } from '../../core/testing/memory-storage.testing';
import { PLATFORM_LOGOS } from '../contents/content-labels';
import { Home } from './home';

const baseContent: ContentInput = {
  title: 'Cuma Kick Yayını',
  platform: 'kick',
  contentType: 'live',
  gameOrEvent: 'Valorant',
  date: '2026-11-20',
  time: '21:00',
  status: 'planned',
  tags: ['valorant', '#şogunlar'],
  team: ['GÖGÖ'],
};

describe('Home (Dashboard)', () => {
  let memory: MemoryStorage;
  let fixture: ComponentFixture<Home>;
  let component: Home;
  let el: HTMLElement;
  let contentService: ContentService;
  let todoService: TodoService;

  function createDashboard(fixedNow = new Date(2026, 10, 15, 20, 0)): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [Home],
      providers: [provideRouter([]), { provide: APP_STORAGE, useValue: memory }],
    });
    contentService = TestBed.inject(ContentService);
    todoService = TestBed.inject(TodoService);
    fixture = TestBed.createComponent(Home);
    component = fixture.componentInstance;
    component['referenceNow'].set(fixedNow);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    memory = new MemoryStorage();
  });

  it('should render welcome banner, zero stats without division-by-zero, empty upcoming & todo messages, and feature cards when empty', () => {
    createDashboard();

    expect(el.querySelector('#welcome-heading')?.textContent).toContain(
      "GÖGÖVERSE'e hoş geldin, Şogun!",
    );
    expect(el.textContent).toContain(
      'Yayınlarını, etkinliklerini ve içeriklerini tek merkezden takip et.',
    );
    expect(el.querySelector('[data-stat="total"]')?.textContent?.trim()).toBe('0');
    expect(el.querySelector('[data-stat="planned"]')?.textContent?.trim()).toBe('0');
    expect(el.querySelector('[data-stat="in_progress"]')?.textContent?.trim()).toBe('0');
    expect(el.querySelector('[data-stat="completed"]')?.textContent?.trim()).toBe('0');
    expect(el.querySelector('[data-stat="cancelled"]')?.textContent?.trim()).toBe('0');

    expect(el.textContent).toContain(
      'Yaklaşan içerik bulunmuyor. Yeni bir yayın veya etkinlik planlayabilirsin.',
    );
    expect(el.textContent).toContain(
      'Henüz görev eklenmedi. Görev yönetimi yakında kullanılabilecek.',
    );

    const distItems = el.querySelectorAll('.platform-dist-item');
    expect(distItems.length).toBe(4);
    distItems.forEach((item) => {
      expect(item.textContent).toContain('0 içerik');
      expect(item.textContent).toContain('(%0)');
    });

    expect(el.textContent).not.toContain('Modüller ve özellikler');
    expect(el.querySelector('#features-heading')).toBeNull();
    expect(el.querySelectorAll('.feature-card').length).toBe(0);
    expect(el.querySelectorAll('a.feature-link').length).toBe(0);

    const todoManageLink = el.querySelector('a.todo-manage-link') as HTMLAnchorElement;
    expect(todoManageLink).toBeTruthy();
    expect(todoManageLink.getAttribute('href')).toBe('/gorevler');
    expect(todoManageLink.textContent).toContain('Görevleri Yönet');
  });

  it('should calculate content status counts, platform distribution with logos, and update reactively on create/update', () => {
    createDashboard();

    contentService.create({ ...baseContent, platform: 'kick', status: 'planned' });
    const second = contentService.create({
      ...baseContent,
      title: 'Discord Etkinliği',
      platform: 'discord',
      contentType: 'event',
      status: 'in_progress',
    });
    contentService.create({
      ...baseContent,
      title: 'Instagram Reels',
      platform: 'instagram',
      contentType: 'reels',
      status: 'completed',
    });
    contentService.create({
      ...baseContent,
      title: 'TikTok Kısa Video',
      platform: 'tiktok',
      contentType: 'short_video',
      status: 'cancelled',
    });
    fixture.detectChanges();

    expect(el.querySelector('[data-stat="total"]')?.textContent?.trim()).toBe('4');
    expect(el.querySelector('[data-stat="planned"]')?.textContent?.trim()).toBe('1');
    expect(el.querySelector('[data-stat="in_progress"]')?.textContent?.trim()).toBe('1');
    expect(el.querySelector('[data-stat="completed"]')?.textContent?.trim()).toBe('1');
    expect(el.querySelector('[data-stat="cancelled"]')?.textContent?.trim()).toBe('1');

    // Verify all 4 platform logos and counts in Platform Distribution
    for (const platform of ['kick', 'discord', 'instagram', 'tiktok'] as const) {
      const row = el.querySelector(`.platform-dist-item[data-platform="${platform}"]`)!;
      expect(row).toBeTruthy();
      expect(row.textContent).toContain('1 içerik');
      expect(row.textContent).toContain('(%25)');
      const logo = row.querySelector('img.platform-logo') as HTMLImageElement;
      expect(logo.getAttribute('src')).toBe(PLATFORM_LOGOS[platform]);
    }

    // Reactive update when status changes
    if (second.ok) {
      contentService.update(second.value.id, { status: 'completed' });
      fixture.detectChanges();
      expect(el.querySelector('[data-stat="in_progress"]')?.textContent?.trim()).toBe('0');
      expect(el.querySelector('[data-stat="completed"]')?.textContent?.trim()).toBe('2');
    }
  });

  it('should filter, sort and cap upcoming contents at 5, exclude past/completed/cancelled items, and show Next Kick Stream & #hashtag badges', () => {
    // Fixed now: 2026-11-15 20:00 local time
    createDashboard(new Date(2026, 10, 15, 20, 0));

    // Past item (same day 19:00) -> excluded
    contentService.create({
      ...baseContent,
      title: 'Geçmiş Yayın',
      date: '2026-11-15',
      time: '19:00',
      status: 'planned',
    });
    // Future completed -> excluded
    contentService.create({
      ...baseContent,
      title: 'Tamamlanmış Yayın',
      date: '2026-11-16',
      time: '21:00',
      status: 'completed',
    });
    // Future cancelled -> excluded
    contentService.create({
      ...baseContent,
      title: 'İptal Yayın',
      date: '2026-11-16',
      time: '22:00',
      status: 'cancelled',
    });

    // 6 valid upcoming items out of order -> should sort nearest to farthest and cap at 5
    contentService.create({
      ...baseContent,
      title: 'Yayın 6 (En Uzak)',
      date: '2026-11-25',
      time: '21:00',
      status: 'planned',
    });
    const nearestKick = contentService.create({
      ...baseContent,
      title: 'Yayın 2 (Sıradaki Kick)',
      platform: 'kick',
      contentType: 'live',
      date: '2026-11-16',
      time: '20:30',
      status: 'planned',
      tags: ['kick', '#şogunlar'],
    });
    contentService.create({
      ...baseContent,
      title: 'Yayın 1 (Bu Akşam Discord)',
      platform: 'discord',
      contentType: 'event',
      date: '2026-11-15',
      time: '21:00',
      status: 'in_progress',
    });
    contentService.create({
      ...baseContent,
      title: 'Yayın 4',
      platform: 'instagram',
      contentType: 'reels',
      date: '2026-11-18',
      time: '20:30',
      status: 'planned',
    });
    contentService.create({
      ...baseContent,
      title: 'Yayın 3 (Aynı Gün Geç Saat)',
      platform: 'tiktok',
      contentType: 'short_video',
      date: '2026-11-16',
      time: '23:00',
      status: 'planned',
    });
    contentService.create({
      ...baseContent,
      title: 'Yayın 5',
      platform: 'kick',
      contentType: 'live',
      date: '2026-11-20',
      time: '21:00',
      status: 'planned',
    });

    fixture.detectChanges();

    const upcomingTitles = Array.from(el.querySelectorAll('.upcoming-item .upcoming-title')).map(
      (n) => n.textContent?.trim(),
    );
    expect(upcomingTitles).toEqual([
      'Yayın 1 (Bu Akşam Discord)',
      'Yayın 2 (Sıradaki Kick)',
      'Yayın 3 (Aynı Gün Geç Saat)',
      'Yayın 4',
      'Yayın 5',
    ]);

    // Next Kick Stream card shows 'Yayın 2 (Sıradaki Kick)' with Kick logo, hashtags and detail link
    const nextKickCard = el.querySelector('.next-kick-card')!;
    expect(nextKickCard).toBeTruthy();
    expect(nextKickCard.querySelector('.next-kick-title')?.textContent).toContain(
      'Yayın 2 (Sıradaki Kick)',
    );
    expect(
      (nextKickCard.querySelector('img.platform-logo') as HTMLImageElement).getAttribute('src'),
    ).toBe(PLATFORM_LOGOS.kick);
    const kickTags = Array.from(nextKickCard.querySelectorAll('.tag-badge')).map((t) =>
      t.textContent?.trim(),
    );
    expect(kickTags).toEqual(['#kick', '#şogunlar']);
    if (nearestKick.ok) {
      expect(nextKickCard.querySelector('a')?.getAttribute('href')).toBe(
        `/icerikler/${nearestKick.value.id}`,
      );
    }
  });

  it('should compute TodoService summary counts and pending previews', () => {
    createDashboard();

    todoService.create({ title: 'Kapak görselini hazırla' });
    const doneTodo = todoService.create({ title: 'Discord duyurusunu paylaş' });
    if (doneTodo.ok) {
      todoService.toggleCompleted(doneTodo.value.id);
    }
    todoService.create({ title: 'Reels kesitini dışa aktar' });
    fixture.detectChanges();

    expect(el.querySelector('[data-todo-stat="total"]')?.textContent?.trim()).toBe('3');
    expect(el.querySelector('[data-todo-stat="pending"]')?.textContent?.trim()).toBe('2');
    expect(el.querySelector('[data-todo-stat="completed"]')?.textContent?.trim()).toBe('1');

    const previews = Array.from(el.querySelectorAll('.todo-preview-item')).map((n) =>
      n.textContent?.trim(),
    );
    expect(previews).toEqual(['Kapak görselini hazırla', 'Reels kesitini dışa aktar']);
  });

  it('should handle ContentService and TodoService load errors independently without showing false zero stats', () => {
    // Case 1: Content storage corrupt, Todo storage valid
    memory.setItem(STORAGE_KEYS.contents, '{bozuk-icerik');
    createDashboard();
    todoService.create({ title: 'Sağlam Görev' });
    fixture.detectChanges();

    expect(el.textContent).toContain(
      'İçerik verileri yüklenemedi. Mevcut kayıtlarının korunması için veri işlemleri durduruldu.',
    );
    expect(el.querySelector('[data-stat="total"]')).toBeNull();
    expect(el.querySelector('[data-todo-stat="total"]')?.textContent?.trim()).toBe('1');

    // Case 2: Content storage valid, Todo storage corrupt
    memory.removeItem(STORAGE_KEYS.contents);
    memory.setItem(STORAGE_KEYS.todos, '{bozuk-gorev');
    createDashboard();
    contentService.create(baseContent);
    fixture.detectChanges();

    expect(el.querySelector('[data-stat="total"]')?.textContent?.trim()).toBe('1');
    expect(el.textContent).toContain('Görev verileri yüklenemedi.');
    expect(el.querySelector('[data-todo-stat="total"]')).toBeNull();
  });
});
