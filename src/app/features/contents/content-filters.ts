import { Params } from '@angular/router';
import {
  ContentItem,
  ContentPlatform,
  ContentStatus,
  ContentType,
  isContentPlatform,
  isContentStatus,
  isContentType,
  isValidDate,
} from '../../core/models/content.model';
import { formatTagLabel } from './content-labels';

export const CONTENT_SORT_VALUES = [
  'date_asc',
  'date_desc',
  'created_desc',
  'created_asc',
  'title_asc',
  'title_desc',
] as const;

export type ContentSortOption = (typeof CONTENT_SORT_VALUES)[number];

export const SORT_LABELS: Record<ContentSortOption, string> = {
  date_asc: 'Planlanan Tarih: En Erken → En Geç',
  date_desc: 'Planlanan Tarih: En Geç → En Erken',
  created_desc: 'Oluşturulma: En Yeni → En Eski',
  created_asc: 'Oluşturulma: En Eski → En Yeni',
  title_asc: "Başlık: A'dan Z'ye",
  title_desc: "Başlık: Z'den A'ya",
};

export const SORT_OPTIONS = CONTENT_SORT_VALUES.map((value) => ({
  value,
  label: SORT_LABELS[value],
}));

export interface ContentFilterState {
  query: string;
  platform: ContentPlatform | '';
  contentType: ContentType | '';
  status: ContentStatus | '';
  tag: string;
  dateFrom: string;
  dateTo: string;
  sort: ContentSortOption;
}

export const DEFAULT_FILTER_STATE: ContentFilterState = Object.freeze({
  query: '',
  platform: '',
  contentType: '',
  status: '',
  tag: '',
  dateFrom: '',
  dateTo: '',
  sort: 'date_desc',
});

const trCollator = new Intl.Collator('tr-TR', { sensitivity: 'base', numeric: true });

export function normalizeTr(value: string): string {
  return value.trim().toLocaleLowerCase('tr-TR');
}

