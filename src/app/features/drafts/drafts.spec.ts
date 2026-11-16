import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { vi } from 'vitest';
import { ContentInput, ContentItem } from '../../core/models/content.model';
import { ContentService } from '../../core/services/content.service';
import { DraftService } from '../../core/services/draft.service';
import { APP_STORAGE } from '../../core/services/storage.service';
import { TodoService } from '../../core/services/todo.service';
import { STORAGE_KEYS } from '../../core/storage-keys';
import { MemoryStorage } from '../../core/testing/memory-storage.testing';
import { ContentDetail } from '../contents/content-detail/content-detail';
import { generateDraftText, normalizeHashtags } from './draft-templates';
import { Drafts } from './drafts';

function setControlValue(el: HTMLElement, selector: string, value: string): void {
  const control = el.querySelector(selector) as
    | HTMLInputElement
    | HTMLTextAreaElement
    | HTMLSelectElement;
  control.value = value;
  control.dispatchEvent(new Event('input'));
  control.dispatchEvent(new Event('change'));
}

const fullKickInput: ContentInput = {
  title: 'Minecraft Şogunlar Gecesi',
  platform: 'kick',
  contentType: 'live',
  gameOrEvent: 'Minecraft',
  description: 'Yeni kale inşası ve topluluk etkinlikleri.',
  notes: 'Sahne geçişlerini kontrol et.',
  date: '2026-11-21',
  time: '21:00',
  status: 'planned',
  team: ['GÖGÖ', 'Samurai Cat'],
  tags: ['minecraft', '#şogunlar', '##minecraft', '   ', 'İSTANBUL', '#istanbul'],
};

