import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Params, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { isValidDate } from '../../../core/models/content.model';
import { ContentService } from '../../../core/services/content.service';
import { isValidYearMonth } from '../../calendar/calendar-utils';
import {
  parseArchiveQueryParams,
  parseFilterQueryParams,
  toArchiveQueryParams,
  toFilterQueryParams,
} from '../content-filters';
import {
  PLATFORM_LABELS,
  PLATFORM_LOGOS,
  STATUS_LABELS,
  TYPE_LABELS,
  formatDate,
  formatDateTime,
  formatTagLabel,
} from '../content-labels';

@Component({
  selector: 'app-content-detail',
  imports: [RouterLink],
  templateUrl: './content-detail.html',
  styleUrl: './content-detail.css',
})
export class ContentDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(ContentService);

  protected readonly loadError = this.service.loadError;
  protected readonly platformLabels = PLATFORM_LABELS;
  protected readonly platformLogos = PLATFORM_LOGOS;
  protected readonly typeLabels = TYPE_LABELS;
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly formatDate = formatDate;
  protected readonly formatDateTime = formatDateTime;
  protected readonly formatTagLabel = formatTagLabel;

  private readonly itemId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('id') ?? '')),
    { initialValue: this.route.snapshot.paramMap.get('id') ?? '' },
  );

  protected readonly listQueryParams = toSignal(
    this.route.queryParams.pipe(
      map((params) => toFilterQueryParams(parseFilterQueryParams(params))),
    ),
    { initialValue: toFilterQueryParams(parseFilterQueryParams(this.route.snapshot.queryParams)) },
  );

  protected readonly fromCalendar = toSignal(
    this.route.queryParams.pipe(map((params) => params['kaynak'] === 'takvim')),
    { initialValue: this.route.snapshot.queryParams['kaynak'] === 'takvim' },
  );

  protected readonly calendarQueryParams = toSignal(
    this.route.queryParams.pipe(map((params) => extractSafeCalendarParams(params))),
    { initialValue: extractSafeCalendarParams(this.route.snapshot.queryParams) },
  );

  protected readonly fromArchive = toSignal(
    this.route.queryParams.pipe(map((params) => params['kaynak'] === 'arsiv')),
    { initialValue: this.route.snapshot.queryParams['kaynak'] === 'arsiv' },
  );

  protected readonly archiveQueryParams = toSignal(
    this.route.queryParams.pipe(
      map((params) => toArchiveQueryParams(parseArchiveQueryParams(params))),
    ),
    {
      initialValue: toArchiveQueryParams(
        parseArchiveQueryParams(this.route.snapshot.queryParams),
      ),
    },
  );

  protected readonly item = computed(() => {
    this.service.items();
    const id = this.itemId();
    return id ? this.service.getById(id) : undefined;
  });

  protected reload(): void {
    this.service.reload();
  }
}

function extractSafeCalendarParams(params: Params): Params {
  const safe: Params = {};
  if (isValidYearMonth(params['ay'])) {
    safe['ay'] = params['ay'];
  }
  if (isValidDate(params['gun'])) {
    safe['gun'] = params['gun'];
  }
  return safe;
}