export function normalizeTagKey(value: string): string {
  return normalizeTr(value.replace(/^#+/, ''));
}

export function normalizeTeamKey(value: string): string {
  return normalizeTr(value);
}

export interface TagUsageItem {
  key: string;
  tag: string;
  label: string;
  count: number;
}

export interface TeamUsageItem {
  key: string;
  name: string;
  count: number;
}

export function isContentSortOption(value: unknown): value is ContentSortOption {
  return (
    typeof value === 'string' && (CONTENT_SORT_VALUES as readonly string[]).includes(value)
  );
}

export function extractAvailableTags(items: readonly ContentItem[]): string[] {
  const byKey = new Map<string, string>();
  for (const item of items) {
    for (const rawTag of item.tags) {
      const trimmed = rawTag.trim();
      const key = normalizeTagKey(trimmed);
      if (!key) {
        continue;
      }
      if (!byKey.has(key)) {
        byKey.set(key, trimmed);
      }
    }
  }
  return [...byKey.entries()]
    .sort(([keyA], [keyB]) => trCollator.compare(keyA, keyB))
    .map(([, value]) => value);
}

export function extractTagUsage(items: readonly ContentItem[]): TagUsageItem[] {
  const byKey = new Map<string, { tag: string; label: string; count: number }>();
  for (const item of items) {
    const seenInItem = new Set<string>();
    for (const rawTag of item.tags) {
      const trimmed = rawTag.trim();
      const key = normalizeTagKey(trimmed);
      if (!key || seenInItem.has(key)) {
        continue;
      }
      seenInItem.add(key);
      const existing = byKey.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        const cleanedTag = trimmed.replace(/^#+/, '').trim();
        byKey.set(key, {
          tag: cleanedTag,
          label: formatTagLabel(cleanedTag),
          count: 1,
        });
      }
    }
  }
  return [...byKey.entries()]
    .map(([key, value]) => ({ key, ...value }))
    .sort((a, b) => trCollator.compare(a.tag, b.tag));
}

export function extractTeamUsage(items: readonly ContentItem[]): TeamUsageItem[] {
  const byKey = new Map<string, { name: string; count: number }>();
  for (const item of items) {
    const seenInItem = new Set<string>();
    for (const rawMember of item.team) {
      const trimmed = rawMember.trim();
      const key = normalizeTeamKey(trimmed);
      if (!key || seenInItem.has(key)) {
        continue;
      }
      seenInItem.add(key);
      const existing = byKey.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        byKey.set(key, {
          name: trimmed,
          count: 1,
        });
      }
    }
  }
  return [...byKey.entries()]
    .map(([key, value]) => ({ key, ...value }))
    .sort((a, b) => trCollator.compare(a.name, b.name));
}

export function extractAvailableTeamMembers(items: readonly ContentItem[]): string[] {
  return extractTeamUsage(items).map((item) => item.name);
}

export function isDateRangeInvalid(dateFrom: string, dateTo: string): boolean {
  if (!dateFrom || !dateTo) {
    return false;
  }
  return dateFrom > dateTo;
}

export function hasActiveFilters(state: ContentFilterState): boolean {
  return (
    state.query.trim().length > 0 ||
    state.platform !== '' ||
    state.contentType !== '' ||
    state.status !== '' ||
    state.tag.trim().length > 0 ||
    state.dateFrom !== '' ||
    state.dateTo !== '' ||
    state.sort !== DEFAULT_FILTER_STATE.sort
  );
}

function matchesSearchQuery(item: ContentItem, normalizedQuery: string): boolean {
  if (!normalizedQuery) {
    return true;
  }
  const queryWithoutHash = normalizedQuery.replace(/^#+/, '').trim();
  const fields: (string | undefined)[] = [
    item.title,
    item.gameOrEvent,
    item.description,
    item.notes,
    ...item.team,
    ...item.tags,
  ];
  if (fields.some((field) => field !== undefined && normalizeTr(field).includes(normalizedQuery))) {
    return true;
  }
  if (
    normalizedQuery.startsWith('#') &&
    queryWithoutHash.length > 0 &&
    item.tags.some((tag) => normalizeTagKey(tag).includes(queryWithoutHash))
  ) {
    return true;
  }
  return false;
}

function compareDateAndTime(a: ContentItem, b: ContentItem): number {
  const aKey = `${a.date}T${a.time}`;
  const bKey = `${b.date}T${b.time}`;
  return aKey.localeCompare(bKey);
}

function compareCreatedAt(a: ContentItem, b: ContentItem): number {
  const aTime = Date.parse(a.createdAt);
  const bTime = Date.parse(b.createdAt);
  if (!Number.isNaN(aTime) && !Number.isNaN(bTime) && aTime !== bTime) {
    return aTime - bTime;
  }
  return a.createdAt.localeCompare(b.createdAt);
}

export function filterAndSortContents(
  items: readonly ContentItem[],
  state: ContentFilterState,
): ContentItem[] {
  if (isDateRangeInvalid(state.dateFrom, state.dateTo)) {
    return [];
  }

  const normalizedQuery = normalizeTr(state.query);
  const normalizedTag = normalizeTagKey(state.tag);

  const filtered = items.filter((item) => {
    if (!matchesSearchQuery(item, normalizedQuery)) {
      return false;
    }
    if (state.platform && item.platform !== state.platform) {
      return false;
    }
    if (state.contentType && item.contentType !== state.contentType) {
      return false;
    }
    if (state.status && item.status !== state.status) {
      return false;
    }
    if (normalizedTag && !item.tags.some((t) => normalizeTagKey(t) === normalizedTag)) {
      return false;
    }
    if (state.dateFrom && item.date < state.dateFrom) {
      return false;
    }
    if (state.dateTo && item.date > state.dateTo) {
      return false;
    }
    return true;
  });

  // Kaynak diziyi değiştirmemek için kopyayı sırala.
  const sorted = [...filtered];
  sorted.sort((a, b) => {
    switch (state.sort) {
      case 'date_desc': {
        const diff = compareDateAndTime(b, a);
        if (diff !== 0) return diff;
        const createdDiff = compareCreatedAt(b, a);
        return createdDiff !== 0 ? createdDiff : a.id.localeCompare(b.id);
      }
      case 'date_asc': {
        const diff = compareDateAndTime(a, b);
        if (diff !== 0) return diff;
        const createdDiff = compareCreatedAt(a, b);
        return createdDiff !== 0 ? createdDiff : a.id.localeCompare(b.id);
      }
      case 'created_desc': {
        const diff = compareCreatedAt(b, a);
        if (diff !== 0) return diff;
        const dateDiff = compareDateAndTime(b, a);
        return dateDiff !== 0 ? dateDiff : a.id.localeCompare(b.id);
      }
      case 'created_asc': {
        const diff = compareCreatedAt(a, b);
        if (diff !== 0) return diff;
        const dateDiff = compareDateAndTime(a, b);
        return dateDiff !== 0 ? dateDiff : a.id.localeCompare(b.id);
      }
      case 'title_asc': {
        const diff = trCollator.compare(a.title, b.title);
        if (diff !== 0) return diff;
        const dateDiff = compareDateAndTime(b, a);
        return dateDiff !== 0 ? dateDiff : a.id.localeCompare(b.id);
      }
      case 'title_desc': {
        const diff = trCollator.compare(b.title, a.title);
        if (diff !== 0) return diff;
        const dateDiff = compareDateAndTime(b, a);
        return dateDiff !== 0 ? dateDiff : a.id.localeCompare(b.id);
      }
    }
  });

  return sorted;
}

export function parseFilterQueryParams(params: Params): ContentFilterState {
  const rawQuery = typeof params['q'] === 'string' ? params['q'] : '';
  const rawPlatform = params['platform'];
  const rawType = params['type'];
  const rawStatus = params['status'];
  const rawTag = typeof params['tag'] === 'string' ? params['tag'].trim() : '';
  const rawFrom = params['from'];
  const rawTo = params['to'];
  const rawSort = params['sort'];

  return {
    query: rawQuery,
    platform: isContentPlatform(rawPlatform) ? rawPlatform : '',
    contentType: isContentType(rawType) ? rawType : '',
    status: isContentStatus(rawStatus) ? rawStatus : '',
    tag: rawTag,
    dateFrom: isValidDate(rawFrom) ? rawFrom : '',
    dateTo: isValidDate(rawTo) ? rawTo : '',
    sort: isContentSortOption(rawSort) ? rawSort : DEFAULT_FILTER_STATE.sort,
  };
}

export function toFilterQueryParams(state: ContentFilterState): Params {
  const params: Params = {};
  const trimmedQuery = state.query.trim();
  if (trimmedQuery) {
    params['q'] = trimmedQuery;
  }
  if (state.platform) {
    params['platform'] = state.platform;
  }
  if (state.contentType) {
    params['type'] = state.contentType;
  }
  if (state.status) {
    params['status'] = state.status;
  }
  const trimmedTag = state.tag.trim();
  if (trimmedTag) {
    params['tag'] = trimmedTag;
  }
  if (state.dateFrom && isValidDate(state.dateFrom)) {
    params['from'] = state.dateFrom;
  }
  if (state.dateTo && isValidDate(state.dateTo)) {
    params['to'] = state.dateTo;
  }
  if (state.sort !== DEFAULT_FILTER_STATE.sort) {
    params['sort'] = state.sort;
  }
  return params;
}

export function parseArchiveQueryParams(params: Params): ContentFilterState {
  const parsed = parseFilterQueryParams(params);
  return {
    ...parsed,
    status: '',
  };
}

export function toArchiveQueryParams(state: ContentFilterState): Params {
  return toFilterQueryParams({
    ...state,
    status: '',
  });
}
