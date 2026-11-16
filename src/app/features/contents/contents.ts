import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import {
  ContentInput,
  ContentItem,
  ContentPlatform,
  ContentStatus,
  ContentType,
  isValidDate,
} from '../../core/models/content.model';
import { ContentService } from '../../core/services/content.service';
import {
  ContentFilterState,
  ContentSortOption,
  DEFAULT_FILTER_STATE,
  SORT_OPTIONS,
  TagUsageItem,
  TeamUsageItem,
  extractAvailableTags,
  extractTagUsage,
  extractTeamUsage,
  filterAndSortContents,
  hasActiveFilters,
  isDateRangeInvalid,
  normalizeTagKey,
  parseFilterQueryParams,
  toFilterQueryParams,
} from './content-filters';
import { ContentForm } from './content-form/content-form';
import {
  PLATFORM_LABELS,
  PLATFORM_LOGOS,
  PLATFORM_OPTIONS,
  STATUS_LABELS,
  STATUS_OPTIONS,
  TYPE_LABELS,
  TYPE_OPTIONS,
  formatDate,
  formatTagLabel,
} from './content-labels';

interface Editor {
  item?: ContentItem;
  rescheduleSource?: ContentItem;
  initialDate?: string;
}

@Component({
  selector: 'app-contents',
  imports: [ContentForm, RouterLink],
  templateUrl: './contents.html',
  styleUrl: './contents.css',
})
export class Contents {
  private readonly service = inject(ContentService);
  private readonly route = inject(ActivatedRoute, { optional: true });
  private readonly router = inject(Router, { optional: true });
  private readonly destroyRef = inject(DestroyRef);

  protected readonly items = this.service.items;
  protected readonly loadError = this.service.loadError;
  protected readonly platformLabels = PLATFORM_LABELS;
  protected readonly platformLogos = PLATFORM_LOGOS;
  protected readonly typeLabels = TYPE_LABELS;
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly platformOptions = PLATFORM_OPTIONS;
  protected readonly typeOptions = TYPE_OPTIONS;
  protected readonly statusOptions = STATUS_OPTIONS;
  protected readonly sortOptions = SORT_OPTIONS;
  protected readonly formatDate = formatDate;
  protected readonly formatTagLabel = formatTagLabel;

  protected readonly filters = signal<ContentFilterState>({ ...DEFAULT_FILTER_STATE });
  protected readonly availableTags = computed(() => extractAvailableTags(this.items()));
  protected readonly tagUsages = computed(() => extractTagUsage(this.items()));
  protected readonly tagManagerOpen = signal(false);
  protected readonly teamUsages = computed(() => extractTeamUsage(this.items()));
  protected readonly teamManagerOpen = signal(false);
  protected readonly dateRangeInvalid = computed(() => {
    const current = this.filters();
    return isDateRangeInvalid(current.dateFrom, current.dateTo);
  });
  protected readonly hasActiveFilters = computed(() => hasActiveFilters(this.filters()));
  protected readonly filteredItems = computed(() =>
    filterAndSortContents(this.items(), this.filters()),
  );
  protected readonly activeQueryParams = computed(() => toFilterQueryParams(this.filters()));

  protected readonly editor = signal<Editor | null>(null);
  protected readonly formKey = signal(0);
  protected readonly formKeys = computed(() => (this.editor() ? [this.formKey()] : []));
  protected readonly formError = signal<string | null>(null);
  protected readonly rescheduleError = signal<string | null>(null);
  protected readonly deleteTarget = signal<ContentItem | null>(null);
  protected readonly deleteError = signal<string | null>(null);
  protected readonly deleteTagTarget = signal<TagUsageItem | null>(null);
  protected readonly deleteTagError = signal<string | null>(null);
  protected readonly deleteTeamTarget = signal<TeamUsageItem | null>(null);
  protected readonly deleteTeamError = signal<string | null>(null);
  protected readonly notice = signal('');

  private readonly addButton = viewChild<ElementRef<HTMLButtonElement>>('addButton');
  private readonly manageTagsButton =
    viewChild<ElementRef<HTMLButtonElement>>('manageTagsButton');
  private readonly manageTeamButton =
    viewChild<ElementRef<HTMLButtonElement>>('manageTeamButton');
  private readonly cancelDeleteButton =
    viewChild<ElementRef<HTMLButtonElement>>('cancelDeleteButton');
  private readonly deleteDialog = viewChild<ElementRef<HTMLElement>>('deleteDialog');
  private readonly cancelDeleteTagButton =
    viewChild<ElementRef<HTMLButtonElement>>('cancelDeleteTagButton');
  private readonly deleteTagDialog = viewChild<ElementRef<HTMLElement>>('deleteTagDialog');
  private readonly cancelDeleteTeamButton =
    viewChild<ElementRef<HTMLButtonElement>>('cancelDeleteTeamButton');
  private readonly deleteTeamDialog = viewChild<ElementRef<HTMLElement>>('deleteTeamDialog');
  private deleteTrigger: HTMLElement | null = null;
  private deleteTagTrigger: HTMLElement | null = null;
  private deleteTeamTrigger: HTMLElement | null = null;

