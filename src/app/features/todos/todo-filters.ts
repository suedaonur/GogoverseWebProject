import { TodoItem } from '../../core/models/todo.model';

export type TodoStatusFilter = 'all' | 'pending' | 'completed';

export interface TodoFilterOption {
  value: TodoStatusFilter;
  label: string;
}

export const TODO_STATUS_FILTER_OPTIONS: readonly TodoFilterOption[] = [
  { value: 'all', label: 'Tüm Görevler' },
  { value: 'pending', label: 'Bekleyenler' },
  { value: 'completed', label: 'Tamamlananlar' },
];

export function filterAndSortTodos(
  items: readonly TodoItem[],
  query: string,
  statusFilter: TodoStatusFilter,
): TodoItem[] {
  const normalizedQuery = query.trim().toLocaleLowerCase('tr-TR');

  return items
    .filter((item) => {
      if (statusFilter === 'pending' && item.isCompleted) {
        return false;
      }
      if (statusFilter === 'completed' && !item.isCompleted) {
        return false;
      }
      if (normalizedQuery.length > 0) {
        const titleMatch = item.title.toLocaleLowerCase('tr-TR').includes(normalizedQuery);
        const descMatch = (item.description ?? '')
          .toLocaleLowerCase('tr-TR')
          .includes(normalizedQuery);
        if (!titleMatch && !descMatch) {
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => {
      if (a.isCompleted !== b.isCompleted) {
        return a.isCompleted ? 1 : -1;
      }
      const createdDiff = b.createdAt.localeCompare(a.createdAt);
      if (createdDiff !== 0) {
        return createdDiff;
      }
      return a.id.localeCompare(b.id);
    });
}
