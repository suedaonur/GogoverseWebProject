import { isIsoTimestamp } from './content.model';

export interface TodoItem {
  id: string;
  title: string;
  description?: string;
  isCompleted: boolean;
  /** ISO 8601 zaman damgası. */
  createdAt: string;
  /** ISO 8601 zaman damgası. */
  updatedAt: string;
  /** Yalnızca görev tamamlandığında bulunur. */
  completedAt?: string;
}

export type TodoInput = Pick<TodoItem, 'title'> & Partial<Pick<TodoItem, 'description'>>;

export type TodoChanges = Partial<TodoInput>;

export function isTodoItem(value: unknown): value is TodoItem {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const item = value as Record<string, unknown>;
  return (
    typeof item['id'] === 'string' &&
    item['id'].length > 0 &&
    typeof item['title'] === 'string' &&
    item['title'].trim().length > 0 &&
    (item['description'] === undefined || typeof item['description'] === 'string') &&
    typeof item['isCompleted'] === 'boolean' &&
    isIsoTimestamp(item['createdAt']) &&
    isIsoTimestamp(item['updatedAt']) &&
    (item['completedAt'] === undefined || isIsoTimestamp(item['completedAt']))
  );
}

export function isTodoItemList(value: unknown): value is TodoItem[] {
  return Array.isArray(value) && value.every(isTodoItem);
}
