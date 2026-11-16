import { inject, Injectable, Signal, signal } from '@angular/core';
import {
  ContentChanges,
  ContentInput,
  ContentItem,
  isContentItemList,
  isContentPlatform,
  isContentStatus,
  isContentType,
  isStringArray,
  isValidDate,
  isValidTime,
} from '../models/content.model';
import { generateId } from '../id';
import { failure, Result, success } from '../result';
import { STORAGE_KEYS } from '../storage-keys';
import { StorageService } from './storage.service';

const EDITABLE_FIELDS = [
  'title',
  'platform',
  'contentType',
  'gameOrEvent',
  'description',
  'notes',
  'date',
  'time',
  'team',
  'tags',
  'status',
] as const satisfies readonly (keyof ContentItem)[];

@Injectable({ providedIn: 'root' })
export class ContentService {
  private readonly storage = inject(StorageService);
  private readonly itemsState = signal<readonly ContentItem[]>([]);
  private readonly loadErrorState = signal<string | null>(null);
  private writesBlocked = false;

  readonly items: Signal<readonly ContentItem[]> = this.itemsState.asReadonly();
  readonly loadError: Signal<string | null> = this.loadErrorState.asReadonly();

  constructor() {
    this.reload();
  }

  reload(): void {
    const result = this.storage.read(STORAGE_KEYS.contents, isContentItemList);
    // Bozuk veri ezilmesin diye yazmayı kilitle.
    this.writesBlocked = result.status === 'corrupt' || result.status === 'invalid';
    this.loadErrorState.set(
      result.status === 'corrupt' || result.status === 'invalid' || result.status === 'unavailable'
        ? result.message
        : null,
    );
    this.itemsState.set(result.status === 'ok' ? result.value.map(freezeItem) : []);
  }

  getAll(): readonly ContentItem[] {
    return this.itemsState();
  }

  getById(id: string): ContentItem | undefined {
    return this.itemsState().find((item) => item.id === id);
  }

  create(input: ContentInput): Result<ContentItem> {
    const blocked = this.checkWritable();
    if (blocked) {
      return blocked;
    }
    const fields = normalize(input);
    const error = validate(fields);
    if (error) {
      return failure('validation', error);
    }
    const now = new Date().toISOString();
    const item = freezeItem({ ...fields, id: this.createUniqueId(), createdAt: now, updatedAt: now });
    return this.persist([...this.itemsState(), item], item);
  }

  update(id: string, changes: ContentChanges): Result<ContentItem> {
    const blocked = this.checkWritable();
    if (blocked) {
      return blocked;
    }
    const existing = this.getById(id);
    if (!existing) {
      return failure('not_found', 'Güncellenecek içerik bulunamadı.');
    }
    const fields = normalize({ ...pickEditable(existing), ...pickEditable(changes) });
    const error = validate(fields);
    if (error) {
      return failure('validation', error);
    }
    const updated = freezeItem({
      ...fields,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    });
    return this.persist(
      this.itemsState().map((item) => (item.id === id ? updated : item)),
      updated,
    );
  }

  delete(id: string): Result<ContentItem> {
    const blocked = this.checkWritable();
    if (blocked) {
      return blocked;
    }
    const existing = this.getById(id);
    if (!existing) {
      return failure('not_found', 'Silinecek içerik bulunamadı.');
    }
    return this.persist(
      this.itemsState().filter((item) => item.id !== id),
      existing,
    );
  }

  removeTagEverywhere(tag: string): Result<number> {
    const blocked = this.checkWritable();
    if (blocked) {
      return blocked;
    }
    const targetKey = normalizeTagLookup(tag);
    if (!targetKey) {
      return failure('validation', 'Silinecek geçerli bir etiket belirtilmedi.');
    }

    // İçerikler silinmez; toplu değişiklik tek yazımla yapılır.
    const now = new Date().toISOString();
    let modifiedCount = 0;
    const nextItems = this.itemsState().map((item) => {
      const remainingTags = item.tags.filter(
        (existingTag) => normalizeTagLookup(existingTag) !== targetKey,
      );
      if (remainingTags.length === item.tags.length) {
        return item;
      }
      modifiedCount += 1;
      return freezeItem({
        ...item,
        tags: remainingTags,
        updatedAt: now,
      });
    });

    if (modifiedCount === 0) {
      return failure('not_found', 'Silinecek etiket hiçbir içerikte bulunamadı.');
    }

    return this.persist(nextItems, modifiedCount);
  }

