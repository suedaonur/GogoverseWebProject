import {
  CONTENT_PLATFORMS,
  ContentItem,
  ContentPlatform,
} from '../../core/models/content.model';
import { TodoItem } from '../../core/models/todo.model';
import { PLATFORM_LABELS, PLATFORM_LOGOS } from '../contents/content-labels';

export interface ContentStats {
  total: number;
  planned: number;
  inProgress: number;
  completed: number;
  cancelled: number;
}

export interface PlatformStat {
  platform: ContentPlatform;
  label: string;
  logo: string;
  count: number;
  percentage: number;
}

export interface TodoStats {
  total: number;
  pending: number;
  completed: number;
  recentPending: readonly TodoItem[];
}

export function formatLocalDateTimeKey(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function computeContentStats(items: readonly ContentItem[]): ContentStats {
  let planned = 0;
  let inProgress = 0;
  let completed = 0;
  let cancelled = 0;

  for (const item of items) {
    switch (item.status) {
      case 'planned':
        planned++;
        break;
      case 'in_progress':
        inProgress++;
        break;
      case 'completed':
        completed++;
        break;
      case 'cancelled':
        cancelled++;
        break;
    }
  }

  return {
    total: items.length,
    planned,
    inProgress,
    completed,
    cancelled,
  };
}

export function computePlatformDistribution(items: readonly ContentItem[]): PlatformStat[] {
  const total = items.length;
  const counts: Record<ContentPlatform, number> = {
    kick: 0,
    discord: 0,
    instagram: 0,
    tiktok: 0,
  };

  for (const item of items) {
    counts[item.platform]++;
  }

  return CONTENT_PLATFORMS.map((platform) => {
    const count = counts[platform];
    const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
    return {
      platform,
      label: PLATFORM_LABELS[platform],
      logo: PLATFORM_LOGOS[platform],
      count,
      percentage,
    };
  });
}

function compareByDateTimeAsc(a: ContentItem, b: ContentItem): number {
  const diff = `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`);
  if (diff !== 0) {
    return diff;
  }
  const createdDiff = a.createdAt.localeCompare(b.createdAt);
  return createdDiff !== 0 ? createdDiff : a.id.localeCompare(b.id);
}

export function selectUpcomingContents(
  items: readonly ContentItem[],
  now: Date = new Date(),
  limit = 5,
): ContentItem[] {
  const nowKey = formatLocalDateTimeKey(now);
  return items
    .filter(
      (item) =>
        (item.status === 'planned' || item.status === 'in_progress') &&
        `${item.date}T${item.time}` >= nowKey,
    )
    .sort(compareByDateTimeAsc)
    .slice(0, limit);
}

export function selectNextKickStream(
  items: readonly ContentItem[],
  now: Date = new Date(),
): ContentItem | null {
  const nowKey = formatLocalDateTimeKey(now);
  const candidates = items
    .filter(
      (item) =>
        item.platform === 'kick' &&
        item.contentType === 'live' &&
        item.status === 'planned' &&
        `${item.date}T${item.time}` >= nowKey,
    )
    .sort(compareByDateTimeAsc);
  return candidates[0] ?? null;
}

export function computeTodoStats(todos: readonly TodoItem[], previewLimit = 3): TodoStats {
  const pendingItems: TodoItem[] = [];
  let completed = 0;

  for (const todo of todos) {
    if (todo.isCompleted) {
      completed++;
    } else {
      pendingItems.push(todo);
    }
  }

  return {
    total: todos.length,
    pending: pendingItems.length,
    completed,
    recentPending: pendingItems.slice(0, previewLimit),
  };
}
