import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { vi } from 'vitest';
import { ContentInput } from '../../core/models/content.model';
import { ContentService } from '../../core/services/content.service';
import { APP_STORAGE } from '../../core/services/storage.service';
import { STORAGE_KEYS } from '../../core/storage-keys';
import { MemoryStorage } from '../../core/testing/memory-storage.testing';
import { Contents } from './contents';
import { PLATFORM_LOGOS, formatTagLabel } from './content-labels';

const sampleInput: ContentInput = {
  title: 'Minecraft Gece Yayını',
  platform: 'kick',
  contentType: 'live',
  gameOrEvent: 'Minecraft',
  date: '2026-12-10',
  time: '21:00',
  status: 'planned',
  description: 'Survival serisi devam ediyor.',
  notes: 'Sahne geçişlerini kontrol et.',
  team: ['GÖGÖ', 'Samurai Cat'],
  tags: ['kick', 'minecraft'],
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

describe('Contents', () => {
  let memory: MemoryStorage;
  let fixture: ComponentFixture<Contents>;
  let el: HTMLElement;
  let service: ContentService;

  function createComponent(): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [Contents],
      providers: [provideRouter([]), { provide: APP_STORAGE, useValue: memory }],
    });
    service = TestBed.inject(ContentService);
    fixture = TestBed.createComponent(Contents);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    memory = new MemoryStorage();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should show empty state message when there are no content items', () => {
    createComponent();
    expect(el.querySelector('.empty-state')?.textContent).toContain(
      'Henüz içerik eklenmedi. İlk yayınını veya etkinliğini planlayarak başla!',
    );
    expect(el.querySelector('.load-error')).toBeNull();
  });

  it('should render stored items with Turkish platform, type and status labels', () => {
    createComponent();
    service.create(sampleInput);
    fixture.detectChanges();

    expect(el.querySelector('.empty-state')).toBeNull();
    const row = el.querySelector('tbody tr') as HTMLElement;
    expect(row).toBeTruthy();
    expect(row.textContent).toContain('Minecraft Gece Yayını');
    expect(row.textContent).toContain('Kick');
    expect(row.textContent).toContain('Canlı Yayın');
    expect(row.textContent).toContain('Minecraft');
    expect(row.textContent).toContain('10.12.2026');
    expect(row.textContent).toContain('21:00');
    expect(row.textContent).toContain('Planlandı');
    expect(row.textContent).toContain('GÖGÖ, Samurai Cat');
    expect(row.textContent).toContain('#kick');
    expect(row.textContent).toContain('#minecraft');
    const logo = row.querySelector('img.platform-logo') as HTMLImageElement;
    expect(logo).toBeTruthy();
    expect(logo.getAttribute('src')).toBe(PLATFORM_LOGOS.kick);
    expect(logo.getAttribute('alt')).toBe('');
    expect(logo.getAttribute('aria-hidden')).toBe('true');
  });

  it('should map all four platforms to their corresponding logo assets', () => {
    expect(PLATFORM_LOGOS).toEqual({
      kick: 'assets/platforms/kick_platform_logo.webp',
      discord: 'assets/platforms/discord_logo.webp',
      instagram: 'assets/platforms/instagram_logo.webp',
      tiktok: 'assets/platforms/tiktok_logo.webp',
    });
  });

  it('should show loadError alert instead of empty state when stored JSON is corrupt and keep raw data', () => {
    memory.setItem(STORAGE_KEYS.contents, '{bozuk-json');
    createComponent();

    const alert = el.querySelector('.load-error');
    expect(alert).toBeTruthy();
    expect(alert?.textContent).toContain(
      'İçerik verileri yüklenemedi. Kayıtlarının korunması için değişiklik işlemleri durduruldu.',
    );
    expect(el.querySelector('.empty-state')).toBeNull();
    expect(memory.getItem(STORAGE_KEYS.contents)).toBe('{bozuk-json');
  });

  it('should create a new content item with valid form data, quick time and comma-separated team/tags', () => {
    createComponent();
    (el.querySelector('button.btn-primary') as HTMLButtonElement).click();
    fixture.detectChanges();

    setControlValue(el, '#content-title', '  Discord Topluluk Gecesi  ');
    setControlValue(el, '#content-platform', 'discord');
    setControlValue(el, '#content-type', 'event');
    setControlValue(el, '#content-game', 'Soru & Cevap');
    setControlValue(el, '#content-date', '2026-12-15');

    const quickBtn = Array.from(el.querySelectorAll('.quick-times button')).find((b) =>
      b.textContent?.includes('22:00'),
    ) as HTMLButtonElement;
    quickBtn.click();
    fixture.detectChanges();
    expect((el.querySelector('#content-time') as HTMLInputElement).value).toBe('22:00');

    setControlValue(el, '#content-team', ' GÖGÖ , Samurai Cat , Şogunlar , gögö ,  ');
    setControlValue(el, '#content-tags', 'discord, etkinlik, şogun, ETKİNLİK, ');

    const form = el.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    const items = service.getAll();
    expect(items.length).toBe(1);
    expect(items[0]).toMatchObject({
      title: 'Discord Topluluk Gecesi',
      platform: 'discord',
      contentType: 'event',
      gameOrEvent: 'Soru & Cevap',
      date: '2026-12-15',
      time: '22:00',
      status: 'planned',
      team: ['GÖGÖ', 'Samurai Cat', 'Şogunlar'],
      tags: ['discord', 'etkinlik', 'şogun'],
    });
    expect(el.querySelector('app-content-form')).toBeNull();
    expect(el.querySelector('tbody tr')?.textContent).toContain('Discord Topluluk Gecesi');
  });

  it('should reject empty title and invalid date/time and not call ContentService.create', () => {
    createComponent();
    (el.querySelector('button.btn-primary') as HTMLButtonElement).click();
    fixture.detectChanges();

    setControlValue(el, '#content-title', '   ');
    setControlValue(el, '#content-platform', 'kick');
    setControlValue(el, '#content-type', 'live');
    setControlValue(el, '#content-date', '2026-02-30');
    setControlValue(el, '#content-time', '25:99');

    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(el.querySelector('#title-error')?.textContent).toContain('İçerik başlığı zorunludur.');
    expect(el.querySelector('#date-error')?.textContent).toContain('Geçerli bir tarih seçmelisin.');
    expect(el.querySelector('#time-error')?.textContent).toContain('Geçerli bir saat gir.');
    expect(service.getAll().length).toBe(0);
  });

  it('should populate form when editing, update record preserving id and createdAt, and allow cancel without modifying', () => {
    createComponent();
    const created = service.create(sampleInput);
    if (!created.ok) {
      throw new Error('setup failed');
    }
    fixture.detectChanges();

    const editBtn = el.querySelector('button[aria-label*="düzenle"]') as HTMLButtonElement;
    editBtn.click();
    fixture.detectChanges();

    expect((el.querySelector('#content-title') as HTMLInputElement).value).toBe(sampleInput.title);
    expect((el.querySelector('#content-team') as HTMLInputElement).value).toBe('GÖGÖ, Samurai Cat');

    setControlValue(el, '#content-title', 'İptal Edilecek Başlık');
    const cancelBtn = Array.from(el.querySelectorAll('.form-actions button')).find((b) =>
      b.textContent?.includes('Vazgeç'),
    ) as HTMLButtonElement;
    cancelBtn.click();
    fixture.detectChanges();
    expect(service.getById(created.value.id)?.title).toBe(sampleInput.title);

    editBtn.click();
    fixture.detectChanges();
    setControlValue(el, '#content-title', 'Güncellenmiş Gece Yayını');
    setControlValue(el, '#content-status', 'completed');
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    const updated = service.getById(created.value.id);
    expect(updated?.title).toBe('Güncellenmiş Gece Yayını');
    expect(updated?.status).toBe('completed');
    expect(updated?.id).toBe(created.value.id);
    expect(updated?.createdAt).toBe(created.value.createdAt);
    expect(el.querySelector('tbody tr')?.textContent).toContain('Tamamlandı');
  });

  it('should display error message when update fails in storage', () => {
    createComponent();
    const created = service.create(sampleInput);
    if (!created.ok) {
      throw new Error('setup failed');
    }
    fixture.detectChanges();

    (el.querySelector('button[aria-label*="düzenle"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    memory.failOnSet = new DOMException('full', 'QuotaExceededError');
    setControlValue(el, '#content-title', 'Kaydedilemeyen Başlık');
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(el.querySelector('app-content-form .alert-danger')?.textContent).toContain(
      'İçerikler kaydedilemedi',
    );
    expect(service.getById(created.value.id)?.title).toBe(sampleInput.title);
  });

  it('should ask confirmation before deleting, keep item on cancel, and delete on confirm or show error on failure', () => {
    createComponent();
    const created = service.create(sampleInput);
    if (!created.ok) {
      throw new Error('setup failed');
    }
    fixture.detectChanges();

    const deleteBtn = el.querySelector('button[aria-label*="sil"]') as HTMLButtonElement;
    deleteBtn.click();
    fixture.detectChanges();

    const dialog = el.querySelector('.delete-dialog');
    expect(dialog).toBeTruthy();
    expect(dialog?.textContent).toContain(
      '"Minecraft Gece Yayını" içeriğini silmek istediğine emin misin?',
    );

    const cancelBtn = Array.from(dialog!.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Vazgeç'),
    ) as HTMLButtonElement;
    cancelBtn.click();
    fixture.detectChanges();
    expect(el.querySelector('.delete-dialog')).toBeNull();
    expect(service.getAll().length).toBe(1);

    deleteBtn.click();
    fixture.detectChanges();
    memory.failOnSet = new DOMException('full', 'QuotaExceededError');
    const confirmBtn = Array.from(el.querySelectorAll('.delete-dialog button')).find(
      (b) => b.textContent?.trim() === 'Sil',
    ) as HTMLButtonElement;
    confirmBtn.click();
    fixture.detectChanges();

    expect(el.querySelector('.delete-dialog .alert-danger')?.textContent).toContain(
      'İçerikler kaydedilemedi',
    );
    expect(service.getAll().length).toBe(1);

    memory.failOnSet = null;
    confirmBtn.click();
    fixture.detectChanges();
    expect(el.querySelector('.delete-dialog')).toBeNull();
    expect(service.getAll().length).toBe(0);
  });

  it('should persist created and edited items across component/service reloads', () => {
    createComponent();
    service.create(sampleInput);
    fixture.detectChanges();

    createComponent();
    expect(el.querySelector('tbody tr')?.textContent).toContain('Minecraft Gece Yayını');
  });

  it('should search across title, gameOrEvent, tags, team and handle Turkish I/İ/ı/i case-insensitively', () => {
    createComponent();
    service.create({
      ...sampleInput,
      title: 'İstanbul Buluşması',
      gameOrEvent: 'Işık Festivali',
      team: ['Şogun İrem'],
      tags: ['eğlence'],
    });
    service.create({
      ...sampleInput,
      title: 'Valorant Rekabetçi',
      platform: 'discord',
      gameOrEvent: 'Valorant',
      team: ['Batu'],
      tags: ['turnuva'],
    });
    fixture.detectChanges();
    expect(el.querySelectorAll('tbody tr').length).toBe(2);

    // Search by title with Turkish 'i' matching 'İ'
    setControlValue(el, '#filter-query', '  istanbul  ');
    fixture.detectChanges();
    expect(el.querySelectorAll('tbody tr').length).toBe(1);
    expect(el.querySelector('tbody tr')?.textContent).toContain('İstanbul Buluşması');

    // Search by gameOrEvent with Turkish 'ı' matching 'I'
    setControlValue(el, '#filter-query', 'ışık');
    fixture.detectChanges();
    expect(el.querySelectorAll('tbody tr').length).toBe(1);

    // Search by team member
    setControlValue(el, '#filter-query', 'batu');
    fixture.detectChanges();
    expect(el.querySelectorAll('tbody tr').length).toBe(1);
    expect(el.querySelector('tbody tr')?.textContent).toContain('Valorant Rekabetçi');

    // Search by tag
    setControlValue(el, '#filter-query', 'TURNUVA');
    fixture.detectChanges();
    expect(el.querySelectorAll('tbody tr').length).toBe(1);

    // Clearing search restores all items
    setControlValue(el, '#filter-query', '');
    fixture.detectChanges();
    expect(el.querySelectorAll('tbody tr').length).toBe(2);
  });

  it('should filter by platform, contentType, status (including completed), tag, and date range, and combine multiple filters', () => {
    createComponent();
    service.create({
      title: 'Kick Minecraft Yayını',
      platform: 'kick',
      contentType: 'live',
      date: '2026-11-10',
      time: '21:00',
      status: 'completed',
      tags: ['minecraft', 'eğlence'],
    });
    service.create({
      title: 'Instagram Reels Kesiti',
      platform: 'instagram',
      contentType: 'reels',
      date: '2026-11-15',
      time: '20:30',
      status: 'planned',
      tags: ['kesit', 'eğlence'],
    });
    service.create({
      title: 'Kick Korku Gecesi',
      platform: 'kick',
      contentType: 'live',
      date: '2026-11-20',
      time: '23:00',
      status: 'completed',
      tags: ['korku'],
    });
    fixture.detectChanges();

    // Dynamic tag options extracted from items (displayed with # prefix, values preserved)
    const tagOptionEls = Array.from(
      el.querySelectorAll('#filter-tag option'),
    ) as HTMLOptionElement[];
    expect(tagOptionEls.map((o) => o.textContent?.trim())).toEqual([
      'Tüm Etiketler',
      '#eğlence',
      '#kesit',
      '#korku',
      '#minecraft',
    ]);
    expect(tagOptionEls.map((o) => o.value)).toEqual([
      '',
      'eğlence',
      'kesit',
      'korku',
      'minecraft',
    ]);

    // Combined filter: search 'Minecraft' + platform 'kick' + status 'completed' + tag 'eğlence'
    setControlValue(el, '#filter-query', 'Minecraft');
    setControlValue(el, '#filter-platform', 'kick');
    setControlValue(el, '#filter-status', 'completed');
    setControlValue(el, '#filter-tag', 'eğlence');
    fixture.detectChanges();
    expect(el.querySelectorAll('tbody tr').length).toBe(1);
    expect(el.querySelector('tbody tr')?.textContent).toContain('Kick Minecraft Yayını');
    const filterLogo = el.querySelector(
      'label[for="filter-platform"] img.select-platform-logo',
    ) as HTMLImageElement;
    expect(filterLogo).toBeTruthy();
    expect(filterLogo.getAttribute('src')).toBe(PLATFORM_LOGOS.kick);
    expect(el.querySelector('.result-summary')?.textContent).toContain(
      '3 içerikten 1 tanesi gösteriliyor.',
    );

    // Clear filters button resets everything without touching LocalStorage
    (el.querySelector('#clear-filters') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelectorAll('tbody tr').length).toBe(3);
    expect(service.getAll().length).toBe(3);

    // Date range filter (inclusive)
    setControlValue(el, '#filter-from', '2026-11-15');
    setControlValue(el, '#filter-to', '2026-11-20');
    fixture.detectChanges();
    expect(el.querySelectorAll('tbody tr').length).toBe(2);

    // Invalid date range (from > to) shows warning and no rows
    setControlValue(el, '#filter-from', '2026-11-25');
    fixture.detectChanges();
    expect(el.querySelector('#date-range-error')?.textContent).toContain(
      'Başlangıç tarihi, bitiş tarihinden sonra olamaz.',
    );
    expect(el.querySelector('.filter-empty-state')?.textContent).toContain(
      'Arama ve filtrelerine uygun içerik bulunamadı.',
    );
  });

  it('should sort by date_desc, date_asc (with same-day time order), created_desc, created_asc, title_asc and title_desc with clarified labels without mutating service array', () => {
    vi.useFakeTimers();
    createComponent();

    vi.setSystemTime(new Date('2026-01-01T10:00:00.000Z'));
    service.create({
      ...sampleInput,
      title: 'Çarşamba Yayını',
      date: '2026-12-10',
      time: '20:30',
    });

    vi.setSystemTime(new Date('2026-01-03T10:00:00.000Z'));
    service.create({
      ...sampleInput,
      title: 'Gece Özel Yayını',
      date: '2026-12-10',
      time: '23:00',
    });

    vi.setSystemTime(new Date('2026-01-02T10:00:00.000Z'));
    service.create({
      ...sampleInput,
      title: 'Açılış Etkinliği',
      date: '2026-12-05',
      time: '21:00',
    });

    const originalIds = service.getAll().map((i) => i.id);
    fixture.detectChanges();

    // Verify all 6 clarified sort option labels and values
    const sortOptionEls = Array.from(
      el.querySelectorAll('#filter-sort option'),
    ) as HTMLOptionElement[];
    expect(sortOptionEls.map((o) => ({ value: o.value, label: o.textContent?.trim() }))).toEqual([
      { value: 'date_asc', label: 'Planlanan Tarih: En Erken → En Geç' },
      { value: 'date_desc', label: 'Planlanan Tarih: En Geç → En Erken' },
      { value: 'created_desc', label: 'Oluşturulma: En Yeni → En Eski' },
      { value: 'created_asc', label: 'Oluşturulma: En Eski → En Yeni' },
      { value: 'title_asc', label: "Başlık: A'dan Z'ye" },
      { value: 'title_desc', label: "Başlık: Z'den A'ya" },
    ]);

    const getRowTitles = () =>
      Array.from(el.querySelectorAll('tbody tr .title-cell')).map((c) => c.textContent?.trim());

    // Default: date_desc (same day 23:00 comes before 20:30)
    expect(getRowTitles()).toEqual(['Gece Özel Yayını', 'Çarşamba Yayını', 'Açılış Etkinliği']);

    // date_asc (Planlanan Tarih: En Erken → En Geç)
    setControlValue(el, '#filter-sort', 'date_asc');
    fixture.detectChanges();
    expect(getRowTitles()).toEqual(['Açılış Etkinliği', 'Çarşamba Yayını', 'Gece Özel Yayını']);

    // created_desc (Oluşturulma: En Yeni → En Eski)
    setControlValue(el, '#filter-sort', 'created_desc');
    fixture.detectChanges();
    expect(getRowTitles()).toEqual(['Gece Özel Yayını', 'Açılış Etkinliği', 'Çarşamba Yayını']);

    // created_asc (Oluşturulma: En Eski → En Yeni)
    setControlValue(el, '#filter-sort', 'created_asc');
    fixture.detectChanges();
    expect(getRowTitles()).toEqual(['Çarşamba Yayını', 'Açılış Etkinliği', 'Gece Özel Yayını']);

    // title_asc (Turkish alphabetical: A -> Ç -> G)
    setControlValue(el, '#filter-sort', 'title_asc');
    fixture.detectChanges();
    expect(getRowTitles()).toEqual(['Açılış Etkinliği', 'Çarşamba Yayını', 'Gece Özel Yayını']);

    // title_desc (G -> Ç -> A)
    setControlValue(el, '#filter-sort', 'title_desc');
    fixture.detectChanges();
    expect(getRowTitles()).toEqual(['Gece Özel Yayını', 'Çarşamba Yayını', 'Açılış Etkinliği']);

    // Verify source array in ContentService was never mutated
    expect(service.getAll().map((i) => i.id)).toEqual(originalIds);
  });

  it('should format tags as hashtags without double #, preserve Turkish chars, and keep LocalStorage raw values unchanged', () => {
    expect(formatTagLabel('minecraft')).toBe('#minecraft');
    expect(formatTagLabel('şogunlar')).toBe('#şogunlar');
    expect(formatTagLabel('gögöverse')).toBe('#gögöverse');
    expect(formatTagLabel('#korku')).toBe('#korku');
    expect(formatTagLabel('##korku')).toBe('#korku');
    expect(formatTagLabel('   ')).toBe('');
    expect(formatTagLabel('#')).toBe('');

    createComponent();
    const created = service.create({
      ...sampleInput,
      tags: ['şogunlar', '#korku', 'gögöverse'],
    });
    if (!created.ok) {
      throw new Error('create failed');
    }
    fixture.detectChanges();

    const badges = Array.from(el.querySelectorAll('.tag-badge')).map((b) =>
      b.textContent?.trim(),
    );
    expect(badges).toEqual(['#şogunlar', '#korku', '#gögöverse']);

    // Stored raw tags in LocalStorage are not mutated
    const rawStored = JSON.parse(memory.getItem(STORAGE_KEYS.contents)!);
    expect(rawStored[0].tags).toEqual(['şogunlar', '#korku', 'gögöverse']);

    // Searching with or without # matches the item
    setControlValue(el, '#filter-query', '#şogunlar');
    fixture.detectChanges();
    expect(el.querySelectorAll('tbody tr').length).toBe(1);

    setControlValue(el, '#filter-query', 'korku');
    fixture.detectChanges();
    expect(el.querySelectorAll('tbody tr').length).toBe(1);
  });

  it('should open pre-filled create form from /icerikler?yeni=1&tarih=2026-11-21, reject invalid tarih safely, and clean temporary params on save/cancel while preserving filters', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'icerikler', component: Contents }]),
        { provide: APP_STORAGE, useValue: memory },
      ],
    }).compileComponents();

    service = TestBed.inject(ContentService);
    const router = TestBed.inject(Router);
    const harness = await RouterTestingHarness.create();

    // 1. Open with valid tarih + active filter param (platform=kick)
    await harness.navigateByUrl('/icerikler?yeni=1&tarih=2026-11-21&platform=kick', Contents);
    harness.detectChanges();
    const hostEl = harness.routeNativeElement as HTMLElement;

    const dateInput = hostEl.querySelector('#content-date') as HTMLInputElement;
    expect(dateInput).toBeTruthy();
    expect(dateInput.value).toBe('2026-11-21');
    expect((hostEl.querySelector('#filter-platform') as HTMLSelectElement).value).toBe('kick');

    // 2. Cancel closes form and cleans up yeni/tarih while keeping platform=kick
    const cancelBtn = Array.from(hostEl.querySelectorAll('.form-actions button')).find((b) =>
      b.textContent?.includes('Vazgeç'),
    ) as HTMLButtonElement;
    cancelBtn.click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(hostEl.querySelector('app-content-form')).toBeNull();
    expect(router.url).not.toContain('yeni=');
    expect(router.url).not.toContain('tarih=');
    expect(router.url).toContain('platform=kick');

    // 3. Invalid tarih (2026-02-30) is safely rejected without pre-filling invalid date
    await harness.navigateByUrl('/icerikler?yeni=1&tarih=2026-02-30', Contents);
    harness.detectChanges();
    const invalidDateInput = hostEl.querySelector('#content-date') as HTMLInputElement;
    expect(invalidDateInput).toBeTruthy();
    expect(invalidDateInput.value).toBe('');

    // 4. Re-open with valid tarih=2026-11-21 and save -> creates record and cleans up yeni/tarih
    await harness.navigateByUrl('/icerikler?yeni=1&tarih=2026-11-21&platform=kick', Contents);
    harness.detectChanges();
    setControlValue(hostEl, '#content-title', 'Takvimden Planlanan Yayın');
    setControlValue(hostEl, '#content-platform', 'kick');
    setControlValue(hostEl, '#content-type', 'live');
    setControlValue(hostEl, '#content-time', '21:00');
    (hostEl.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(service.getAll().length).toBe(1);
    expect(service.getAll()[0].date).toBe('2026-11-21');
    expect(service.getAll()[0].title).toBe('Takvimden Planlanan Yayın');
    expect(hostEl.querySelector('app-content-form')).toBeNull();
    expect(router.url).not.toContain('yeni=');
    expect(router.url).not.toContain('tarih=');
    expect(router.url).toContain('platform=kick');
  });

  it('should allow removing a single tag from an item in edit form on save, keep tags on cancel, and leave other items untouched', () => {
    createComponent();
    const first = service.create({
      ...sampleInput,
      title: 'İçerik 1',
      tags: ['minecraft', 'şogunlar', 'eğlence'],
    });
    const second = service.create({
      ...sampleInput,
      title: 'İçerik 2',
      tags: ['minecraft', 'turnuva'],
    });
    if (!first.ok || !second.ok) {
      throw new Error('setup failed');
    }
    fixture.detectChanges();

    // Open edit form for İçerik 1
    const editBtn = el.querySelector(
      'button[aria-label=\'"İçerik 1" içeriğini düzenle\']',
    ) as HTMLButtonElement;
    editBtn.click();
    fixture.detectChanges();

    // Remove #minecraft chip in form, then click Vazgeç -> İçerik 1 keeps all 3 tags
    const removeMinecraftBtn = el.querySelector(
      'button[aria-label="#minecraft etiketini bu içerikten kaldır"]',
    ) as HTMLButtonElement;
    expect(removeMinecraftBtn).toBeTruthy();
    removeMinecraftBtn.click();
    fixture.detectChanges();
    expect((el.querySelector('#content-tags') as HTMLInputElement).value).toBe('şogunlar, eğlence');

    const cancelBtn = Array.from(el.querySelectorAll('.form-actions button')).find((b) =>
      b.textContent?.includes('Vazgeç'),
    ) as HTMLButtonElement;
    cancelBtn.click();
    fixture.detectChanges();
    expect(service.getById(first.value.id)?.tags).toEqual(['minecraft', 'şogunlar', 'eğlence']);

    // Re-open edit form for İçerik 1, remove #minecraft, and click Kaydet -> only İçerik 1 loses minecraft
    editBtn.click();
    fixture.detectChanges();
    (
      el.querySelector(
        'button[aria-label="#minecraft etiketini bu içerikten kaldır"]',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(service.getById(first.value.id)?.tags).toEqual(['şogunlar', 'eğlence']);
    expect(service.getById(second.value.id)?.tags).toEqual(['minecraft', 'turnuva']);
  });

  it('should manage tags with usage counts, confirm global tag deletion, keep items intact, and clear only the deleted active tag filter while preserving sort & other filters', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'icerikler', component: Contents }]),
        { provide: APP_STORAGE, useValue: memory },
      ],
    }).compileComponents();

    service = TestBed.inject(ContentService);
    const router = TestBed.inject(Router);

    service.create({
      ...sampleInput,
      title: 'Cuma Minecraft',
      platform: 'kick',
      tags: ['minecraft', 'şogunlar'],
    });
    service.create({
      ...sampleInput,
      title: 'Cumartesi Minecraft',
      platform: 'kick',
      tags: ['#Minecraft', '#korku'],
    });
    service.create({
      ...sampleInput,
      title: 'Pazar Sohbet',
      platform: 'kick',
      tags: ['şogunlar', 'İSTANBUL', 'istanbul'],
    });

    const harness = await RouterTestingHarness.create();
    // Open with active platform=kick, tag=minecraft, sort=created_asc
    await harness.navigateByUrl(
      '/icerikler?platform=kick&tag=minecraft&sort=created_asc',
      Contents,
    );
    harness.detectChanges();
    const hostEl = harness.routeNativeElement as HTMLElement;

    // Sort selection is preserved from URL query param
    expect((hostEl.querySelector('#filter-sort') as HTMLSelectElement).value).toBe('created_asc');
    expect(hostEl.querySelectorAll('tbody tr').length).toBe(2);

    // Open Etiketleri Yönet panel
    const manageBtn = hostEl.querySelector('#manage-tags-btn') as HTMLButtonElement;
    expect(manageBtn.textContent).toContain('Etiketleri Yönet (4)');
    manageBtn.click();
    harness.detectChanges();

    const usageItems = Array.from(hostEl.querySelectorAll('.tag-manager-item')).map((li) =>
      li.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(usageItems).toEqual([
      '#İSTANBUL — 1 içerikte kullanılıyor Sil',
      '#korku — 1 içerikte kullanılıyor Sil',
      '#minecraft — 2 içerikte kullanılıyor Sil',
      '#şogunlar — 2 içerikte kullanılıyor Sil',
    ]);

    // Click Sil for #minecraft -> opens confirmation dialog
    const deleteMinecraftBtn = hostEl.querySelector(
      'button[aria-label="#minecraft etiketini tüm içeriklerden sil"]',
    ) as HTMLButtonElement;
    deleteMinecraftBtn.click();
    harness.detectChanges();

    const dialog = hostEl.querySelector('.delete-tag-dialog')!;
    expect(dialog).toBeTruthy();
    expect(dialog.textContent).toContain('#minecraft etiketini silmek istiyor musun?');
    expect(dialog.textContent).toContain(
      'Bu etiket 2 içerikten kaldırılacak. İçeriklerin kendisi silinmeyecek.',
    );

    // Cancel leaves records unchanged
    const cancelBtn = Array.from(dialog.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Vazgeç'),
    ) as HTMLButtonElement;
    cancelBtn.click();
    harness.detectChanges();
    expect(hostEl.querySelector('.delete-tag-dialog')).toBeNull();
    expect(
      service
        .getAll()
        .filter((i) => i.tags.some((t) => t.toLocaleLowerCase('tr-TR').includes('minecraft')))
        .length,
    ).toBe(2);

    // Re-open dialog and confirm Etiketi Sil
    deleteMinecraftBtn.click();
    harness.detectChanges();
    const confirmBtn = Array.from(
      hostEl.querySelectorAll('.delete-tag-dialog button'),
    ).find((b) => b.textContent?.includes('Etiketi Sil')) as HTMLButtonElement;
    confirmBtn.click();
    await harness.fixture.whenStable();
    harness.detectChanges();

    // Content records themselves are NOT deleted (still 3 items), only #minecraft is removed
    expect(service.getAll().length).toBe(3);
    expect(
      service.getAll().some((i) => i.tags.some((t) => t.toLowerCase().includes('minecraft'))),
    ).toBe(false);

    // Tag manager list and filter select options updated
    expect(hostEl.querySelectorAll('.tag-manager-item').length).toBe(3);
    const filterTagOptions = Array.from(
      hostEl.querySelectorAll('#filter-tag option'),
    ).map((o) => o.textContent?.trim());
    expect(filterTagOptions).toEqual(['Tüm Etiketler', '#İSTANBUL', '#korku', '#şogunlar']);

    // Deleted active tag filter was cleared from state and URL, while platform=kick and sort=created_asc were preserved
    expect((hostEl.querySelector('#filter-tag') as HTMLSelectElement).value).toBe('');
    expect(router.url).not.toContain('tag=');
    expect(router.url).toContain('platform=kick');
    expect(router.url).toContain('sort=created_asc');
  });

  it('should manage team members with usage counts without # prefix, confirm global team removal, and allow removing a single team member in edit form', () => {
    createComponent();
    const first = service.create({
      ...sampleInput,
      title: 'Cuma Yayını',
      team: ['GÖGÖ', 'Samurai Cat', 'Şogunlar'],
    });
    const second = service.create({
      ...sampleInput,
      title: 'Cumartesi Etkinliği',
      team: ['gögö', 'Samurai Cat'],
    });
    if (!first.ok || !second.ok) {
      throw new Error('setup failed');
    }
    fixture.detectChanges();

    // 1. Single team member removal in edit form: Cancel preserves original, Save updates only that item
    const editBtn = el.querySelector(
      'button[aria-label=\'"Cuma Yayını" içeriğini düzenle\']',
    ) as HTMLButtonElement;
    editBtn.click();
    fixture.detectChanges();

    const removeSamuraiBtn = el.querySelector(
      'button[aria-label="Samurai Cat ekip üyesini bu içerikten kaldır"]',
    ) as HTMLButtonElement;
    expect(removeSamuraiBtn).toBeTruthy();
    removeSamuraiBtn.click();
    fixture.detectChanges();
    expect((el.querySelector('#content-team') as HTMLInputElement).value).toBe('GÖGÖ, Şogunlar');

    const cancelFormBtn = Array.from(el.querySelectorAll('.form-actions button')).find((b) =>
      b.textContent?.includes('Vazgeç'),
    ) as HTMLButtonElement;
    cancelFormBtn.click();
    fixture.detectChanges();
    expect(service.getById(first.value.id)?.team).toEqual(['GÖGÖ', 'Samurai Cat', 'Şogunlar']);

    editBtn.click();
    fixture.detectChanges();
    (
      el.querySelector(
        'button[aria-label="Samurai Cat ekip üyesini bu içerikten kaldır"]',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    expect(service.getById(first.value.id)?.team).toEqual(['GÖGÖ', 'Şogunlar']);
    expect(service.getById(second.value.id)?.team).toEqual(['gögö', 'Samurai Cat']);

    // 2. Ekip Üyelerini Yönet panel: deduplicates GÖGÖ/gögö without # prefix and calculates counts
    const manageTeamBtn = el.querySelector('#manage-team-btn') as HTMLButtonElement;
    expect(manageTeamBtn.textContent).toContain('Ekip Üyelerini Yönet (3)');
    manageTeamBtn.click();
    fixture.detectChanges();

    const teamItems = Array.from(el.querySelectorAll('.team-manager-item')).map((li) =>
      li.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(teamItems).toEqual([
      'GÖGÖ — 2 içerikte Sil',
      'Samurai Cat — 1 içerikte Sil',
      'Şogunlar — 1 içerikte Sil',
    ]);

    // 3. Global team removal confirmation: Cancel keeps records, Confirm removes GÖGÖ everywhere without deleting items
    const deleteGogoBtn = el.querySelector(
      'button[aria-label="GÖGÖ ekip üyesini tüm içeriklerden kaldır"]',
    ) as HTMLButtonElement;
    deleteGogoBtn.click();
    fixture.detectChanges();

    const teamDialog = el.querySelector('.delete-team-dialog')!;
    expect(teamDialog).toBeTruthy();
    expect(teamDialog.textContent).toContain('GÖGÖ ekip üyesini kaldırmak istiyor musun?');
    expect(teamDialog.textContent).toContain(
      'Bu ekip üyesi 2 içerikten kaldırılacak. İçeriklerin kendisi silinmeyecek.',
    );

    const cancelDialogBtn = Array.from(teamDialog.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Vazgeç'),
    ) as HTMLButtonElement;
    cancelDialogBtn.click();
    fixture.detectChanges();
    expect(el.querySelector('.delete-team-dialog')).toBeNull();
    expect(service.getById(first.value.id)?.team).toContain('GÖGÖ');

    deleteGogoBtn.click();
    fixture.detectChanges();
    const confirmDialogBtn = Array.from(
      el.querySelectorAll('.delete-team-dialog button'),
    ).find((b) => b.textContent?.includes('Ekip Üyesini Kaldır')) as HTMLButtonElement;
    confirmDialogBtn.click();
    fixture.detectChanges();

    expect(service.getAll().length).toBe(2);
    expect(service.getById(first.value.id)?.team).toEqual(['Şogunlar']);
    expect(service.getById(second.value.id)?.team).toEqual(['Samurai Cat']);
    expect(el.querySelectorAll('.team-manager-item').length).toBe(2);
  });

  it('should suggest previously used tags and team members, support keyboard navigation (ArrowDown/ArrowUp/Enter/Escape), prevent duplicates, and update suggestions after global removal', () => {
    createComponent();
    service.create({
      ...sampleInput,
      title: 'Önceki Yayın 1',
      team: ['GÖGÖ', 'Samurai Cat'],
      tags: ['minecraft', '#şogunlar'],
    });
    service.create({
      ...sampleInput,
      title: 'Önceki Yayın 2',
      team: ['Şogunlar'],
      tags: ['valorant', 'korku'],
    });
    fixture.detectChanges();

    // Open create form
    (el.querySelector('button.btn-primary') as HTMLButtonElement).click();
    fixture.detectChanges();

    // 1. Click tag down-arrow button -> shows all 4 unique tags
    const toggleTagsBtn = el.querySelector('#toggle-tag-suggestions') as HTMLButtonElement;
    toggleTagsBtn.click();
    fixture.detectChanges();

    const getTagOptions = () =>
      Array.from(
        el.querySelectorAll('#tag-suggestions-listbox .quick-select-option-label'),
      ).map((n) => n.textContent?.trim());
    expect(getTagOptions()).toEqual(['#korku', '#minecraft', '#şogunlar', '#valorant']);

    // Click #minecraft suggestion -> adds to form and removes from available suggestions
    const minecraftOption = Array.from(
      el.querySelectorAll('#tag-suggestions-listbox .quick-select-option'),
    ).find((li) => li.textContent?.includes('#minecraft')) as HTMLElement;
    minecraftOption.click();
    fixture.detectChanges();
    expect((el.querySelector('#content-tags') as HTMLInputElement).value).toBe('minecraft');

    // Re-open tag suggestions -> #minecraft is no longer suggested (no duplicate selection)
    toggleTagsBtn.click();
    fixture.detectChanges();
    expect(getTagOptions()).toEqual(['#korku', '#şogunlar', '#valorant']);

    // Keyboard navigation on tag input: ArrowDown -> ArrowUp -> Enter selects suggestion without submitting form, Escape closes
    const tagInput = el.querySelector('#content-tags') as HTMLInputElement;
    tagInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fixture.detectChanges();
    // Index moved from 0 (#korku) to 1 (#şogunlar)
    tagInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();
    expect(tagInput.value).toBe('minecraft, şogunlar');
    expect(el.querySelector('app-content-form')).toBeTruthy(); // Form was NOT submitted

    // Typing a partial search token ('val, yeni_etiket' or 'minecraft, şogunlar, val') filters suggestions
    setControlValue(el, '#content-tags', 'minecraft, şogunlar, val');
    fixture.detectChanges();
    expect(getTagOptions()).toEqual(['#valorant']);
    tagInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();
    expect(tagInput.value).toBe('minecraft, şogunlar, valorant');

    // 2. Team quick-select: click down-arrow button -> shows GÖGÖ, Samurai Cat, Şogunlar without #
    const toggleTeamBtn = el.querySelector('#toggle-team-suggestions') as HTMLButtonElement;
    toggleTeamBtn.click();
    fixture.detectChanges();
    const getTeamOptions = () =>
      Array.from(
        el.querySelectorAll('#team-suggestions-listbox .quick-select-option-label'),
      ).map((n) => n.textContent?.trim());
    expect(getTeamOptions()).toEqual(['GÖGÖ', 'Samurai Cat', 'Şogunlar']);

    // Escape closes team listbox
    const teamInput = el.querySelector('#content-team') as HTMLInputElement;
    teamInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(el.querySelector('#team-suggestions-listbox')).toBeNull();

    // ArrowDown opens team listbox and Enter selects first item ('GÖGÖ')
    teamInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fixture.detectChanges();
    teamInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();
    expect(teamInput.value).toBe('GÖGÖ');

    // Also type a new team member and a new tag, then save
    setControlValue(el, '#content-team', 'GÖGÖ, Misafir Oyuncu');
    setControlValue(el, '#content-tags', 'minecraft, şogunlar, valorant, yeni_etiket');
    setControlValue(el, '#content-title', 'Hızlı Seçim Test Yayını');
    setControlValue(el, '#content-platform', 'kick');
    setControlValue(el, '#content-type', 'live');
    setControlValue(el, '#content-date', '2026-12-20');
    setControlValue(el, '#content-time', '21:00');
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(service.getAll().length).toBe(3);
    const saved = service.getAll()[2];
    expect(saved.team).toEqual(['GÖGÖ', 'Misafir Oyuncu']);
    expect(saved.tags).toEqual(['minecraft', 'şogunlar', 'valorant', 'yeni_etiket']);

    // 3. Global removal updates suggestions immediately
    service.removeTeamMemberEverywhere('GÖGÖ');
    service.removeTagEverywhere('korku');
    (el.querySelector('button.btn-primary') as HTMLButtonElement).click();
    fixture.detectChanges();
    (el.querySelector('#toggle-team-suggestions') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(getTeamOptions()).toEqual(['Misafir Oyuncu', 'Samurai Cat', 'Şogunlar']);
    (el.querySelector('#toggle-tag-suggestions') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(getTagOptions()).toEqual(['#minecraft', '#şogunlar', '#valorant', '#yeni_etiket']);
  });
});
