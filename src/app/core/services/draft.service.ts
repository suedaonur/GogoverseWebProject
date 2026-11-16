import { inject, Injectable, Signal, signal } from '@angular/core';
import { generateId } from '../id';
import { isContentPlatform } from '../models/content.model';
import {
  MAX_DRAFT_BODY_LENGTH,
  MAX_DRAFT_HEADLINE_LENGTH,
  MAX_DRAFT_TITLE_LENGTH,
  TextDraft,
  TextDraftChanges,
  TextDraftInput,
  isTextDraftList,
} from '../models/text-draft.model';
import { failure, Result, success } from '../result';
import { STORAGE_KEYS } from '../storage-keys';
import { StorageService } from './storage.service';

@Injectable({ providedIn: 'root' })
export class DraftService {
  private readonly storage = inject(StorageService);
  private readonly itemsState = signal<readonly TextDraft[]>([]);
  private readonly loadErrorState = signal<string | null>(null);
  private writesBlocked = false;

  readonly items: Signal<readonly TextDraft[]> = this.itemsState.asReadonly();
  readonly loadError: Signal<string | null> = this.loadErrorState.asReadonly();

  constructor() {
    this.reload();
  }

  reload(): void {
    const result = this.storage.read(STORAGE_KEYS.drafts, isTextDraftList);
    this.writesBlocked = result.status === 'corrupt' || result.status === 'invalid';
    this.loadErrorState.set(
      result.status === 'corrupt' || result.status === 'invalid' || result.status === 'unavailable'
        ? result.message
        : null,
    );
    this.itemsState.set(
      result.status === 'ok' ? result.value.map((item) => Object.freeze(item)) : [],
    );
  }

  getAll(): readonly TextDraft[] {
    return this.itemsState();
  }

  getById(id: string): TextDraft | undefined {
    return this.itemsState().find((item) => item.id === id);
  }

  create(input: TextDraftInput): Result<TextDraft> {
    const blocked = this.checkWritable();
    if (blocked) {
      return blocked;
    }
    const fields = normalizeDraftInput(input);
    if (!fields.ok) {
      return fields;
    }
    const now = new Date().toISOString();
    const draft: TextDraft = Object.freeze({
      ...fields.value,
      id: this.createUniqueId(),
      createdAt: now,
      updatedAt: now,
    });
    return this.persist([...this.itemsState(), draft], draft);
  }

  update(id: string, changes: TextDraftChanges): Result<TextDraft> {
    const blocked = this.checkWritable();
    if (blocked) {
      return blocked;
    }
    const existing = this.getById(id);
    if (!existing) {
      return failure('not_found', 'Güncellenecek metin taslağı bulunamadı.');
    }

    const merged: TextDraftInput = {
      title: changes.title ?? existing.title,
      targetPlatform: changes.targetPlatform ?? existing.targetPlatform,
      body: changes.body ?? existing.body,
      headline: Object.hasOwn(changes, 'headline') ? changes.headline : existing.headline,
      sourceContentId: Object.hasOwn(changes, 'sourceContentId')
        ? changes.sourceContentId
        : existing.sourceContentId,
      sourceTitleSnapshot: Object.hasOwn(changes, 'sourceTitleSnapshot')
        ? changes.sourceTitleSnapshot
        : existing.sourceTitleSnapshot,
    };

    const fields = normalizeDraftInput(merged);
    if (!fields.ok) {
      return fields;
    }

    const updated: TextDraft = Object.freeze({
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
      ...fields.value,
    });

    return this.replace(updated);
  }

  delete(id: string): Result<TextDraft> {
    const blocked = this.checkWritable();
    if (blocked) {
      return blocked;
    }
    const existing = this.getById(id);
    if (!existing) {
      return failure('not_found', 'Silinecek metin taslağı bulunamadı.');
    }
    return this.persist(
      this.itemsState().filter((item) => item.id !== id),
      existing,
    );
  }

  private replace(updated: TextDraft): Result<TextDraft> {
    return this.persist(
      this.itemsState().map((item) => (item.id === updated.id ? updated : item)),
      updated,
    );
  }

  private checkWritable(): Result<never> | null {
    return this.writesBlocked
      ? failure(
          'blocked',
          'Kayıtlı taslak verisi okunamadığı için veri kaybını önlemek amacıyla değişiklik yapılamıyor.',
        )
      : null;
  }

  private persist<T>(next: readonly TextDraft[], value: T): Result<T> {
    const written = this.storage.write(STORAGE_KEYS.drafts, next);
    if (!written.ok) {
      return failure('storage', `Metin taslağı kaydedilemedi: ${written.message}`);
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

function normalizeDraftInput(
  input: TextDraftInput,
): Result<Omit<TextDraft, 'id' | 'createdAt' | 'updatedAt'>> {
  if (typeof input.title !== 'string' || input.title.trim().length === 0) {
    return failure('validation', 'Taslak adı boş olamaz.');
  }
  const title = input.title.trim();
  if (title.length > MAX_DRAFT_TITLE_LENGTH) {
    return failure(
      'validation',
      `Taslak adı en fazla ${MAX_DRAFT_TITLE_LENGTH} karakter olabilir.`,
    );
  }

  if (!isContentPlatform(input.targetPlatform)) {
    return failure('validation', 'Geçerli bir hedef platform seçmelisin.');
  }

  if (typeof input.body !== 'string' || input.body.trim().length === 0) {
    return failure('validation', 'Taslak metni boş olamaz.');
  }
  const body = input.body.trim();
  if (body.length > MAX_DRAFT_BODY_LENGTH) {
    return failure(
      'validation',
      `Taslak metni en fazla ${MAX_DRAFT_BODY_LENGTH} karakter olabilir.`,
    );
  }

  let headline: string | undefined;
  if (input.headline !== undefined) {
    if (typeof input.headline !== 'string') {
      return failure('validation', 'Yayın başlığı metin olmalı.');
    }
    const trimmedHeadline = input.headline.trim();
    if (trimmedHeadline.length > MAX_DRAFT_HEADLINE_LENGTH) {
      return failure(
        'validation',
        `Yayın başlığı en fazla ${MAX_DRAFT_HEADLINE_LENGTH} karakter olabilir.`,
      );
    }
    headline = trimmedHeadline.length > 0 ? trimmedHeadline : undefined;
  }

  if (input.targetPlatform === 'kick' && !headline) {
    return failure('validation', 'Kick yayın başlığı boş olamaz.');
  }

  const sourceContentId = input.sourceContentId?.trim();
  const sourceTitleSnapshot = input.sourceTitleSnapshot?.trim();

  return success({
    title,
    targetPlatform: input.targetPlatform,
    body,
    ...(headline ? { headline } : {}),
    ...(sourceContentId ? { sourceContentId } : {}),
    ...(sourceTitleSnapshot ? { sourceTitleSnapshot } : {}),
  });
}
