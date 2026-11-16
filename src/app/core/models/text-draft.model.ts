import { ContentPlatform, isContentPlatform, isIsoTimestamp } from './content.model';

export const MAX_DRAFT_TITLE_LENGTH = 140;
export const MAX_DRAFT_HEADLINE_LENGTH = 200;
export const MAX_DRAFT_BODY_LENGTH = 4000;

export interface TextDraft {
  id: string;
  sourceContentId?: string;
  sourceTitleSnapshot?: string;
  targetPlatform: ContentPlatform;
  title: string;
  headline?: string;
  body: string;
  /** ISO 8601 zaman damgası. */
  createdAt: string;
  /** ISO 8601 zaman damgası. */
  updatedAt: string;
}

export type TextDraftInput = Pick<TextDraft, 'title' | 'targetPlatform' | 'body'> &
  Partial<Pick<TextDraft, 'headline' | 'sourceContentId' | 'sourceTitleSnapshot'>>;

export type TextDraftChanges = Partial<TextDraftInput>;

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

export function isTextDraft(value: unknown): value is TextDraft {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const item = value as Record<string, unknown>;
  return (
    typeof item['id'] === 'string' &&
    item['id'].length > 0 &&
    typeof item['title'] === 'string' &&
    item['title'].trim().length > 0 &&
    isContentPlatform(item['targetPlatform']) &&
    typeof item['body'] === 'string' &&
    item['body'].trim().length > 0 &&
    isOptionalString(item['headline']) &&
    isOptionalString(item['sourceContentId']) &&
    isOptionalString(item['sourceTitleSnapshot']) &&
    isIsoTimestamp(item['createdAt']) &&
    isIsoTimestamp(item['updatedAt'])
  );
}

export function isTextDraftList(value: unknown): value is TextDraft[] {
  return Array.isArray(value) && value.every(isTextDraft);
}
