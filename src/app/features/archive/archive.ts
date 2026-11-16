import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ContentPlatform, ContentType } from '../../core/models/content.model';
import { ContentService } from '../../core/services/content.service';
import {
  ContentFilterState,
  ContentSortOption,
  DEFAULT_FILTER_STATE,
  SORT_OPTIONS,
  extractAvailableTags,
  filterAndSortContents,
  hasActiveFilters,
  isDateRangeInvalid,
  parseArchiveQueryParams,
  toArchiveQueryParams,
} from '../contents/content-filters';
import {
  PLATFORM_LABELS,
  PLATFORM_LOGOS,
  PLATFORM_OPTIONS,
  STATUS_LABELS,
  TYPE_LABELS,
  TYPE_OPTIONS,
  formatDate,
  formatTagLabel,
} from '../contents/content-labels';
import { computePlatformDistribution } from '../home/dashboard-stats';

@Component({
  selector: 'app-archive',
  imports: [RouterLink],
  templateUrl: './archive.html',
  styleUrl: './archive.css',
})
export class Archive {
  private readonly service = inject(ContentService);
  private readonly route = inject(ActivatedRoute, { optional: true });
  private readonly router = inject(Router, { optional: true });
  private readonly destroyRef = inject(DestroyRef);

  protected readonly loadError = this.service.loadError;
  protected readonly platformLabels = PLATFORM_LABELS;
  protected readonly platformLogos = PLATFORM_LOGOS;
  protected readonly typeLabels = TYPE_LABELS;
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly platformOptions = PLATFORM_OPTIONS;
  protected readonly typeOptions = TYPE_OPTIONS;
  protected readonly sortOptions = SORT_OPTIONS;
  protected readonly formatDate = formatDate;
  protected readonly formatTagLabel = formatTagLabel;

  protected readonly completedItems = computed(() =>
    this.service.items().filter((item) => item.status === 'completed'),
  );

  protected readonly platformDistribution = computed(() =>
    computePlatformDistribution(this.completedItems()),
  );

  protected readonly filters = signal<ContentFilterState>({ ...DEFAULT_FILTER_STATE });

  protected readonly availableTags = computed(() => extractAvailableTags(this.completedItems()));

  protected readonly dateRangeInvalid = computed(() => {
    const current = this.filters();
    return isDateRangeInvalid(current.dateFrom, current.dateTo);
  });

  protected readonly hasActiveFilters = computed(() => hasActiveFilters(this.filters()));

  protected readonly filteredItems = computed(() =>
    filterAndSortContents(this.completedItems(), this.filters()),
  );

  protected readonly activeQueryParams = computed(() => toArchiveQueryParams(this.filters()));

  protected readonly detailQueryParams = computed(() => ({
    ...this.activeQueryParams(),
    kaynak: 'arsiv',
  }));

  constructor() {
    if (this.route) {
      this.filters.set(parseArchiveQueryParams(this.route.snapshot.queryParams));
      this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
        const parsed = parseArchiveQueryParams(params);
        if (!sameArchiveFilterState(this.filters(), parsed)) {
          this.filters.set(parsed);
        }
      });
    }
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

  protected reload(): void {
    this.service.reload();
  }

  private patchFilters(partial: Partial<ContentFilterState>): void {
    this.filters.update((current) => ({ ...current, ...partial, status: '' }));
    this.syncQueryParams();
  }

  private syncQueryParams(): void {
    if (!this.router || !this.route) {
      return;
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: toArchiveQueryParams(this.filters()),
      replaceUrl: true,
    });
  }
}

function sameArchiveFilterState(a: ContentFilterState, b: ContentFilterState): boolean {
  return (
    a.query === b.query &&
    a.platform === b.platform &&
    a.contentType === b.contentType &&
    a.tag === b.tag &&
    a.dateFrom === b.dateFrom &&
    a.dateTo === b.dateTo &&
    a.sort === b.sort
  );
}