  constructor() {
    if (this.route) {
      const initialParams = this.route.snapshot.queryParams;
      this.filters.set(parseFilterQueryParams(initialParams));
      this.applyPlanQueryParams(initialParams);
      this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
        const parsed = parseFilterQueryParams(params);
        if (!sameFilterState(this.filters(), parsed)) {
          this.filters.set(parsed);
        }
        this.applyPlanQueryParams(params);
      });
    }
    effect(() => this.cancelDeleteButton()?.nativeElement.focus());
    effect(() => this.cancelDeleteTagButton()?.nativeElement.focus());
    effect(() => this.cancelDeleteTeamButton()?.nativeElement.focus());
  }

  protected updateQuery(query: string): void {
    this.patchFilters({ query });
  }

  protected updatePlatform(platform: string): void {
    this.patchFilters({ platform: platform as ContentPlatform | '' });
  }

  protected updateContentType(contentType: string): void {
    this.patchFilters({ contentType: contentType as ContentType | '' });
  }

  protected updateStatus(status: string): void {
    this.patchFilters({ status: status as ContentStatus | '' });
  }

  protected updateTag(tag: string): void {
    this.patchFilters({ tag });
  }

  protected updateDateFrom(dateFrom: string): void {
    this.patchFilters({ dateFrom });
  }

  protected updateDateTo(dateTo: string): void {
    this.patchFilters({ dateTo });
  }

  protected updateSort(sort: string): void {
    this.patchFilters({ sort: sort as ContentSortOption });
  }

  protected clearFilters(): void {
    this.filters.set({ ...DEFAULT_FILTER_STATE });
    this.syncQueryParams();
  }

  protected openCreate(): void {
    this.openEditor({});
  }

  protected openEdit(item: ContentItem): void {
    this.openEditor({ item });
  }

  protected closeEditor(): void {
    this.editor.set(null);
    this.formError.set(null);
    const currentParams = this.route?.snapshot.queryParams;
    if (
      currentParams &&
      ('yeni' in currentParams || 'tarih' in currentParams || 'yenidenPlanla' in currentParams)
    ) {
      this.syncQueryParams();
    }
  }

  protected save(input: ContentInput): void {
    const currentEditor = this.editor();
    const editing = currentEditor?.item;
    const isReschedule = Boolean(!editing && currentEditor?.rescheduleSource);
    const result = editing ? this.service.update(editing.id, input) : this.service.create(input);
    if (!result.ok) {
      this.formError.set(result.message);
      return;
    }
    this.closeEditor();
    this.notice.set(
      editing
        ? 'İçerik güncellendi.'
        : isReschedule
          ? 'Arşiv içeriğinden yeni plan oluşturuldu.'
          : 'İçerik eklendi.',
    );
  }

  protected askDelete(item: ContentItem, event: Event): void {
    this.deleteTrigger = event.currentTarget as HTMLElement;
    this.deleteError.set(null);
    this.deleteTarget.set(item);
  }

  protected cancelDelete(): void {
    this.deleteTarget.set(null);
    this.deleteError.set(null);
    this.deleteTrigger?.focus();
  }

  protected confirmDelete(): void {
    const target = this.deleteTarget();
    if (!target) {
      return;
    }
    const result = this.service.delete(target.id);
    if (!result.ok) {
      this.deleteError.set(result.message);
      return;
    }
    if (this.editor()?.item?.id === target.id) {
      this.closeEditor();
    }
    this.deleteTarget.set(null);
    this.notice.set('İçerik silindi.');
    this.addButton()?.nativeElement.focus();
  }

  protected reload(): void {
    this.service.reload();
  }

  protected toggleTagManager(): void {
    this.tagManagerOpen.update((open) => !open);
  }

  protected askDeleteTag(usage: TagUsageItem, event: Event): void {
    this.deleteTagTrigger = event.currentTarget as HTMLElement;
    this.deleteTagError.set(null);
    this.deleteTagTarget.set(usage);
  }

  protected cancelDeleteTag(): void {
    this.deleteTagTarget.set(null);
    this.deleteTagError.set(null);
    this.deleteTagTrigger?.focus();
  }

  protected confirmDeleteTag(): void {
    const target = this.deleteTagTarget();
    if (!target) {
      return;
    }
    const result = this.service.removeTagEverywhere(target.tag);
    if (!result.ok) {
      this.deleteTagError.set(result.message);
      return;
    }
    if (normalizeTagKey(this.filters().tag) === target.key) {
      this.patchFilters({ tag: '' });
    }
    this.deleteTagTarget.set(null);
    this.deleteTagError.set(null);
    this.notice.set(`${target.label} etiketi ${result.value} içerikten kaldırıldı.`);
    this.manageTagsButton()?.nativeElement.focus();
  }

  protected toggleTeamManager(): void {
    this.teamManagerOpen.update((open) => !open);
  }

  protected askDeleteTeamMember(usage: TeamUsageItem, event: Event): void {
    this.deleteTeamTrigger = event.currentTarget as HTMLElement;
    this.deleteTeamError.set(null);
    this.deleteTeamTarget.set(usage);
  }

  protected cancelDeleteTeamMember(): void {
    this.deleteTeamTarget.set(null);
    this.deleteTeamError.set(null);
    this.deleteTeamTrigger?.focus();
  }

  protected confirmDeleteTeamMember(): void {
    const target = this.deleteTeamTarget();
    if (!target) {
      return;
    }
    const result = this.service.removeTeamMemberEverywhere(target.name);
    if (!result.ok) {
      this.deleteTeamError.set(result.message);
      return;
    }
    this.deleteTeamTarget.set(null);
    this.deleteTeamError.set(null);
    this.notice.set(`${target.name} ekip üyesi ${result.value} içerikten kaldırıldı.`);
    this.manageTeamButton()?.nativeElement.focus();
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.deleteTeamTarget()) {
      this.cancelDeleteTeamMember();
      return;
    }
    if (this.deleteTagTarget()) {
      this.cancelDeleteTag();
      return;
    }
    if (this.deleteTarget()) {
      this.cancelDelete();
    }
  }

  protected trapFocus(event: KeyboardEvent): void {
    if (event.key !== 'Tab') {
      return;
    }
    const activeDialog =
      this.deleteTeamDialog()?.nativeElement ??
      this.deleteTagDialog()?.nativeElement ??
      this.deleteDialog()?.nativeElement;
    const buttons = activeDialog?.querySelectorAll('button');
    if (!buttons || buttons.length === 0) {
      return;
    }
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private patchFilters(partial: Partial<ContentFilterState>): void {
    this.filters.update((current) => ({ ...current, ...partial }));
    this.syncQueryParams();
  }

  private syncQueryParams(): void {
    if (!this.router || !this.route) {
      return;
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: toFilterQueryParams(this.filters()),
      replaceUrl: true,
    });
  }

  private openEditor(editor: Editor): void {
    this.formError.set(null);
    this.rescheduleError.set(null);
    this.notice.set('');
    this.formKey.update((key) => key + 1);
    this.editor.set(editor);
  }

  private applyPlanQueryParams(params: Params): void {
    if (this.loadError()) {
      return;
    }
    const rawRescheduleId = params['yenidenPlanla'];
    if (typeof rawRescheduleId === 'string' && rawRescheduleId.trim().length > 0) {
      const sourceId = rawRescheduleId.trim();
      const sourceItem = this.service.getById(sourceId);
      if (!sourceItem) {
        this.editor.set(null);
        this.rescheduleError.set('Yeniden planlanacak arşiv içeriği bulunamadı.');
        this.syncQueryParams();
        return;
      }
      if (sourceItem.status !== 'completed') {
        // Yalnızca tamamlanmış kayıt yeniden planlanabilir.
        this.editor.set(null);
        this.rescheduleError.set('Yalnızca tamamlanmış arşiv içerikleri yeniden planlanabilir.');
        this.syncQueryParams();
        return;
      }
      const currentEditor = this.editor();
      if (currentEditor && !currentEditor.item && currentEditor.rescheduleSource?.id === sourceItem.id) {
        return;
      }
      this.openEditor({ rescheduleSource: sourceItem });
      return;
    }

    const rawDate = params['tarih'];
    const validDate = isValidDate(rawDate) ? rawDate : undefined;
    const shouldOpenCreate = params['yeni'] === '1' || validDate !== undefined;
    if (!shouldOpenCreate) {
      return;
    }
    const currentEditor = this.editor();
    if (currentEditor && !currentEditor.item && currentEditor.initialDate === validDate) {
      return;
    }
    this.openEditor({ initialDate: validDate });
  }
}

function sameFilterState(a: ContentFilterState, b: ContentFilterState): boolean {
  return (
    a.query === b.query &&
    a.platform === b.platform &&
    a.contentType === b.contentType &&
    a.status === b.status &&
    a.tag === b.tag &&
    a.dateFrom === b.dateFrom &&
    a.dateTo === b.dateTo &&
    a.sort === b.sort
  );
}