  removeTeamMemberEverywhere(name: string): Result<number> {
    const blocked = this.checkWritable();
    if (blocked) {
      return blocked;
    }
    const targetKey = normalizeTeamLookup(name);
    if (!targetKey) {
      return failure('validation', 'Kaldırılacak geçerli bir ekip üyesi adı belirtilmedi.');
    }

    const now = new Date().toISOString();
    let modifiedCount = 0;
    const nextItems = this.itemsState().map((item) => {
      const remainingTeam = item.team.filter(
        (existingMember) => normalizeTeamLookup(existingMember) !== targetKey,
      );
      if (remainingTeam.length === item.team.length) {
        return item;
      }
      modifiedCount += 1;
      return freezeItem({
        ...item,
        team: remainingTeam,
        updatedAt: now,
      });
    });

    if (modifiedCount === 0) {
      return failure('not_found', 'Kaldırılacak ekip üyesi hiçbir içerikte bulunamadı.');
    }

    return this.persist(nextItems, modifiedCount);
  }

  private checkWritable(): Result<never> | null {
    return this.writesBlocked
      ? failure(
          'blocked',
          'Kayıtlı içerik verisi okunamadığı için veri kaybını önlemek amacıyla değişiklik yapılamıyor.',
        )
      : null;
  }

  private persist<T>(next: readonly ContentItem[], value: T): Result<T> {
    // Önce veriyi güvenle kaydet.
    const written = this.storage.write(STORAGE_KEYS.contents, next);
    if (!written.ok) {
      return failure('storage', `İçerikler kaydedilemedi: ${written.message}`);
    }
    this.itemsState.set(next);
    return success(value);
  }

  private createUniqueId(): string {
    let id = generateId();
    while (this.getById(id)) {
      id = generateId();
    }
    return id;
  }
}

type EditableFields = Pick<ContentItem, (typeof EDITABLE_FIELDS)[number]>;

function pickEditable(source: object): Partial<EditableFields> {
  const picked: Record<string, unknown> = {};
  for (const key of EDITABLE_FIELDS) {
    if (Object.hasOwn(source, key)) {
      picked[key] = (source as Record<string, unknown>)[key];
    }
  }
  return picked as Partial<EditableFields>;
}

function cleanText(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function cleanList(value: unknown): unknown {
  if (value === undefined) {
    return [];
  }
  return isStringArray(value)
    ? value.map((entry) => entry.trim()).filter((entry) => entry.length > 0)
    : value;
}

function normalize(source: Partial<EditableFields>): EditableFields {
  return {
    title: (typeof source.title === 'string' ? source.title.trim() : source.title) as string,
    platform: source.platform as EditableFields['platform'],
    contentType: source.contentType as EditableFields['contentType'],
    gameOrEvent: cleanText(source.gameOrEvent) as string | undefined,
    description: cleanText(source.description) as string | undefined,
    notes: cleanText(source.notes) as string | undefined,
    date: source.date as string,
    time: source.time as string,
    team: cleanList(source.team) as string[],
    tags: cleanList(source.tags) as string[],
    status: source.status as EditableFields['status'],
  };
}

function validate(fields: EditableFields): string | null {
  if (typeof fields.title !== 'string' || fields.title.length === 0) {
    return 'Başlık boş olamaz.';
  }
  if (!isContentPlatform(fields.platform)) {
    return 'Geçersiz platform.';
  }
  if (!isContentType(fields.contentType)) {
    return 'Geçersiz içerik türü.';
  }
  if (!isContentStatus(fields.status)) {
    return 'Geçersiz içerik durumu.';
  }
  if (!isValidDate(fields.date)) {
    return 'Tarih YYYY-MM-DD biçiminde ve geçerli olmalı.';
  }
  if (!isValidTime(fields.time)) {
    return 'Saat 24 saatlik HH:mm biçiminde olmalı.';
  }
  if (!isStringArray(fields.team) || !isStringArray(fields.tags)) {
    return 'Ekip ve etiketler metin dizisi olmalı.';
  }
  for (const text of [fields.gameOrEvent, fields.description, fields.notes]) {
    if (text !== undefined && typeof text !== 'string') {
      return 'Oyun/etkinlik, açıklama ve notlar metin olmalı.';
    }
  }
  return null;
}

function freezeItem(item: ContentItem): ContentItem {
  return Object.freeze({
    ...item,
    team: Object.freeze([...item.team]) as string[],
    tags: Object.freeze([...item.tags]) as string[],
  });
}

// Türkçe harflerle karşılaştır; baştaki # yok sayılır.
function normalizeTagLookup(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().replace(/^#+/, '').trim().toLocaleLowerCase('tr-TR');
}

function normalizeTeamLookup(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().toLocaleLowerCase('tr-TR');
}
