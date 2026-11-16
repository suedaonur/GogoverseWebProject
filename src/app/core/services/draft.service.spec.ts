import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { STORAGE_KEYS } from '../storage-keys';
import { MemoryStorage } from '../testing/memory-storage.testing';
import { DraftService } from './draft.service';
import { APP_STORAGE } from './storage.service';

describe('DraftService', () => {
  let memory: MemoryStorage;

  function createService(): DraftService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: APP_STORAGE, useValue: memory }] });
    return TestBed.inject(DraftService);
  }

  beforeEach(() => {
    memory = new MemoryStorage();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should start empty without writing to gogoverse.web.drafts.v1', () => {
    const service = createService();
    expect(service.getAll()).toEqual([]);
    expect(memory.getItem(STORAGE_KEYS.drafts)).toBeNull();
  });

  it('should create, update (preserving id and createdAt), delete, and persist drafts across instances', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-15T18:00:00.000Z'));

    const service = createService();
    const created = service.create({
      title: '  Minecraft Kick Taslağı  ',
      targetPlatform: 'kick',
      headline: '  ⚔️ GÖGÖVERSE | Minecraft Şogunlar Gecesi  ',
      body: '  Şogunlar, yeni yayın planımız hazır!  ',
      sourceContentId: 'cnt-1',
      sourceTitleSnapshot: 'Minecraft Şogunlar Gecesi',
    });

    expect(created.ok).toBe(true);
    if (!created.ok) {
      throw new Error('create failed');
    }

    expect(created.value.title).toBe('Minecraft Kick Taslağı');
    expect(created.value.headline).toBe('⚔️ GÖGÖVERSE | Minecraft Şogunlar Gecesi');
    expect(created.value.body).toBe('Şogunlar, yeni yayın planımız hazır!');
    expect(created.value.createdAt).toBe('2026-11-15T18:00:00.000Z');
    expect(created.value.updatedAt).toBe('2026-11-15T18:00:00.000Z');

    // Update preserves id & createdAt and updates updatedAt
    vi.setSystemTime(new Date('2026-11-15T19:30:00.000Z'));
    const updated = service.update(created.value.id, {
      title: 'Minecraft Kick Taslağı (Güncel)',
      body: 'Güncellenmiş yayın açıklaması.',
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok) {
      throw new Error('update failed');
    }
    expect(updated.value.id).toBe(created.value.id);
    expect(updated.value.createdAt).toBe('2026-11-15T18:00:00.000Z');
    expect(updated.value.updatedAt).toBe('2026-11-15T19:30:00.000Z');
    expect(updated.value.title).toBe('Minecraft Kick Taslağı (Güncel)');
    expect(updated.value.body).toBe('Güncellenmiş yayın açıklaması.');

    // Re-instantiating DraftService restores persisted draft
    const secondInstance = createService();
    expect(secondInstance.getById(created.value.id)).toEqual(updated.value);

    // Delete removes only the draft
    expect(secondInstance.delete(created.value.id).ok).toBe(true);
    expect(createService().getAll()).toEqual([]);
  });

  it('should validate required fields, Kick headline requirement, and protect corrupt or failing storage', () => {
    const service = createService();

    // Empty title or body rejected
    expect(
      service.create({ title: '  ', targetPlatform: 'discord', body: 'Duyuru metni' }),
    ).toMatchObject({ ok: false, code: 'validation' });
    expect(
      service.create({ title: 'Discord Duyurusu', targetPlatform: 'discord', body: '   ' }),
    ).toMatchObject({ ok: false, code: 'validation' });

    // Kick draft requires headline
    expect(
      service.create({
        title: 'Kick Taslağı',
        targetPlatform: 'kick',
        headline: '   ',
        body: 'Açıklama',
      }),
    ).toMatchObject({ ok: false, code: 'validation' });

    // Valid Discord draft without headline
    const validDiscord = service.create({
      title: 'Discord Duyurusu',
      targetPlatform: 'discord',
      body: '⚔️ Şogunlar hazır olun!',
    });
    expect(validDiscord.ok).toBe(true);
    if (!validDiscord.ok) {
      throw new Error('create failed');
    }

    // Storage write error keeps memory & storage consistent
    const snapshot = memory.getItem(STORAGE_KEYS.drafts);
    memory.failOnSet = new DOMException('full', 'QuotaExceededError');
    expect(
      service.update(validDiscord.value.id, { body: 'Kaydedilemeyecek değişiklik' }),
    ).toMatchObject({ ok: false, code: 'storage' });
    expect(service.getById(validDiscord.value.id)?.body).toBe('⚔️ Şogunlar hazır olun!');
    expect(memory.getItem(STORAGE_KEYS.drafts)).toBe(snapshot);
    memory.failOnSet = null;

    // Corrupt JSON blocks writes and does not overwrite storage
    memory.setItem(STORAGE_KEYS.drafts, '{bozuk-taslak-json');
    const brokenService = createService();
    expect(brokenService.loadError()).toBeTruthy();
    expect(
      brokenService.create({
        title: 'Yeni Taslak',
        targetPlatform: 'instagram',
        body: 'Metin',
      }),
    ).toMatchObject({ ok: false, code: 'blocked' });
    expect(memory.getItem(STORAGE_KEYS.drafts)).toBe('{bozuk-taslak-json');
  });
});
