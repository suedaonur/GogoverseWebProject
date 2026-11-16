import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { ContentPlatform, isContentPlatform } from '../../core/models/content.model';
import {
  MAX_DRAFT_BODY_LENGTH,
  MAX_DRAFT_HEADLINE_LENGTH,
  MAX_DRAFT_TITLE_LENGTH,
  TextDraft,
} from '../../core/models/text-draft.model';
import { ContentService } from '../../core/services/content.service';
import { DraftService } from '../../core/services/draft.service';
import {
  PLATFORM_LABELS,
  PLATFORM_LOGOS,
  PLATFORM_OPTIONS,
  STATUS_LABELS,
  TYPE_LABELS,
  formatDate,
  formatDateTime,
} from '../contents/content-labels';
import { PLATFORM_TEMPLATE_DESCRIPTIONS, generateDraftText } from './draft-templates';

@Component({
  selector: 'app-drafts',
  imports: [RouterLink],
  templateUrl: './drafts.html',
  styleUrl: './drafts.css',
})
export class Drafts {
  private readonly contentService = inject(ContentService);
  private readonly draftService = inject(DraftService);
  private readonly route = inject(ActivatedRoute, { optional: true });
  private readonly router = inject(Router, { optional: true });
  private readonly destroyRef = inject(DestroyRef);

  protected readonly contentItems = this.contentService.items;
  protected readonly contentLoadError = this.contentService.loadError;
  protected readonly savedDrafts = this.draftService.items;
  protected readonly draftLoadError = this.draftService.loadError;

  protected readonly platformLabels = PLATFORM_LABELS;
  protected readonly platformLogos = PLATFORM_LOGOS;
  protected readonly platformOptions = PLATFORM_OPTIONS;
  protected readonly typeLabels = TYPE_LABELS;
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly templateDescriptions = PLATFORM_TEMPLATE_DESCRIPTIONS;
  protected readonly formatDate = formatDate;
  protected readonly formatDateTime = formatDateTime;

  protected readonly maxTitleLength = MAX_DRAFT_TITLE_LENGTH;
  protected readonly maxHeadlineLength = MAX_DRAFT_HEADLINE_LENGTH;
  protected readonly maxBodyLength = MAX_DRAFT_BODY_LENGTH;

  protected readonly selectedContentId = signal<string>('');
  protected readonly selectedPlatform = signal<ContentPlatform>('kick');
  protected readonly sourceParamWarning = signal<string | null>(null);

  protected readonly hasPreview = signal(false);
  protected readonly isDirty = signal(false);
  protected readonly editingDraftId = signal<string | null>(null);
  protected readonly previewPlatform = signal<ContentPlatform>('kick');
  protected readonly previewSourceContentId = signal<string | undefined>(undefined);
  protected readonly previewSourceTitleSnapshot = signal<string | undefined>(undefined);

  protected readonly draftTitle = signal('');
  protected readonly draftHeadline = signal('');
  protected readonly draftBody = signal('');

  protected readonly saveSubmitted = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly copyError = signal<string | null>(null);

  protected readonly regenerateConfirmOpen = signal(false);
  protected readonly deleteTarget = signal<TextDraft | null>(null);
  protected readonly deleteError = signal<string | null>(null);

  protected readonly draftSearchQuery = signal('');
  protected readonly draftPlatformFilter = signal<ContentPlatform | ''>('');

  private readonly deleteDialog = viewChild<ElementRef<HTMLElement>>('deleteDialog');
  private readonly cancelDeleteButton =
    viewChild<ElementRef<HTMLButtonElement>>('cancelDeleteButton');
  private readonly regenerateDialog = viewChild<ElementRef<HTMLElement>>('regenerateDialog');
  private readonly cancelRegenerateButton =
    viewChild<ElementRef<HTMLButtonElement>>('cancelRegenerateButton');
  private dialogTrigger: HTMLElement | null = null;

  protected readonly effectiveSelectedContentId = computed(() => {
    const all = this.contentItems();
    const id = this.selectedContentId();
    if (id && all.some((item) => item.id === id)) {
      return id;
    }
    return all[0]?.id ?? '';
  });

  protected readonly selectedContent = computed(() => {
    const id = this.effectiveSelectedContentId();
    return id ? this.contentService.getById(id) : undefined;
  });

  protected readonly contentIdSet = computed(
    () => new Set(this.contentItems().map((item) => item.id)),
  );

