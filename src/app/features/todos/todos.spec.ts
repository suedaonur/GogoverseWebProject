import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ContentService } from '../../core/services/content.service';
import { APP_STORAGE } from '../../core/services/storage.service';
import { TodoService } from '../../core/services/todo.service';
import { STORAGE_KEYS } from '../../core/storage-keys';
import { MemoryStorage } from '../../core/testing/memory-storage.testing';
import { MAX_TODO_DESCRIPTION_LENGTH, MAX_TODO_TITLE_LENGTH, Todos } from './todos';

function setInputValue(el: HTMLElement, selector: string, value: string): void {
  const control = el.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement;
  control.value = value;
  control.dispatchEvent(new Event('input'));
  control.dispatchEvent(new Event('blur'));
}

describe('Todos (Görevlerim CRUD, Arama, Filtreleme ve Veri Güvenliği)', () => {
  let memory: MemoryStorage;
  let fixture: ComponentFixture<Todos>;
  let el: HTMLElement;
  let todoService: TodoService;
  let contentService: ContentService;

  function createComponent(): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [Todos],
      providers: [{ provide: APP_STORAGE, useValue: memory }],
    });
    todoService = TestBed.inject(TodoService);
    contentService = TestBed.inject(ContentService);
    fixture = TestBed.createComponent(Todos);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    memory = new MemoryStorage();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render empty state, validate title/description, create pending tasks with optional description, and preserve form on storage failure', () => {
    createComponent();

    // 1. Initial empty state & zero stats
    expect(el.querySelector('[data-todo-stat="total"]')?.textContent?.trim()).toBe('0');
    expect(el.querySelector('[data-todo-stat="pending"]')?.textContent?.trim()).toBe('0');
    expect(el.querySelector('[data-todo-stat="completed"]')?.textContent?.trim()).toBe('0');
    expect(el.querySelector('.empty-state')?.textContent).toContain(
      'Henüz görev eklenmedi. İlk görevini oluşturarak başlayabilirsin.',
    );

    // 2. Empty title rejected
    const form = el.querySelector('.create-panel form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    expect(el.querySelector('#todo-title-error')?.textContent).toContain(
      'Görev başlığı boş olamaz.',
    );
    expect(todoService.getAll().length).toBe(0);

    // 3. Whitespace-only title rejected
    setInputValue(el, '#todo-title', '     ');
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    expect(el.querySelector('#todo-title-error')?.textContent).toContain(
      'Görev başlığı boş olamaz.',
    );
    expect(todoService.getAll().length).toBe(0);

    // 4. Max length validation on title and description
    setInputValue(el, '#todo-title', 'A'.repeat(MAX_TODO_TITLE_LENGTH + 1));
    setInputValue(el, '#todo-description', 'B'.repeat(MAX_TODO_DESCRIPTION_LENGTH + 1));
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    expect(el.querySelector('#todo-title-error')?.textContent).toContain(
      `Görev başlığı en fazla ${MAX_TODO_TITLE_LENGTH} karakter olabilir.`,
    );
    expect(el.querySelector('#todo-desc-error')?.textContent).toContain(
      `Görev açıklaması en fazla ${MAX_TODO_DESCRIPTION_LENGTH} karakter olabilir.`,
    );

    // 5. Storage failure preserves form input and does not add task
    setInputValue(el, '#todo-title', '  Cuma Kick yayınının görsellerini hazırla  ');
    setInputValue(
      el,
      '#todo-description',
      '  Yayın kapağını kontrol et ve Discord duyurusunu hazırlamayı unutma.  ',
    );
    memory.failOnSet = new DOMException('full', 'QuotaExceededError');
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(el.querySelector('.create-error')?.textContent).toContain('Görevler kaydedilemedi');
    expect((el.querySelector('#todo-title') as HTMLInputElement).value).toContain(
      'Cuma Kick yayınının görsellerini hazırla',
    );
    expect(todoService.getAll().length).toBe(0);

    // 6. Succeeds when storage works, trims whitespace, sets isCompleted=false, updates stats & clears form
    memory.failOnSet = null;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(todoService.getAll().length).toBe(1);
    expect(todoService.getAll()[0].title).toBe('Cuma Kick yayınının görsellerini hazırla');
    expect(todoService.getAll()[0].description).toBe(
      'Yayın kapağını kontrol et ve Discord duyurusunu hazırlamayı unutma.',
    );
    expect(todoService.getAll()[0].isCompleted).toBe(false);
    expect(el.querySelector('[data-todo-stat="total"]')?.textContent?.trim()).toBe('1');
    expect(el.querySelector('[data-todo-stat="pending"]')?.textContent?.trim()).toBe('1');
    expect(el.querySelector('[data-todo-stat="completed"]')?.textContent?.trim()).toBe('0');
    expect((el.querySelector('#todo-title') as HTMLInputElement).value).toBe('');
    expect((el.querySelector('#todo-description') as HTMLTextAreaElement).value).toBe('');

    // 7. Create a second task without optional description
    setInputValue(el, '#todo-title', 'Mikrofon ses seviyesini test et');
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(todoService.getAll().length).toBe(2);
    expect(todoService.getAll()[1].description).toBeUndefined();
    expect(el.querySelector('[data-todo-stat="total"]')?.textContent?.trim()).toBe('2');
    expect(el.querySelector('[data-todo-stat="pending"]')?.textContent?.trim()).toBe('2');
  });

  it('should edit task title and description, cancel without mutating, and confirm/cancel task deletion safely', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-10T10:00:00.000Z'));
    createComponent();

    const first = todoService.create({
      title: 'İlk Başlık',
      description: 'İlk Açıklama',
    });
    const second = todoService.create({
      title: 'Silinecek Görev',
      description: 'Silinecek açıklama',
    });
    if (!first.ok || !second.ok) {
      throw new Error('setup failed');
    }
    fixture.detectChanges();

    // 1. Open edit form -> pre-fills existing title & description
    const firstRow = el.querySelector(`[data-todo-id="${first.value.id}"]`) as HTMLElement;
    (firstRow.querySelector('.edit-todo-btn') as HTMLButtonElement).click();
    fixture.detectChanges();

    const titleInput = firstRow.querySelector('.edit-title-input') as HTMLInputElement;
    const descInput = firstRow.querySelector('.edit-desc-input') as HTMLTextAreaElement;
    expect(titleInput.value).toBe('İlk Başlık');
    expect(descInput.value).toBe('İlk Açıklama');

    // 2. Cancel edit leaves record untouched
    titleInput.value = 'Değiştirilmeyecek Başlık';
    titleInput.dispatchEvent(new Event('input'));
    const cancelEditBtn = Array.from(firstRow.querySelectorAll('.edit-actions button')).find((b) =>
      b.textContent?.includes('Vazgeç'),
    ) as HTMLButtonElement;
    cancelEditBtn.click();
    fixture.detectChanges();
    expect(todoService.getById(first.value.id)?.title).toBe('İlk Başlık');

    // 3. Re-open edit, verify storage failure keeps original record intact, then save update
    vi.setSystemTime(new Date('2026-11-12T15:30:00.000Z'));
    (firstRow.querySelector('.edit-todo-btn') as HTMLButtonElement).click();
    fixture.detectChanges();

    setInputValue(firstRow, '.edit-title-input', '  Güncellenmiş Görev Başlığı  ');
    setInputValue(firstRow, '.edit-desc-input', '  Güncellenmiş Açıklama Metni  ');

    memory.failOnSet = new DOMException('full', 'QuotaExceededError');
    (firstRow.querySelector('form.todo-edit-form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
    fixture.detectChanges();
    expect(firstRow.querySelector('.edit-error')?.textContent).toContain('Görevler kaydedilemedi');
    expect(todoService.getById(first.value.id)?.title).toBe('İlk Başlık');

    memory.failOnSet = null;
    (firstRow.querySelector('form.todo-edit-form') as HTMLFormElement).dispatchEvent(
      new Event('submit'),
    );
    fixture.detectChanges();

    const updated = todoService.getById(first.value.id)!;
    expect(updated.id).toBe(first.value.id);
    expect(updated.title).toBe('Güncellenmiş Görev Başlığı');
    expect(updated.description).toBe('Güncellenmiş Açıklama Metni');
    expect(updated.createdAt).toBe('2026-11-10T10:00:00.000Z');
    expect(updated.updatedAt).toBe('2026-11-12T15:30:00.000Z');
    expect(updated.isCompleted).toBe(false);

    // 4. Delete confirmation: cancel via Vazgeç & Escape keeps task
    const secondRow = el.querySelector(`[data-todo-id="${second.value.id}"]`) as HTMLElement;
    (secondRow.querySelector('.delete-todo-btn') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(el.querySelector('.delete-dialog')).toBeTruthy();
    expect(el.querySelector('#delete-todo-message')?.textContent).toContain('Silinecek Görev');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(el.querySelector('.delete-dialog')).toBeNull();
    expect(todoService.getAll().length).toBe(2);

    // 5. Storage failure on delete keeps task in list and shows error inside dialog
    (secondRow.querySelector('.delete-todo-btn') as HTMLButtonElement).click();
    fixture.detectChanges();
    memory.failOnSet = new DOMException('full', 'QuotaExceededError');
    (el.querySelector('.confirm-delete-btn') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('.delete-dialog .alert-danger')?.textContent).toContain(
      'Görevler kaydedilemedi',
    );
    expect(todoService.getAll().length).toBe(2);

    // 6. Confirm delete removes only the selected task
    memory.failOnSet = null;
    (el.querySelector('.confirm-delete-btn') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('.delete-dialog')).toBeNull();
    expect(todoService.getAll().length).toBe(1);
    expect(todoService.getById(first.value.id)).toBeTruthy();
    expect(todoService.getById(second.value.id)).toBeUndefined();
  });

  it('should toggle task completion and revert back to pending, revert checkbox on storage error, and stay completely independent of ContentService', () => {
    createComponent();

    const content = contentService.create({
      title: 'Cuma Kick Yayını',
      platform: 'kick',
      contentType: 'live',
      date: '2026-11-20',
      time: '21:00',
      status: 'planned',
    });
    const todo = todoService.create({ title: 'Yayın sahnesini kontrol et' });
    if (!content.ok || !todo.ok) {
      throw new Error('setup failed');
    }
    fixture.detectChanges();

    const row = el.querySelector(`[data-todo-id="${todo.value.id}"]`) as HTMLElement;
    const checkbox = row.querySelector('input.todo-checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    expect(row.querySelector('.todo-status-badge')?.textContent?.trim()).toBe('Bekliyor');

    // 1. Storage failure during toggle reverts checkbox checked state immediately
    memory.failOnSet = new DOMException('full', 'QuotaExceededError');
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(checkbox.checked).toBe(false);
    expect(todoService.getById(todo.value.id)?.isCompleted).toBe(false);
    expect(el.querySelector('.toggle-error')?.textContent).toContain('Görevler kaydedilemedi');

    // 2. Toggle to completed -> sets isCompleted=true, completedAt, green ✓ Tamamlandı badge, updates stats
    memory.failOnSet = null;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const completedTodo = todoService.getById(todo.value.id)!;
    expect(completedTodo.isCompleted).toBe(true);
    expect(completedTodo.completedAt).toBeTruthy();
    expect(el.querySelector('[data-todo-stat="total"]')?.textContent?.trim()).toBe('1');
    expect(el.querySelector('[data-todo-stat="pending"]')?.textContent?.trim()).toBe('0');
    expect(el.querySelector('[data-todo-stat="completed"]')?.textContent?.trim()).toBe('1');
    expect(row.classList).toContain('is-completed');
    expect(row.querySelector('.todo-status-badge')?.textContent).toContain('✓');
    expect(row.querySelector('.todo-status-badge')?.textContent).toContain('Tamamlandı');

    // 3. Completing a TODO must NOT change ContentItem status
    expect(contentService.getById(content.value.id)?.status).toBe('planned');

    // 4. Toggle back to pending -> clears completedAt, sets isCompleted=false, updates stats
    const updatedCheckbox = el.querySelector(
      `[data-todo-id="${todo.value.id}"] input.todo-checkbox`,
    ) as HTMLInputElement;
    updatedCheckbox.checked = false;
    updatedCheckbox.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const pendingAgain = todoService.getById(todo.value.id)!;
    expect(pendingAgain.isCompleted).toBe(false);
    expect(pendingAgain.completedAt).toBeUndefined();
    expect(el.querySelector('[data-todo-stat="pending"]')?.textContent?.trim()).toBe('1');
    expect(el.querySelector('[data-todo-stat="completed"]')?.textContent?.trim()).toBe('0');

    // 5. Completing a ContentItem must NOT mark TODO as completed
    contentService.update(content.value.id, { status: 'completed' });
    fixture.detectChanges();
    expect(todoService.getById(todo.value.id)?.isCompleted).toBe(false);
    expect(el.querySelector('[data-todo-stat="completed"]')?.textContent?.trim()).toBe('0');
  });

  it('should search in title/description with Turkish case rules, filter by status, sort pending first then newest createdAt, and separate empty states from loadError', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    createComponent();

    vi.setSystemTime(new Date('2026-11-10T10:00:00.000Z'));
    const oldPending = todoService.create({
      title: 'İstanbul Turnuva Hazırlığı',
      description: 'Valorant turnuva tablosunu güncelle',
    });

    vi.setSystemTime(new Date('2026-11-11T10:00:00.000Z'));
    const completedTask = todoService.create({
      title: 'Discord Şogunlar Duyurusu',
      description: 'Ses kanalını aç',
    });
    if (completedTask.ok) {
      todoService.toggleCompleted(completedTask.value.id);
    }

    vi.setSystemTime(new Date('2026-11-12T10:00:00.000Z'));
    const newPending = todoService.create({
      title: 'TikTok Kısa Video Kurgusu',
      description: 'Işık ayarlarını ve altyazıları kontrol et',
    });

    if (!oldPending.ok || !completedTask.ok || !newPending.ok) {
      throw new Error('setup failed');
    }

    const originalServiceOrder = todoService.getAll().map((t) => t.id);
    fixture.detectChanges();

    // 1. Default sort: pending items first (newest createdAt first), then completed items
    const renderedTitles = () =>
      Array.from(el.querySelectorAll('.todo-item .todo-title')).map((n) => n.textContent?.trim());
    expect(renderedTitles()).toEqual([
      'TikTok Kısa Video Kurgusu',
      'İstanbul Turnuva Hazırlığı',
      'Discord Şogunlar Duyurusu',
    ]);
    // Source array in TodoService is not mutated
    expect(todoService.getAll().map((t) => t.id)).toEqual(originalServiceOrder);

    // 2. Status filter: Bekleyenler (pending) & Tamamlananlar (completed)
    (el.querySelector('[data-filter="pending"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(renderedTitles()).toEqual(['TikTok Kısa Video Kurgusu', 'İstanbul Turnuva Hazırlığı']);

    (el.querySelector('[data-filter="completed"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(renderedTitles()).toEqual(['Discord Şogunlar Duyurusu']);

    (el.querySelector('[data-filter="all"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    // 3. Turkish case-insensitive search in title & description
    setInputValue(el, '#todo-search', 'istanbul');
    fixture.detectChanges();
    expect(renderedTitles()).toEqual(['İstanbul Turnuva Hazırlığı']);

    setInputValue(el, '#todo-search', 'IŞIK');
    fixture.detectChanges();
    expect(renderedTitles()).toEqual(['TikTok Kısa Video Kurgusu']);

    // 4. Search empty state
    setInputValue(el, '#todo-search', 'olmayan-kelime');
    fixture.detectChanges();
    expect(el.querySelector('.empty-state')?.textContent).toContain(
      'Aramana uygun görev bulunamadı.',
    );

    setInputValue(el, '#todo-search', '');
    fixture.detectChanges();

    // 5. Distinct empty states for pending vs completed filters
    todoService.toggleCompleted(completedTask.value.id); // Now all 3 are pending, 0 completed
    fixture.detectChanges();
    (el.querySelector('[data-filter="completed"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('.empty-state')?.textContent).toContain(
      'Henüz tamamlanmış görevin bulunmuyor.',
    );

    // Mark all 3 completed -> 0 pending
    todoService.toggleCompleted(oldPending.value.id);
    todoService.toggleCompleted(completedTask.value.id);
    todoService.toggleCompleted(newPending.value.id);
    (el.querySelector('[data-filter="pending"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('.empty-state')?.textContent).toContain(
      'Bekleyen görevin bulunmuyor. Tüm görevleri tamamlamış görünüyorsun!',
    );

    // 6. Corrupt LocalStorage shows loadError alert, NOT empty state
    memory.setItem(STORAGE_KEYS.todos, '{bozuk-todo-json');
    todoService.reload();
    fixture.detectChanges();

    expect(el.querySelector('.load-error')?.textContent).toContain(
      'Görev verileri yüklenemedi. Mevcut kayıtlarının korunması için veri işlemleri durduruldu.',
    );
    expect(el.querySelector('.empty-state')).toBeNull();
  });
});
