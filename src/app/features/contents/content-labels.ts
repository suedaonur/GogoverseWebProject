import {
  CONTENT_PLATFORMS,
  CONTENT_STATUSES,
  CONTENT_TYPES,
  ContentPlatform,
  ContentStatus,
  ContentType,
} from '../../core/models/content.model';

export const PLATFORM_LABELS: Record<ContentPlatform, string> = {
  kick: 'Kick',
  discord: 'Discord',
  instagram: 'Instagram',
  tiktok: 'TikTok',
};

export const PLATFORM_LOGOS: Record<ContentPlatform, string> = {
  kick: 'assets/platforms/kick_platform_logo.webp',
  discord: 'assets/platforms/discord_logo.webp',
  instagram: 'assets/platforms/instagram_logo.webp',
  tiktok: 'assets/platforms/tiktok_logo.webp',
};

export const TYPE_LABELS: Record<ContentType, string> = {
  live: 'Canlı Yayın',
  event: 'Etkinlik',
  reels: 'Reels',
  short_video: 'Kısa Video',
  post: 'Gönderi',
};

export const STATUS_LABELS: Record<ContentStatus, string> = {
  planned: 'Planlandı',
  in_progress: 'Devam Ediyor',
  completed: 'Tamamlandı',
  cancelled: 'İptal Edildi',
};

export const PLATFORM_OPTIONS = CONTENT_PLATFORMS.map((value) => ({
  value,
  label: PLATFORM_LABELS[value],
}));
export const TYPE_OPTIONS = CONTENT_TYPES.map((value) => ({ value, label: TYPE_LABELS[value] }));
export const STATUS_OPTIONS = CONTENT_STATUSES.map((value) => ({
  value,
  label: STATUS_LABELS[value],
}));

export const QUICK_TIMES = ['20:30', '21:00', '22:00', '23:00'] as const;

export function formatDate(date: string): string {
  const [year, month, day] = date.split('-');
  return `${day}.${month}.${year}`;
}

export function formatDateTime(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(parsed);
}

export function formatTagLabel(tag: string): string {
  const cleaned = tag.trim().replace(/^#+/, '').trim();
  return cleaned.length > 0 ? `#${cleaned}` : '';
}
