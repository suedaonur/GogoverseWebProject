import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ContentInput } from '../models/content.model';
import { STORAGE_KEYS } from '../storage-keys';
import { MemoryStorage } from '../testing/memory-storage.testing';
import { ContentService } from './content.service';
import { APP_STORAGE } from './storage.service';

const validInput: ContentInput = {
  title: 'Cuma Kick Yayını',
  platform: 'kick',
  contentType: 'live',
  date: '2026-12-04',
  time: '21:00',
  status: 'planned',
  tags: ['valorant'],
  team: ['Gogo'],
};

describe('ContentService', () => {
  let memory: MemoryStorage;

  function createService(): ContentService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: APP_STORAGE, useValue: memory }] });
    return TestBed.inject(ContentService);
  }

  beforeEach(() => {
    memory = new MemoryStorage();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should start with an empty list and write nothing', () => {
    const service = createService();
    expect(service.getAll()).toEqual([]);
    expect(service.loadError()).toBeNull();
    expect(memory.getItem(STORAGE_KEYS.contents)).toBeNull();
  });

  it('should create an item with id and timestamps and find it by id', () => {
    const service = createService();
    const result = service.create(validInput);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.id).toBeTruthy();
    expect(result.value.createdAt).toBe(result.value.updatedAt);
    expect(Number.isNaN(Date.parse(result.value.createdAt))).toBe(false);
    expect(service.getById(result.value.id)).toEqual(result.value);
    expect(service.items().length).toBe(1);
    expect(service.getById('yok')).toBeUndefined();
  });

  it('should keep local date and time exactly as entered', () => {
    const service = createService();
    const result = service.create({ ...validInput, date: '2026-12-31', time: '23:00' });
    expect(result.ok && [result.value.date, result.value.time]).toEqual(['2026-12-31', '23:00']);
  });

  it('should generate unique ids', () => {
    const service = createService();
    const ids = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const result = service.create(validInput);
      if (result.ok) {
        ids.add(result.value.id);
      }
    }
    expect(ids.size).toBe(50);
  });

  it('should update an item, keep id/createdAt and renew updatedAt', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T10:00:00.000Z'));
    const service = createService();
    const created = service.create(validInput);
    if (!created.ok) {
      throw new Error('create failed');
    }
    vi.setSystemTime(new Date('2026-01-02T10:00:00.000Z'));
    const updated = service.update(created.value.id, { title: 'Yeni Başlık', status: 'completed' });
    expect(updated.ok).toBe(true);
    if (!updated.ok) {
      return;
    }
    expect(updated.value.title).toBe('Yeni Başlık');
    expect(updated.value.status).toBe('completed');
    expect(updated.value.id).toBe(created.value.id);
    expect(updated.value.createdAt).toBe('2026-01-01T10:00:00.000Z');
    expect(updated.value.updatedAt).toBe('2026-01-02T10:00:00.000Z');
  });

  it('should ignore id and system timestamps passed in changes', () => {
    const service = createService();
    const created = service.create(validInput);
    if (!created.ok) {
      throw new Error('create failed');
    }
    const hostile = { id: 'ele-gecirildi', createdAt: '2000-01-01T00:00:00.000Z', title: 'Güvenli' };
    const updated = service.update(created.value.id, hostile);
    expect(updated.ok && updated.value.id).toBe(created.value.id);
    expect(updated.ok && updated.value.createdAt).toBe(created.value.createdAt);
    expect(updated.ok && updated.value.title).toBe('Güvenli');
  });

  it('should delete an item', () => {
    const service = createService();
    const created = service.create(validInput);
    if (!created.ok) {
      throw new Error('create failed');
    }
    expect(service.delete(created.value.id).ok).toBe(true);
    expect(service.getById(created.value.id)).toBeUndefined();
    expect(service.getAll()).toEqual([]);
  });

  it('should return not_found for unknown ids on update and delete', () => {
    const service = createService();
    expect(service.update('yok', { title: 'x' })).toMatchObject({ ok: false, code: 'not_found' });
    expect(service.delete('yok')).toMatchObject({ ok: false, code: 'not_found' });
  });

  it('should reject invalid content data', () => {
    const service = createService();
    const invalid: Record<string, unknown>[] = [
      { title: '   ' },
      { platform: 'youtube' },
      { contentType: 'story' },
      { status: 'done' },
      { date: '2026-02-30' },
      { date: '04.12.2026' },
      { time: '25:00' },
      { time: '9:30' },
      { tags: [1, 2] },
    ];
    for (const override of invalid) {
      const result = service.create({ ...validInput, ...override } as ContentInput);
      expect(result).toMatchObject({ ok: false, code: 'validation' });
    }
    expect(service.getAll()).toEqual([]);
    expect(memory.getItem(STORAGE_KEYS.contents)).toBeNull();
  });

  it('should reject an invalid update and leave the item unchanged', () => {
    const service = createService();
    const created = service.create(validInput);
    if (!created.ok) {
      throw new Error('create failed');
    }
    expect(service.update(created.value.id, { title: '' })).toMatchObject({ ok: false, code: 'validation' });
    expect(service.getById(created.value.id)?.title).toBe(validInput.title);
  });

  it('should persist, reload, update and delete through storage with a new service instance', () => {
    const first = createService();
    const created = first.create(validInput);
    if (!created.ok) {
      throw new Error('create failed');
    }

    const second = createService();
    expect(second.getById(created.value.id)).toEqual(created.value);

    second.update(created.value.id, { title: 'Kalıcı Başlık' });
    const third = createService();
    expect(third.getById(created.value.id)?.title).toBe('Kalıcı Başlık');

    third.delete(created.value.id);
    expect(createService().getAll()).toEqual([]);
  });

  it('should keep memory and storage consistent when saving fails', () => {
    const service = createService();
    const created = service.create(validInput);
    if (!created.ok) {
      throw new Error('create failed');
    }
    const stored = memory.getItem(STORAGE_KEYS.contents);

    memory.failOnSet = new DOMException('full', 'QuotaExceededError');
    expect(service.create({ ...validInput, title: 'Yeni' })).toMatchObject({ ok: false, code: 'storage' });
    expect(service.update(created.value.id, { title: 'Değişti' })).toMatchObject({ ok: false, code: 'storage' });
    expect(service.delete(created.value.id)).toMatchObject({ ok: false, code: 'storage' });

    expect(service.getAll().length).toBe(1);
    expect(service.getById(created.value.id)?.title).toBe(validInput.title);
    expect(memory.getItem(STORAGE_KEYS.contents)).toBe(stored);
  });

  it('should not overwrite corrupt stored data and should block writes', () => {
    memory.setItem(STORAGE_KEYS.contents, '{bozuk');
    const service = createService();
    expect(service.getAll()).toEqual([]);
    expect(service.loadError()).toBeTruthy();
    expect(service.create(validInput)).toMatchObject({ ok: false, code: 'blocked' });
    expect(memory.getItem(STORAGE_KEYS.contents)).toBe('{bozuk');
  });

  it('should treat stored records with a wrong structure as invalid and keep them', () => {
    const raw = JSON.stringify([{ id: 1, title: 'x' }]);
    memory.setItem(STORAGE_KEYS.contents, raw);
    const service = createService();
    expect(service.loadError()).toBeTruthy();
    expect(service.create(validInput).ok).toBe(false);
    expect(memory.getItem(STORAGE_KEYS.contents)).toBe(raw);
  });

  it('should not allow stored items to be mutated from outside', () => {
    const service = createService();
    const created = service.create(validInput);
    if (!created.ok) {
      throw new Error('create failed');
    }
    expect(() => {
      (created.value as { title: string }).title = 'hack';
    }).toThrow();
    expect(() => created.value.tags.push('hack')).toThrow();
    expect(service.getById(created.value.id)?.title).toBe(validInput.title);
  });

  it('should remove a tag across all matching items atomically, preserve other fields/items, and handle errors safely', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T10:00:00.000Z'));
    const service = createService();

    const first = service.create({
      ...validInput,
      title: 'İçerik 1',
      tags: ['minecraft', 'şogunlar', 'İSTANBUL'],
    });
    const second = service.create({
      ...validInput,
      title: 'İçerik 2',
      tags: ['#Minecraft', 'minecraft_mod', 'eğlence'],
    });
    const third = service.create({
      ...validInput,
      title: 'İçerik 3 (Etkilenmeyen)',
      tags: ['valorant'],
    });
    if (!first.ok || !second.ok || !third.ok) {
      throw new Error('setup failed');
    }

    // Reject empty or invalid tag
    expect(service.removeTagEverywhere('   ')).toMatchObject({ ok: false, code: 'validation' });
    expect(service.removeTagEverywhere('###')).toMatchObject({ ok: false, code: 'validation' });
    expect(service.removeTagEverywhere('olmayan_etiket')).toMatchObject({
      ok: false,
      code: 'not_found',
    });

    // Storage failure keeps all items and tags intact
    vi.setSystemTime(new Date('2026-01-05T12:00:00.000Z'));
    memory.failOnSet = new DOMException('full', 'QuotaExceededError');
    expect(service.removeTagEverywhere('#Minecraft')).toMatchObject({
      ok: false,
      code: 'storage',
    });
    expect(service.getById(first.value.id)?.tags).toEqual(['minecraft', 'şogunlar', 'İSTANBUL']);
    expect(service.getById(second.value.id)?.tags).toEqual([
      '#Minecraft',
      'minecraft_mod',
      'eğlence',
    ]);

    // Successful removal writes once, updates only affected items' updatedAt, keeps partial-match tags like 'minecraft_mod'
    memory.failOnSet = null;
    const setItemSpy = vi.spyOn(memory, 'setItem');
    const result = service.removeTagEverywhere('#Minecraft');
    expect(result).toEqual({ ok: true, value: 2 });
    expect(setItemSpy).toHaveBeenCalledTimes(1);

    const updatedFirst = service.getById(first.value.id)!;
    const updatedSecond = service.getById(second.value.id)!;
    const unchangedThird = service.getById(third.value.id)!;

    expect(service.getAll().length).toBe(3);
    expect(updatedFirst.tags).toEqual(['şogunlar', 'İSTANBUL']);
    expect(updatedFirst.id).toBe(first.value.id);
    expect(updatedFirst.createdAt).toBe('2026-01-01T10:00:00.000Z');
    expect(updatedFirst.updatedAt).toBe('2026-01-05T12:00:00.000Z');
    expect(Object.isFrozen(updatedFirst)).toBe(true);
    expect(Object.isFrozen(updatedFirst.tags)).toBe(true);

    expect(updatedSecond.tags).toEqual(['minecraft_mod', 'eğlence']);
    expect(updatedSecond.updatedAt).toBe('2026-01-05T12:00:00.000Z');

    expect(unchangedThird.tags).toEqual(['valorant']);
    expect(unchangedThird.updatedAt).toBe('2026-01-01T10:00:00.000Z');

    // Turkish tr-TR case-insensitive removal: 'istanbul' removes 'İSTANBUL'
    expect(service.removeTagEverywhere('istanbul')).toEqual({ ok: true, value: 1 });
    expect(service.getById(first.value.id)?.tags).toEqual(['şogunlar']);

    // Persists across new service instance
    const reloaded = createService();
    expect(reloaded.getById(first.value.id)?.tags).toEqual(['şogunlar']);
    expect(reloaded.getById(second.value.id)?.tags).toEqual(['minecraft_mod', 'eğlence']);

    // Blocked when storage is corrupt
    memory.setItem(STORAGE_KEYS.contents, '{bozuk');
    const blockedService = createService();
    expect(blockedService.removeTagEverywhere('şogunlar')).toMatchObject({
      ok: false,
      code: 'blocked',
    });
  });

  it('should remove a team member across all matching items atomically, preserve other fields/items, and handle errors safely', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T10:00:00.000Z'));
    const service = createService();

    const first = service.create({
      ...validInput,
      title: 'İçerik 1',
      team: ['GÖGÖ', 'Samurai Cat'],
      tags: ['kick'],
    });
    const second = service.create({
      ...validInput,
      title: 'İçerik 2',
      team: ['gögö', 'GÖGÖ Jr', 'Şogunlar'],
      status: 'completed',
    });
    const third = service.create({
      ...validInput,
      title: 'İçerik 3 (Etkilenmeyen)',
      team: ['Samurai Cat'],
    });
    if (!first.ok || !second.ok || !third.ok) {
      throw new Error('setup failed');
    }

    // Reject empty name or non-existent team member
    expect(service.removeTeamMemberEverywhere('   ')).toMatchObject({
      ok: false,
      code: 'validation',
    });
    expect(service.removeTeamMemberEverywhere('Olmayan Üye')).toMatchObject({
      ok: false,
      code: 'not_found',
    });

    // Storage failure keeps all items and team lists intact
    vi.setSystemTime(new Date('2026-01-05T12:00:00.000Z'));
    memory.failOnSet = new DOMException('full', 'QuotaExceededError');
    expect(service.removeTeamMemberEverywhere('GÖGÖ')).toMatchObject({
      ok: false,
      code: 'storage',
    });
    expect(service.getById(first.value.id)?.team).toEqual(['GÖGÖ', 'Samurai Cat']);
    expect(service.getById(second.value.id)?.team).toEqual(['gögö', 'GÖGÖ Jr', 'Şogunlar']);

    // Successful removal writes once, updates only affected items' updatedAt, does not remove substring matches like 'GÖGÖ Jr'
    memory.failOnSet = null;
    const setItemSpy = vi.spyOn(memory, 'setItem');
    const result = service.removeTeamMemberEverywhere('  gögö  ');
    expect(result).toEqual({ ok: true, value: 2 });
    expect(setItemSpy).toHaveBeenCalledTimes(1);

    const updatedFirst = service.getById(first.value.id)!;
    const updatedSecond = service.getById(second.value.id)!;
    const unchangedThird = service.getById(third.value.id)!;

    expect(service.getAll().length).toBe(3);
    expect(updatedFirst.team).toEqual(['Samurai Cat']);
    expect(updatedFirst.tags).toEqual(['kick']);
    expect(updatedFirst.id).toBe(first.value.id);
    expect(updatedFirst.createdAt).toBe('2026-01-01T10:00:00.000Z');
    expect(updatedFirst.updatedAt).toBe('2026-01-05T12:00:00.000Z');
    expect(Object.isFrozen(updatedFirst.team)).toBe(true);

    expect(updatedSecond.team).toEqual(['GÖGÖ Jr', 'Şogunlar']);
    expect(updatedSecond.updatedAt).toBe('2026-01-05T12:00:00.000Z');

    expect(unchangedThird.team).toEqual(['Samurai Cat']);
    expect(unchangedThird.updatedAt).toBe('2026-01-01T10:00:00.000Z');

    // Persists across new service instance
    const reloaded = createService();
    expect(reloaded.getById(first.value.id)?.team).toEqual(['Samurai Cat']);
    expect(reloaded.getById(second.value.id)?.team).toEqual(['GÖGÖ Jr', 'Şogunlar']);

    // Blocked when storage is corrupt
    memory.setItem(STORAGE_KEYS.contents, '{bozuk');
    const blockedService = createService();
    expect(blockedService.removeTeamMemberEverywhere('Samurai Cat')).toMatchObject({
      ok: false,
      code: 'blocked',
    });
  });
});
