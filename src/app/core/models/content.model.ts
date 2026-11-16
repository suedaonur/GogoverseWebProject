export const CONTENT_PLATFORMS = ['kick', 'discord', 'instagram', 'tiktok'] as const;
export const CONTENT_TYPES = ['live', 'event', 'reels', 'short_video', 'post'] as const;
export const CONTENT_STATUSES = ['planned', 'in_progress', 'completed', 'cancelled'] as const;

export type ContentPlatform = (typeof CONTENT_PLATFORMS)[number];
export type ContentType = (typeof CONTENT_TYPES)[number];
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export interface ContentItem {
  id: string;
  title: string;
  platform: ContentPlatform;
  contentType: ContentType;
  gameOrEvent?: string;
  description?: string;
  notes?: string;
  /** Yerel yayın tarihi, `YYYY-MM-DD`. UTC'ye çevrilmez. */
  date: string;
  /** Yerel yayın saati, 24 saat `HH:mm`. UTC'ye çevrilmez. */
  time: string;
  team: string[];
  tags: string[];
  status: ContentStatus;
  /** ISO 8601 zaman damgası. */
  createdAt: string;
  /** ISO 8601 zaman damgası. */
  updatedAt: string;
}

export type ContentInput = Pick<
  ContentItem,
  'title' | 'platform' | 'contentType' | 'date' | 'time' | 'status'
> &
  Partial<Pick<ContentItem, 'gameOrEvent' | 'description' | 'notes' | 'team' | 'tags'>>;

export type ContentChanges = Partial<ContentInput>;

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidDate(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  const match = DATE_PATTERN.exec(value);
  if (!match) {
    return false;
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export function isValidTime(value: unknown): value is string {
  return typeof value === 'string' && TIME_PATTERN.test(value);
}

export function isIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string' && value.includes('T') && !Number.isNaN(Date.parse(value));
}

function isOneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (values as readonly string[]).includes(value);
}

export const isContentPlatform = (value: unknown): value is ContentPlatform =>
  isOneOf(CONTENT_PLATFORMS, value);
export const isContentType = (value: unknown): value is ContentType =>
  isOneOf(CONTENT_TYPES, value);
export const isContentStatus = (value: unknown): value is ContentStatus =>
  isOneOf(CONTENT_STATUSES, value);

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

export function isContentItem(value: unknown): value is ContentItem {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const item = value as Record<string, unknown>;
  return (
    typeof item['id'] === 'string' &&
    item['id'].length > 0 &&
    typeof item['title'] === 'string' &&
    item['title'].trim().length > 0 &&
    isContentPlatform(item['platform']) &&
    isContentType(item['contentType']) &&
    isContentStatus(item['status']) &&
    isValidDate(item['date']) &&
    isValidTime(item['time']) &&
    isStringArray(item['team']) &&
    isStringArray(item['tags']) &&
    isOptionalString(item['gameOrEvent']) &&
    isOptionalString(item['description']) &&
    isOptionalString(item['notes']) &&
    isIsoTimestamp(item['createdAt']) &&
    isIsoTimestamp(item['updatedAt'])
  );
}

export function isContentItemList(value: unknown): value is ContentItem[] {
  return Array.isArray(value) && value.every(isContentItem);
}
