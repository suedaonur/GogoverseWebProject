import { ContentItem, ContentPlatform } from '../../core/models/content.model';
import { formatFullTurkishDate } from '../calendar/calendar-utils';
import { PLATFORM_LABELS, formatTagLabel } from '../contents/content-labels';

export interface GeneratedDraft {
  targetPlatform: ContentPlatform;
  suggestedTitle: string;
  headline?: string;
  body: string;
}

export const PLATFORM_TEMPLATE_DESCRIPTIONS: Record<ContentPlatform, string> = {
  kick: 'Kick — Yayın başlığı ve açıklaması',
  discord: 'Discord — Topluluk duyurusu',
  instagram: 'Instagram — Reels veya gönderi açıklaması',
  tiktok: 'TikTok — Kısa video metni ve mini senaryo',
};

export function normalizeHashtags(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of tags) {
    const formatted = formatTagLabel(raw);
    if (!formatted) {
      continue;
    }
    const key = formatted.slice(1).toLocaleLowerCase('tr-TR');
    if (!seen.has(key)) {
      seen.add(key);
      result.push(formatted);
    }
  }

  return result;
}

function getDistinctGameOrEvent(title: string, gameOrEvent?: string): string | null {
  const cleanGame = gameOrEvent?.trim();
  if (!cleanGame) {
    return null;
  }
  const normalizedTitle = title.trim().toLocaleLowerCase('tr-TR');
  const normalizedGame = cleanGame.toLocaleLowerCase('tr-TR');
  if (normalizedTitle.includes(normalizedGame)) {
    return null;
  }
  return cleanGame;
}

export function generateDraftText(
  content: ContentItem,
  targetPlatform: ContentPlatform,
): GeneratedDraft {
  const title = content.title.trim();
  const distinctGame = getDistinctGameOrEvent(title, content.gameOrEvent);
  const subject = content.gameOrEvent?.trim() || title;
  const description = content.description?.trim() || '';
  const turkishDate = formatFullTurkishDate(content.date);
  const time = content.time.trim();
  const team = content.team.map((member) => member.trim()).filter((member) => member.length > 0);
  const hashtags = normalizeHashtags(content.tags);
  const suggestedTitle = `${title} — ${PLATFORM_LABELS[targetPlatform]} Taslağı`;

  switch (targetPlatform) {
    case 'kick': {
      const headline = distinctGame
        ? `⚔️ GÖGÖVERSE | ${title} — ${distinctGame}`
        : `⚔️ GÖGÖVERSE | ${title}`;

      const lines: string[] = ['Şogunlar, yeni yayın planımız hazır! ⚔️', '', `🎮 ${title}`];
      if (distinctGame) {
        lines.push(`🕹️ Oyun / Etkinlik: ${distinctGame}`);
      }
      if (description) {
        lines.push('', description);
      }
      lines.push('', `📅 ${turkishDate}`, `🕘 ${time}`);
      if (team.length > 0) {
        lines.push(`👥 ${team.join(', ')}`);
      }
      if (hashtags.length > 0) {
        lines.push('', hashtags.join(' '));
      }

      return {
        targetPlatform,
        suggestedTitle,
        headline,
        body: lines.join('\n'),
      };
    }

    case 'discord': {
      const lines: string[] = ['⚔️ Şogunlar, yeni etkinlik planımız hazır!', '', `🎮 ${title}`];
      if (distinctGame) {
        lines.push(`🕹️ Oyun / Etkinlik: ${distinctGame}`);
      }
      lines.push(`📅 ${turkishDate}`, `⏰ ${time}`);
      if (team.length > 0) {
        lines.push(`👥 ${team.join(', ')}`);
      }
      if (description) {
        lines.push('', description);
      }
      if (hashtags.length > 0) {
        lines.push('', hashtags.join(' '));
      }
      lines.push('', 'Hazır olun Şogunlar!');

      return {
        targetPlatform,
        suggestedTitle,
        body: lines.join('\n'),
      };
    }

    case 'instagram': {
      const lines: string[] = [
        `⚔️ Şogunlar, ${subject} macerasına hazır mısınız?`,
        '',
        `GÖGÖVERSE'te yeni bir içerik planı: ${title}`,
      ];
      if (description) {
        lines.push('', description);
      }
      lines.push('', `📅 ${turkishDate} • ${time}`);
      if (team.length > 0) {
        lines.push(`👥 ${team.join(', ')}`);
      }
      lines.push('', 'Sizce bu kez neler olacak? 👀');
      if (hashtags.length > 0) {
        lines.push('', hashtags.join(' '));
      }

      return {
        targetPlatform,
        suggestedTitle,
        body: lines.join('\n'),
      };
    }

    case 'tiktok': {
      const ideaLine = distinctGame
        ? `🎬 Video Fikri: ${title} (${distinctGame})`
        : `🎬 Video Fikri: ${title}`;
      const mainSection = description
        ? `🎮 Ana Bölüm: ${description}`
        : '🎮 Ana Bölüm: Yayından seçilen önemli anları kısa ve tempolu şekilde göster.';
      const scheduleMeta =
        team.length > 0
          ? `📅 Plan Bilgisi: ${turkishDate} • ${time} | 👥 ${team.join(', ')}`
          : `📅 Plan Bilgisi: ${turkishDate} • ${time}`;

      const lines: string[] = [
        ideaLine,
        '',
        `⚡ İlk 3 Saniye — Dikkat Çekici Giriş: Şogunlar, ${subject} macerasına hazır mısınız?`,
        '',
        mainSection,
        '',
        scheduleMeta,
        '',
        '⚔️ Kapanış / İzleyiciye Soru: Sıradaki macerada hangi oyunu görmek istersiniz?',
      ];
      if (hashtags.length > 0) {
        lines.push('', hashtags.join(' '));
      }

      return {
        targetPlatform,
        suggestedTitle,
        body: lines.join('\n'),
      };
    }
  }
}
