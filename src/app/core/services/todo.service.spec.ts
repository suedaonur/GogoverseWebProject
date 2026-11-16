import { TestBed } from '@angular/core/testing';
import { STORAGE_KEYS } from '../storage-keys';
import { MemoryStorage } from '../testing/memory-storage.testing';
import { APP_STORAGE } from './storage.service';
import { TodoService } from './todo.service';

describe('TodoService', () => {
  let memory: MemoryStorage;

  function createService(): TodoService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: APP_STORAGE, useValue: memory }] });
    return TestBed.inject(TodoService);
  }

  beforeEach(() => {
    memory = new MemoryStorage();
  });

  it('should start empty without writing anything', () => {
    const service = createService();
    expect(service.getAll()).toEqual([]);
    expect(memory.getItem(STORAGE_KEYS.todos)).toBeNull();
  });

  it('should create and list tasks', () => {
    const service = createService();
    const first = service.create({ title: ' Reels kes ', description: 'Kısa kesit' });
    const second = service.create({ title: 'Kapak hazırla' });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) {
      return;
    }
    expect(first.value).toMatchObject({ title: 'Reels kes', isCompleted: false });
    expect(first.value.id).not.toBe(second.value.id);
    expect(service.items().length).toBe(2);
    expect(service.getById(first.value.id)).toEqual(first.value);
  });

  it('should reject an empty title', () => {
    const service = createService();
    expect(service.create({ title: '  ' })).toMatchObject({ ok: false, code: 'validation' });
    expect(service.getAll()).toEqual([]);
  });

  it('should update a task and keep id and createdAt', () => {
    const service = createService();
    const created = service.create({ title: 'Eski' });
    if (!created.ok) {
      throw new Error('create failed');
    }
    const updated = service.update(created.value.id, { title: 'Yeni', description: 'Detay' });
    expect(updated.ok && updated.value).toMatchObject({
      id: created.value.id,
      createdAt: created.value.createdAt,
      title: 'Yeni',
      description: 'Detay',
    });
    expect(service.update(created.value.id, { title: '' })).toMatchObject({ ok: false, code: 'validation' });
  });

  it('should toggle completion on and off', () => {
    const service = createService();
    const created = service.create({ title: 'Görev' });
    if (!created.ok) {
      throw new Error('create failed');
    }
    const done = service.toggleCompleted(created.value.id);
    expect(done.ok && done.value.isCompleted).toBe(true);
    expect(done.ok && done.value.completedAt).toBeTruthy();

    const undone = service.toggleCompleted(created.value.id);
    expect(undone.ok && undone.value.isCompleted).toBe(false);
    expect(undone.ok && undone.value.completedAt).toBeUndefined();
  });

  it('should delete a task', () => {
    const service = createService();
    const created = service.create({ title: 'Silinecek' });
    if (!created.ok) {
      throw new Error('create failed');
    }
    expect(service.delete(created.value.id).ok).toBe(true);
    expect(service.getAll()).toEqual([]);
  });

  it('should handle unknown ids', () => {
    const service = createService();
    expect(service.update('yok', { title: 'x' })).toMatchObject({ ok: false, code: 'not_found' });
    expect(service.toggleCompleted('yok')).toMatchObject({ ok: false, code: 'not_found' });
    expect(service.delete('yok')).toMatchObject({ ok: false, code: 'not_found' });
  });

  it('should persist across service instances, including toggle and delete', () => {
    const created = createService().create({ title: 'Kalıcı' });
    if (!created.ok) {
      throw new Error('create failed');
    }
    const second = createService();
    expect(second.getById(created.value.id)).toEqual(created.value);

    second.toggleCompleted(created.value.id);
    const third = createService();
    expect(third.getById(created.value.id)?.isCompleted).toBe(true);

    third.delete(created.value.id);
    expect(createService().getAll()).toEqual([]);
  });

  it('should keep memory and storage consistent when saving fails', () => {
    const service = createService();
    const created = service.create({ title: 'Görev' });
    if (!created.ok) {
      throw new Error('create failed');
    }
    const stored = memory.getItem(STORAGE_KEYS.todos);
    memory.failOnSet = new DOMException('full', 'QuotaExceededError');
    expect(service.toggleCompleted(created.value.id)).toMatchObject({ ok: false, code: 'storage' });
    expect(service.create({ title: 'Yeni' })).toMatchObject({ ok: false, code: 'storage' });
    expect(service.getById(created.value.id)?.isCompleted).toBe(false);
    expect(service.getAll().length).toBe(1);
    expect(memory.getItem(STORAGE_KEYS.todos)).toBe(stored);
  });

  it('should not overwrite corrupt stored data and should block writes', () => {
    memory.setItem(STORAGE_KEYS.todos, '[bozuk');
    const service = createService();
    expect(service.loadError()).toBeTruthy();
    expect(service.create({ title: 'x' })).toMatchObject({ ok: false, code: 'blocked' });
    expect(memory.getItem(STORAGE_KEYS.todos)).toBe('[bozuk');
  });
});