describe('DraftTemplates & Drafts (Metin Taslakları Yönetimi)', () => {
  let memory: MemoryStorage;
  let harness: RouterTestingHarness;
  let el: HTMLElement;
  let contentService: ContentService;
  let draftService: DraftService;
  let todoService: TodoService;
  let router: Router;

  async function openRoute(url = '/taslaklar'): Promise<void> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'taslaklar', component: Drafts },
          { path: 'icerikler/:id', component: ContentDetail },
        ]),
        { provide: APP_STORAGE, useValue: memory },
      ],
    }).compileComponents();

    contentService = TestBed.inject(ContentService);
    draftService = TestBed.inject(DraftService);
    todoService = TestBed.inject(TodoService);
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
    vi.restoreAllMocks();
  });

  it('should deterministically generate Kick, Discord, Instagram, and TikTok templates with clean Turkish dates, deduplicated hashtags, and missing optional fields', () => {
    const sampleItem: ContentItem = Object.freeze({
      id: 'cnt-1',
      title: 'Minecraft Şogunlar Gecesi',
      platform: 'kick',
      contentType: 'live',
      gameOrEvent: 'Minecraft',
      description: 'Yeni kale inşası ve topluluk sohbeti.',
      date: '2026-11-21',
      time: '21:00',
      status: 'planned',
      team: ['GÖGÖ', 'Samurai Cat'],
      tags: ['minecraft', '#şogunlar', '##Minecraft', '  ', 'İSTANBUL', '#istanbul'],
      createdAt: '2026-11-10T18:00:00.000Z',
      updatedAt: '2026-11-10T18:00:00.000Z',
    });
    const snapshotBefore = JSON.parse(JSON.stringify(sampleItem));

    // 1. Hashtag normalization: single #, deduplicated with tr-TR case rules, no empty tags
    expect(normalizeHashtags(sampleItem.tags)).toEqual(['#minecraft', '#şogunlar', '#İSTANBUL']);

    // 2. Kick template: headline does not repeat "Minecraft" twice since title already contains it
    const kickDraft1 = generateDraftText(sampleItem, 'kick');
    const kickDraft2 = generateDraftText(sampleItem, 'kick');
    expect(kickDraft1).toEqual(kickDraft2); // deterministic
    expect(kickDraft1.headline).toBe('⚔️ GÖGÖVERSE | Minecraft Şogunlar Gecesi');
    expect(kickDraft1.body).toContain('Şogunlar, yeni yayın planımız hazır! ⚔️');
    expect(kickDraft1.body).toContain('📅 21 Kasım 2026');
    expect(kickDraft1.body).toContain('🕘 21:00');
    expect(kickDraft1.body).toContain('👥 GÖGÖ, Samurai Cat');
    expect(kickDraft1.body).toContain('#minecraft #şogunlar #İSTANBUL');
    expect(kickDraft1.body).not.toContain('##');
    expect(kickDraft1.body).not.toContain('#GÖGÖ');

    // When gameOrEvent is distinct from title, Kick headline includes it cleanly
    const distinctGameDraft = generateDraftText(
      { ...sampleItem, title: 'Büyük Kış Turnuvası', gameOrEvent: 'Valorant' },
      'kick',
    );
    expect(distinctGameDraft.headline).toBe('⚔️ GÖGÖVERSE | Büyük Kış Turnuvası — Valorant');
    expect(distinctGameDraft.body).toContain('🕹️ Oyun / Etkinlik: Valorant');

    // 3. Discord template: no @everyone/@here, no fake URLs, preserves line breaks
    const discordDraft = generateDraftText(sampleItem, 'discord');
    expect(discordDraft.headline).toBeUndefined();
    expect(discordDraft.body).toContain('⚔️ Şogunlar, yeni etkinlik planımız hazır!');
    expect(discordDraft.body).toContain('🎮 Minecraft Şogunlar Gecesi');
    expect(discordDraft.body).toContain('📅 21 Kasım 2026');
    expect(discordDraft.body).toContain('⏰ 21:00');
    expect(discordDraft.body).toContain('👥 GÖGÖ, Samurai Cat');
    expect(discordDraft.body).toContain('Hazır olun Şogunlar!');
    expect(discordDraft.body).not.toContain('@everyone');
    expect(discordDraft.body).not.toContain('@here');
    expect(discordDraft.body).not.toContain('http');

    // 4. Instagram template: engaging hook, question, and normalized hashtags
    const instaDraft = generateDraftText(sampleItem, 'instagram');
    expect(instaDraft.body).toContain('⚔️ Şogunlar, Minecraft macerasına hazır mısınız?');
    expect(instaDraft.body).toContain("GÖGÖVERSE'te yeni bir içerik planı: Minecraft Şogunlar Gecesi");
    expect(instaDraft.body).toContain('Sizce bu kez neler olacak? 👀');
    expect(instaDraft.body).toContain('#minecraft #şogunlar #İSTANBUL');

    // 5. TikTok template: Video Fikri, İlk 3 Saniye, Ana Bölüm, Kapanış, Hashtagler
    const tiktokDraft = generateDraftText(sampleItem, 'tiktok');
    expect(tiktokDraft.body).toContain('🎬 Video Fikri: Minecraft Şogunlar Gecesi');
    expect(tiktokDraft.body).toContain('⚡ İlk 3 Saniye — Dikkat Çekici Giriş:');
    expect(tiktokDraft.body).toContain('🎮 Ana Bölüm: Yeni kale inşası ve topluluk sohbeti.');
    expect(tiktokDraft.body).toContain('⚔️ Kapanış / İzleyiciye Soru:');
    expect(tiktokDraft.body).toContain('#minecraft #şogunlar #İSTANBUL');

    // 6. Minimal item (missing optional gameOrEvent, description, team, tags) produces no undefined/null
    const minimalItem: ContentItem = {
      id: 'cnt-min',
      title: 'Haftalık Duyuru',
      platform: 'discord',
      contentType: 'post',
      date: '2026-12-05',
      time: '19:30',
      status: 'completed',
      team: [],
      tags: [],
      createdAt: '2026-11-10T18:00:00.000Z',
      updatedAt: '2026-11-10T18:00:00.000Z',
    };
    for (const p of ['kick', 'discord', 'instagram', 'tiktok'] as const) {
      const out = generateDraftText(minimalItem, p);
      expect(out.body).not.toContain('undefined');
      expect(out.body).not.toContain('null');
      expect(out.body).toContain('5 Aralık 2026');
      expect(out.body).toContain('19:30');
    }

    // Source item is never mutated
    expect(sampleItem).toEqual(snapshotBefore);
  });

  it('should show empty source message when no contents exist, generate drafts across platforms, protect manual edits with regenerate confirmation, and handle clipboard copy success/failure', async () => {
    await openRoute('/taslaklar');

    // 1. Empty content state when ContentService has no items
    expect(el.querySelector('.empty-source-box')?.textContent).toContain(
      'Henüz içerik kaydın bulunmuyor. Metin taslağı oluşturmak için önce bir içerik eklemelisin.',
    );

    // 2. Add a Kick content item and generate Kick draft
    const createdContent = contentService.create(fullKickInput);
    if (!createdContent.ok) {
      throw new Error('setup failed');
    }
    harness.detectChanges();

    expect(el.querySelector('#draft-source-content')).toBeTruthy();
    (el.querySelector('#generate-draft-btn') as HTMLButtonElement).click();
    harness.detectChanges();

    expect(el.querySelector('#draft-headline')).toBeTruthy();
    expect((el.querySelector('#draft-headline') as HTMLInputElement).value).toBe(
      '⚔️ GÖGÖVERSE | Minecraft Şogunlar Gecesi',
    );
    expect((el.querySelector('#draft-body') as HTMLTextAreaElement).value).toContain(
      '📅 21 Kasım 2026',
    );

    // 3. Clipboard copy success for Kick headline & body
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
    });

    (el.querySelector('#copy-headline-btn') as HTMLButtonElement).click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(writeTextMock).toHaveBeenCalledWith('⚔️ GÖGÖVERSE | Minecraft Şogunlar Gecesi');
    expect(el.querySelector('.draft-notice')?.textContent).toContain(
      'Kick yayın başlığı panoya kopyalandı.',
    );

    // 4. Clipboard failure shows fallback warning and does NOT show success notice
    writeTextMock.mockRejectedValueOnce(new Error('Clipboard blocked'));
    (el.querySelector('#copy-body-btn') as HTMLButtonElement).click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(el.querySelector('.copy-error')?.textContent).toContain(
      'Metin otomatik kopyalanamadı. Metni manuel olarak seçip kopyalayabilirsin.',
    );

    // 5. Manual edit + Regenerate confirmation modal protects user changes on cancel
    setControlValue(el, '#draft-body', 'Kullanıcının özel olarak düzenlediği Kick metni.');
    harness.detectChanges();

    // Switch target platform to Discord and click Metin Oluştur -> asks confirmation because isDirty=true
    (el.querySelector('[data-target-platform="discord"]') as HTMLButtonElement).click();
    harness.detectChanges();
    (el.querySelector('#generate-draft-btn') as HTMLButtonElement).click();
    harness.detectChanges();

    expect(el.querySelector('.regenerate-dialog')).toBeTruthy();
    expect(el.querySelector('#regenerate-dialog-message')?.textContent).toContain(
      'Mevcut düzenlemelerin değiştirilecek. Metni yeniden oluşturmak istiyor musun?',
    );

    // Cancel keeps user's manual edits
    const cancelRegenBtn = Array.from(
      el.querySelectorAll('.regenerate-dialog .dialog-actions button'),
    ).find((b) => b.textContent?.includes('Vazgeç')) as HTMLButtonElement;
    cancelRegenBtn.click();
    harness.detectChanges();
    expect(el.querySelector('.regenerate-dialog')).toBeNull();
    expect((el.querySelector('#draft-body') as HTMLTextAreaElement).value).toBe(
      'Kullanıcının özel olarak düzenlediği Kick metni.',
    );

    // Confirm regenerate replaces with Discord template without changing source ContentItem.platform
    (el.querySelector('#generate-draft-btn') as HTMLButtonElement).click();
    harness.detectChanges();
    (el.querySelector('.confirm-regenerate-btn') as HTMLButtonElement).click();
    harness.detectChanges();

    expect(el.querySelector('#draft-headline')).toBeNull();
    expect((el.querySelector('#draft-body') as HTMLTextAreaElement).value).toContain(
      '⚔️ Şogunlar, yeni etkinlik planımız hazır!',
    );
    expect(contentService.getById(createdContent.value.id)?.platform).toBe('kick');
  });

  it('should save, re-open, update (preserving id), filter, and delete drafts without affecting source ContentItem or TodoService, and keep draft when source content is modified or deleted', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-15T18:00:00.000Z'));
    await openRoute('/taslaklar');

    const source = contentService.create(fullKickInput);
    const todo = todoService.create({ title: 'Yayından önce duyuru at' });
    if (!source.ok || !todo.ok) {
      throw new Error('setup failed');
    }
    harness.detectChanges();

    // 1. Generate Instagram draft and customize body before saving
    (el.querySelector('[data-target-platform="instagram"]') as HTMLButtonElement).click();
    harness.detectChanges();
    (el.querySelector('#generate-draft-btn') as HTMLButtonElement).click();
    harness.detectChanges();

    setControlValue(el, '#draft-title', 'Instagram Özel Reels Taslağı');
    setControlValue(
      el,
      '#draft-body',
      '⚔️ Şogunlar özel Reels açıklaması!\n\n#minecraft #şogunlar',
    );
    harness.detectChanges();

    // Storage failure preserves user's edited draft in form
    memory.failOnSet = new DOMException('full', 'QuotaExceededError');
    (el.querySelector('#save-draft-btn') as HTMLButtonElement).click();
    harness.detectChanges();
    expect(el.querySelector('.save-error')?.textContent).toContain('Metin taslağı kaydedilemedi');
    expect(draftService.getAll().length).toBe(0);

    // Save succeeds when storage works
    memory.failOnSet = null;
    (el.querySelector('#save-draft-btn') as HTMLButtonElement).click();
    harness.detectChanges();

    expect(draftService.getAll().length).toBe(1);
    const saved = draftService.getAll()[0];
    expect(saved.title).toBe('Instagram Özel Reels Taslağı');
    expect(saved.targetPlatform).toBe('instagram');
    expect(saved.sourceContentId).toBe(source.value.id);
    expect(saved.sourceTitleSnapshot).toBe('Minecraft Şogunlar Gecesi');

    // 2. Editing and saving again updates the SAME draft ID (no duplicate created)
    vi.setSystemTime(new Date('2026-11-15T19:00:00.000Z'));
    setControlValue(
      el,
      '#draft-body',
      '⚔️ Şogunlar güncellenmiş Reels açıklaması!\n\n#minecraft #şogunlar',
    );
    (el.querySelector('#save-draft-btn') as HTMLButtonElement).click();
    harness.detectChanges();

    expect(draftService.getAll().length).toBe(1);
    expect(draftService.getAll()[0].id).toBe(saved.id);
    expect(draftService.getAll()[0].createdAt).toBe('2026-11-15T18:00:00.000Z');
    expect(draftService.getAll()[0].updatedAt).toBe('2026-11-15T19:00:00.000Z');
    expect(draftService.getAll()[0].body).toContain('güncellenmiş Reels açıklaması');

    // 3. Updating source ContentItem title does NOT overwrite saved draft
    contentService.update(source.value.id, { title: 'Bambaşka Bir Yayın Başlığı' });
    harness.detectChanges();
    expect(draftService.getById(saved.id)?.body).toContain('güncellenmiş Reels açıklaması');

    // 4. Deleting source ContentItem keeps saved draft intact and displays missing-source info message
    contentService.delete(source.value.id);
    harness.detectChanges();
    expect(draftService.getAll().length).toBe(1);
    expect(el.querySelector('.saved-draft-missing')?.textContent).toContain(
      'Kaynak içerik artık bulunmuyor. Kaydedilmiş taslağın korunuyor.',
    );

    // 5. Delete confirmation modal: Cancel keeps draft, Confirm deletes only the draft
    const card = el.querySelector(`[data-draft-id="${saved.id}"]`) as HTMLElement;
    (card.querySelector('.delete-draft-btn') as HTMLButtonElement).click();
    harness.detectChanges();
    expect(el.querySelector('.delete-dialog')).toBeTruthy();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    harness.detectChanges();
    expect(el.querySelector('.delete-dialog')).toBeNull();
    expect(draftService.getAll().length).toBe(1);

    (card.querySelector('.delete-draft-btn') as HTMLButtonElement).click();
    harness.detectChanges();
    (el.querySelector('.confirm-delete-btn') as HTMLButtonElement).click();
    harness.detectChanges();

    expect(draftService.getAll().length).toBe(0);
    expect(todoService.getAll().length).toBe(1);
  });

  it('should navigate from ContentDetail via Metin Taslağı Oluştur (/taslaklar?icerik=:id), pre-select valid content, and safely handle invalid icerik ID', async () => {
    await openRoute('/taslaklar');
    const first = contentService.create(fullKickInput);
    const second = contentService.create({
      ...fullKickInput,
      title: 'TikTok Dans ve Oyun Kesiti',
      platform: 'tiktok',
      contentType: 'short_video',
    });
    if (!first.ok || !second.ok) {
      throw new Error('setup failed');
    }

    // 1. Open ContentDetail for second item and check Metin Taslağı Oluştur link
    await harness.navigateByUrl(`/icerikler/${second.value.id}`);
    harness.detectChanges();
    const detailEl = harness.routeNativeElement as HTMLElement;
    const createDraftLink = detailEl.querySelector('a.create-draft-link') as HTMLAnchorElement;
    expect(createDraftLink).toBeTruthy();
    expect(createDraftLink.getAttribute('href')).toContain('/taslaklar');
    expect(createDraftLink.getAttribute('href')).toContain(`icerik=${second.value.id}`);

    // 2. Navigate to /taslaklar?icerik=<second.id> -> pre-selects second item and its platform (tiktok)
    await harness.navigateByUrl(`/taslaklar?icerik=${second.value.id}`);
    harness.detectChanges();
    el = harness.routeNativeElement as HTMLElement;
    expect((el.querySelector('#draft-source-content') as HTMLSelectElement).value).toBe(
      second.value.id,
    );
    expect(
      el.querySelector('[data-target-platform="tiktok"]')?.classList.contains('is-active'),
    ).toBe(true);

    // 3. Invalid ?icerik=olmayan-id does not crash, shows warning, and cleans up URL param
    await harness.navigateByUrl('/taslaklar?icerik=olmayan-id-999');
    await harness.fixture.whenStable();
    harness.detectChanges();
    el = harness.routeNativeElement as HTMLElement;
    expect(el.querySelector('.source-warning')?.textContent).toContain(
      'Seçilen kaynak içerik bulunamadı.',
    );
    expect(router.url).not.toContain('icerik=');
  });
});
