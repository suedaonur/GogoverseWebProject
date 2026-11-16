import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ContentService } from '../../core/services/content.service';
import { TodoService } from '../../core/services/todo.service';
import {
  PLATFORM_LABELS,
  PLATFORM_LOGOS,
  STATUS_LABELS,
  TYPE_LABELS,
  formatDate,
  formatTagLabel,
} from '../contents/content-labels';
import {
  computeContentStats,
  computePlatformDistribution,
  computeTodoStats,
  selectNextKickStream,
  selectUpcomingContents,
} from './dashboard-stats';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  styleUrl: './home.css',
  templateUrl: './home.html',
})
export class Home {
  private readonly contentService = inject(ContentService);
  private readonly todoService = inject(TodoService);

  protected readonly contentLoadError = this.contentService.loadError;
  protected readonly todoLoadError = this.todoService.loadError;

  protected readonly platformLabels = PLATFORM_LABELS;
  protected readonly platformLogos = PLATFORM_LOGOS;
  protected readonly typeLabels = TYPE_LABELS;
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly formatDate = formatDate;
  protected readonly formatTagLabel = formatTagLabel;

  protected readonly referenceNow = signal<Date>(new Date());

  protected readonly stats = computed(() => computeContentStats(this.contentService.items()));
  protected readonly platformDistribution = computed(() =>
    computePlatformDistribution(this.contentService.items()),
  );
  protected readonly upcomingContents = computed(() =>
    selectUpcomingContents(this.contentService.items(), this.referenceNow()),
  );
  protected readonly nextKickStream = computed(() =>
    selectNextKickStream(this.contentService.items(), this.referenceNow()),
  );
  protected readonly todoStats = computed(() => computeTodoStats(this.todoService.items()));

  protected reloadContents(): void {
    this.contentService.reload();
  }

  protected reloadTodos(): void {
    this.todoService.reload();
  }
}