  protected readonly previewSourceMissing = computed(() => {
    const srcId = this.previewSourceContentId();
    if (!srcId) {
      return false;
    }
    return !this.contentIdSet().has(srcId);
  });

  protected readonly titleValidationError = computed(() => {
    const val = this.draftTitle().trim();
    if (val.length === 0) {
      return 'Taslak adı boş olamaz.';
    }
    if (val.length > MAX_DRAFT_TITLE_LENGTH) {
      return `Taslak adı en fazla ${MAX_DRAFT_TITLE_LENGTH} karakter olabilir.`;
    }
    return null;
  });

  protected readonly headlineValidationError = computed(() => {
    if (this.previewPlatform() !== 'kick') {
      return null;
    }
    const val = this.draftHeadline().trim();
    if (val.length === 0) {
      return 'Kick yayın başlığı boş olamaz.';
    }
    if (val.length > MAX_DRAFT_HEADLINE_LENGTH) {
      return `Kick yayın başlığı en fazla ${MAX_DRAFT_HEADLINE_LENGTH} karakter olabilir.`;
    }
    return null;
  });

  protected readonly bodyValidationError = computed(() => {
    const val = this.draftBody().trim();
    if (val.length === 0) {
      return 'Taslak metni boş olamaz.';
    }
    if (val.length > MAX_DRAFT_BODY_LENGTH) {
      return `Taslak metni en fazla ${MAX_DRAFT_BODY_LENGTH} karakter olabilir.`;
    }
    return null;
  });

  protected readonly filteredSavedDrafts = computed(() => {
    const query = this.draftSearchQuery().trim().toLocaleLowerCase('tr-TR');
    const platform = this.draftPlatformFilter();

    return this.savedDrafts()
      .filter((draft) => {
        if (platform && draft.targetPlatform !== platform) {
          return false;
        }
        if (query.length > 0) {
          const haystack = [
            draft.title,
            draft.headline ?? '',
            draft.body,
            draft.sourceTitleSnapshot ?? '',
            PLATFORM_LABELS[draft.targetPlatform],
          ]
            .join(' ')
            .toLocaleLowerCase('tr-TR');
          if (!haystack.includes(query)) {
            return false;
          }
        }
        return true;
      })
      .slice()
      .sort(
        (a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id),
      );
  });

