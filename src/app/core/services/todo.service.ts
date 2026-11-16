import { inject, Injectable, Signal, signal } from '@angular/core';
import { generateId } from '../id';
import { TodoChanges, TodoInput, TodoItem, isTodoItemList } from '../models/todo.model';
import { failure, Result, success } from '../result';
import { STORAGE_KEYS } from '../storage-keys';
import { StorageService } from './storage.service';

@Injectable({ providedIn: 'root' })
export class TodoService {
  private readonly storage = inject(StorageService);
  private readonly itemsState = signal<readonly TodoItem[]>([]);
  private readonly loadErrorState = signal<string | null>(null);
  private writesBlocked = false;

  readonly items: Signal<readonly TodoItem[]> = this.itemsState.asReadonly();
  readonly loadError: Signal<string | null> = this.loadErrorState.asReadonly();

  constructor() {
    this.reload();
  }

  reload(): void {
    const result = this.storage.read(STORAGE_KEYS.todos, isTodoItemList);
    this.writesBlocked = result.status === 'corrupt' || result.status === 'invalid';
    this.loadErrorState.set(
      result.status === 'corrupt' || result.status === 'invalid' || result.status === 'unavailable'
        ? result.message
        : null,
    );
    this.itemsState.set(result.status === 'ok' ? result.value.map((item) => Object.freeze(item)) : []);
  }

  getAll(): readonly TodoItem[] {
    return this.itemsState();
  }

  getById(id: string): TodoItem | undefined {
    return this.itemsState().find((item) => item.id === id);
  }

  create(input: TodoInput): Result<TodoItem> {
    const blocked = this.checkWritable();
    if (blocked) {
      return blocked;
    }
    const fields = normalize(input);
    if (!fields.ok) {
      return fields;
    }
    const now = new Date().toISOString();
    const item: TodoItem = Object.freeze({
      ...fields.value,
      id: this.createUniqueId(),
      isCompleted: false,
      createdAt: now,
      updatedAt: now,
    });
    return this.persist([...this.itemsState(), item], item);
  }

  update(id: string, changes: TodoChanges): Result<TodoItem> {
    const blocked = this.checkWritable();
    if (blocked) {
      return blocked;
    }
    const existing = this.getById(id);
    if (!existing) {
      return failure('not_found', 'Güncellenecek görev bulunamadı.');
    }
    const fields = normalize({
      title: changes.title ?? existing.title,
      description: Object.hasOwn(changes, 'description') ? changes.description : existing.description,
    });
    if (!fields.ok) {
      return fields;
    }
    const updated: TodoItem = Object.freeze({
      ...existing,
      ...fields.value,
      updatedAt: new Date().toISOString(),
    });
    return this.replace(updated);
  }

  toggleCompleted(id: string): Result<TodoItem> {
    const blocked = this.checkWritable();
    if (blocked) {
      return blocked;
    }
    const existing = this.getById(id);
    if (!existing) {
      return failure('not_found', 'Görev bulunamadı.');
    }
    const now = new Date().toISOString();
    const { completedAt: _previous, ...rest } = existing;
    const toggled: TodoItem = Object.freeze(
      existing.isCompleted
        ? { ...rest, isCompleted: false, updatedAt: now }
        : { ...rest, isCompleted: true, completedAt: now, updatedAt: now },
    );
    return this.replace(toggled);
  }

  delete(id: string): Result<TodoItem> {
    const blocked = this.checkWritable();
    if (blocked) {
      return blocked;
    }
    const existing = this.getById(id);
    if (!existing) {
      return failure('not_found', 'Silinecek görev bulunamadı.');
    }
    return this.persist(
      this.itemsState().filter((item) => item.id !== id),
      existing,
    );
  }

  private replace(updated: TodoItem): Result<TodoItem> {
    return this.persist(
      this.itemsState().map((item) => (item.id === updated.id ? updated : item)),
      updated,
    );
  }

  private checkWritable(): Result<never> | null {
    return this.writesBlocked
      ? failure(
          'blocked',
          'Kayıtlı görev verisi okunamadığı için veri kaybını önlemek amacıyla değişiklik yapılamıyor.',
        )
      : null;
  }

  private persist<T>(next: readonly TodoItem[], value: T): Result<T> {
    const written = this.storage.write(STORAGE_KEYS.todos, next);
    if (!written.ok) {
      return failure('storage', `Görevler kaydedilemedi: ${written.message}`);
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

function normalize(input: TodoInput): Result<Pick<TodoItem, 'title' | 'description'>> {
  if (typeof input.title !== 'string' || input.title.trim().length === 0) {
    return failure('validation', 'Görev başlığı boş olamaz.');
  }
  if (input.description !== undefined && typeof input.description !== 'string') {
    return failure('validation', 'Görev açıklaması metin olmalı.');
  }
  const description = input.description?.trim();
  return success({ title: input.title.trim(), description: description ? description : undefined });
}