  constructor() {
    this.initializeSelection(this.route?.snapshot.queryParams ?? {});
    if (this.route) {
      this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
        if (params['icerik'] !== undefined) {
          this.handleIcerikQueryParam(params['icerik']);
        } else if (!this.selectedContentId() && this.contentItems().length > 0) {
          this.selectedContentId.set(this.contentItems()[0].id);
        }
      });
    }
  }

  private initializeSelection(params: Params): void {
    if (params['icerik'] !== undefined) {
      this.handleIcerikQueryParam(params['icerik']);
      return;
    }
    const all = this.contentItems();
    if (all.length > 0) {
      this.selectedContentId.set(all[0].id);
      this.selectedPlatform.set(all[0].platform);
    }
  }

  private handleIcerikQueryParam(rawId: unknown): void {
    if (typeof rawId !== 'string' || rawId.trim().length === 0) {
      this.sourceParamWarning.set(
        'Seçilen kaynak içerik bulunamadı. Listeden mevcut bir içerik seçebilirsin.',
      );
      this.clearIcerikParam();
      return;
    }
    const found = this.contentService.getById(rawId.trim());
    if (!found) {
      this.sourceParamWarning.set(
        'Seçilen kaynak içerik bulunamadı. Listeden mevcut bir içerik seçebilirsin.',
      );
      const all = this.contentItems();
      if (!this.selectedContentId() && all.length > 0) {
        this.selectedContentId.set(all[0].id);
      }
      this.clearIcerikParam();
      return;
    }
    this.sourceParamWarning.set(null);
    this.selectedContentId.set(found.id);
    this.selectedPlatform.set(found.platform);
  }

  private clearIcerikParam(): void {
    if (!this.router || !this.route) {
      return;
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {},
      replaceUrl: true,
    });
  }

  protected selectContent(id: string): void {
    this.selectedContentId.set(id);
    this.sourceParamWarning.set(null);
  }

  protected selectTargetPlatform(platform: string): void {
    if (isContentPlatform(platform)) {
      this.selectedPlatform.set(platform);
    }
  }

  protected requestGenerate(event?: Event): void {
    const content = this.selectedContent();
    if (!content) {
      return;
    }
    this.copyError.set(null);
    this.saveError.set(null);

    if (this.hasPreview() && this.isDirty()) {
      this.dialogTrigger =
        (event?.currentTarget as HTMLElement | null) ??
        (document.activeElement as HTMLElement | null);
      this.regenerateConfirmOpen.set(true);
      queueMicrotask(() => this.cancelRegenerateButton()?.nativeElement.focus());
      return;
    }

    this.applyGeneratedDraft();
  }

  protected confirmRegenerate(): void {
    this.regenerateConfirmOpen.set(false);
    this.dialogTrigger = null;
    this.applyGeneratedDraft();
  }

  protected cancelRegenerate(): void {
    if (!this.regenerateConfirmOpen()) {
      return;
    }
    this.regenerateConfirmOpen.set(false);
    const trigger = this.dialogTrigger;
    this.dialogTrigger = null;
    queueMicrotask(() => trigger?.focus());
  }

  private applyGeneratedDraft(): void {
    const content = this.selectedContent();
    if (!content) {
      return;
    }
    const targetPlatform = this.selectedPlatform();
    const generated = generateDraftText(content, targetPlatform);

    this.hasPreview.set(true);
    this.isDirty.set(false);
    this.editingDraftId.set(null);
    this.saveSubmitted.set(false);
    this.saveError.set(null);
    this.copyError.set(null);

    this.previewPlatform.set(targetPlatform);
    this.previewSourceContentId.set(content.id);
    this.previewSourceTitleSnapshot.set(content.title);
    this.draftTitle.set(generated.suggestedTitle);
    this.draftHeadline.set(generated.headline ?? '');
    this.draftBody.set(generated.body);

    this.notice.set(`${PLATFORM_LABELS[targetPlatform]} için metin taslağı oluşturuldu.`);
  }

  protected onDraftTitleInput(value: string): void {
    this.draftTitle.set(value);
    this.isDirty.set(true);
  }

  protected onDraftHeadlineInput(value: string): void {
    this.draftHeadline.set(value);
    this.isDirty.set(true);
  }

  protected onDraftBodyInput(value: string): void {
    this.draftBody.set(value);
    this.isDirty.set(true);
  }

  protected async copyHeadline(): Promise<void> {
    const text = this.draftHeadline().trim();
    if (!text) {
      return;
    }
    await this.writeToClipboard(text, 'Kick yayın başlığı panoya kopyalandı.');
  }

  protected async copyBody(): Promise<void> {
    const text = this.draftBody().trim();
    if (!text) {
      return;
    }
    const msg =
      this.previewPlatform() === 'kick'
        ? 'Kick yayın açıklaması panoya kopyalandı.'
        : `${PLATFORM_LABELS[this.previewPlatform()]} metni panoya kopyalandı.`;
    await this.writeToClipboard(text, msg);
  }

  protected async copySavedDraft(draft: TextDraft): Promise<void> {
    const fullText =
      draft.targetPlatform === 'kick' && draft.headline
        ? `${draft.headline}\n\n${draft.body}`
        : draft.body;
    await this.writeToClipboard(fullText, `"${draft.title}" taslağı panoya kopyalandı.`);
  }

  private async writeToClipboard(text: string, successMessage: string): Promise<void> {
    this.copyError.set(null);
    const clipboard = globalThis.navigator?.clipboard;
    if (!clipboard || typeof clipboard.writeText !== 'function') {
      this.notice.set(null);
      this.copyError.set(
        'Tarayıcı kopyalama erişimi kullanılamıyor. Metni manuel olarak seçip kopyalayabilirsin.',
      );
      return;
    }
    try {
      await clipboard.writeText(text);
      this.notice.set(successMessage);
    } catch {
      this.notice.set(null);
      this.copyError.set(
        'Metin otomatik kopyalanamadı. Metni manuel olarak seçip kopyalayabilirsin.',
      );
    }
  }

  protected saveDraft(): void {
    this.saveSubmitted.set(true);
    this.saveError.set(null);
    this.copyError.set(null);

    if (
      this.titleValidationError() ||
      this.headlineValidationError() ||
      this.bodyValidationError()
    ) {
      return;
    }

    const platform = this.previewPlatform();
    const payload = {
      title: this.draftTitle().trim(),
      targetPlatform: platform,
      headline: platform === 'kick' ? this.draftHeadline().trim() : undefined,
      body: this.draftBody().trim(),
      sourceContentId: this.previewSourceContentId(),
      sourceTitleSnapshot: this.previewSourceTitleSnapshot(),
    };

    const existingId = this.editingDraftId();
    if (existingId) {
      const updated = this.draftService.update(existingId, payload);
      if (!updated.ok) {
        this.saveError.set(updated.message);
        return;
      }
      this.isDirty.set(false);
      this.saveSubmitted.set(false);
      this.notice.set(`"${updated.value.title}" taslağı güncellendi.`);
      return;
    }

    const created = this.draftService.create(payload);
    if (!created.ok) {
      this.saveError.set(created.message);
      return;
    }

    this.editingDraftId.set(created.value.id);
    this.isDirty.set(false);
    this.saveSubmitted.set(false);
    this.notice.set(`"${created.value.title}" taslağı kaydedildi.`);
  }

  protected openSavedDraft(draft: TextDraft): void {
    this.hasPreview.set(true);
    this.isDirty.set(false);
    this.editingDraftId.set(draft.id);
    this.saveSubmitted.set(false);
    this.saveError.set(null);
    this.copyError.set(null);

    this.previewPlatform.set(draft.targetPlatform);
    this.selectedPlatform.set(draft.targetPlatform);
    if (draft.sourceContentId && this.contentIdSet().has(draft.sourceContentId)) {
      this.selectedContentId.set(draft.sourceContentId);
    }
    this.previewSourceContentId.set(draft.sourceContentId);
    this.previewSourceTitleSnapshot.set(draft.sourceTitleSnapshot);
    this.draftTitle.set(draft.title);
    this.draftHeadline.set(draft.headline ?? '');
    this.draftBody.set(draft.body);

    this.notice.set(`"${draft.title}" taslağı düzenleme alanına yüklendi.`);
  }

  protected isDraftSourceMissing(draft: TextDraft): boolean {
    // Kaynak içerik silinmiş olsa da taslak korunur.
    if (!draft.sourceContentId) {
      return false;
    }
    return !this.contentIdSet().has(draft.sourceContentId);
  }

  protected askDelete(draft: TextDraft, event?: Event): void {
    this.dialogTrigger =
      (event?.currentTarget as HTMLElement | null) ??
      (document.activeElement as HTMLElement | null);
    this.deleteError.set(null);
    this.deleteTarget.set(draft);
    queueMicrotask(() => this.cancelDeleteButton()?.nativeElement.focus());
  }

  protected cancelDelete(): void {
    if (!this.deleteTarget()) {
      return;
    }
    this.deleteTarget.set(null);
    this.deleteError.set(null);
    const trigger = this.dialogTrigger;
    this.dialogTrigger = null;
    queueMicrotask(() => trigger?.focus());
  }

  protected confirmDelete(): void {
    const target = this.deleteTarget();
    if (!target) {
      return;
    }
    const result = this.draftService.delete(target.id);
    if (!result.ok) {
      this.deleteError.set(result.message);
      return;
    }
    if (this.editingDraftId() === target.id) {
      this.editingDraftId.set(null);
    }
    this.deleteTarget.set(null);
    this.deleteError.set(null);
    this.dialogTrigger = null;
    this.notice.set(`"${target.title}" taslağı silindi.`);
  }

  protected updateDraftSearch(query: string): void {
    this.draftSearchQuery.set(query);
  }

  protected updateDraftPlatformFilter(platform: string): void {
    this.draftPlatformFilter.set(platform as ContentPlatform | '');
  }

  protected clearDraftFilters(): void {
    this.draftSearchQuery.set('');
    this.draftPlatformFilter.set('');
  }

  protected reloadContents(): void {
    this.contentService.reload();
  }

  protected reloadDrafts(): void {
    this.draftService.reload();
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.deleteTarget()) {
      this.cancelDelete();
    } else if (this.regenerateConfirmOpen()) {
      this.cancelRegenerate();
    }
  }

  protected trapFocus(event: KeyboardEvent, which: 'delete' | 'regenerate'): void {
    if (event.key !== 'Tab') {
      return;
    }
    const dialog =
      which === 'delete'
        ? this.deleteDialog()?.nativeElement
        : this.regenerateDialog()?.nativeElement;
    if (!dialog) {
      return;
    }
    const focusables = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    if (focusables.length === 0) {
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
