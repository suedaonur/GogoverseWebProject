import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
} from '@angular/forms';
import {
  ContentInput,
  ContentItem,
  isContentPlatform,
  isContentStatus,
  isContentType,
  isValidDate,
  isValidTime,
} from '../../../core/models/content.model';
import { ContentService } from '../../../core/services/content.service';
import {
  TagUsageItem,
  TeamUsageItem,
  extractTagUsage,
  extractTeamUsage,
  normalizeTagKey,
  normalizeTeamKey,
} from '../content-filters';
import {
  PLATFORM_LOGOS,
  PLATFORM_OPTIONS,
  QUICK_TIMES,
  STATUS_OPTIONS,
  TYPE_OPTIONS,
  formatTagLabel,
} from '../content-labels';

export function parseList(text: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of text.split(',')) {
    const entry = part.trim();
    const key = normalizeTeamKey(entry);
    if (key.length > 0 && !seen.has(key)) {
      seen.add(key);
      result.push(entry);
    }
  }
  return result;
}

export function parseTagList(text: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of text.split(',')) {
    const entry = part.trim();
    const key = normalizeTagKey(entry);
    if (key.length > 0 && !seen.has(key)) {
      seen.add(key);
      result.push(entry);
    }
  }
  return result;
}

const requiredText: ValidatorFn = (control) =>
  String(control.value ?? '').trim().length > 0 ? null : { required: true };

const matches =
  (guard: (value: unknown) => boolean): ValidatorFn =>
  (control: AbstractControl): ValidationErrors | null =>
    guard(control.value) ? null : { invalid: true };

const ERROR_MESSAGES = {
  title: 'İçerik başlığı zorunludur.',
  platform: 'Bir platform seçmelisin.',
  contentType: 'Bir içerik türü seçmelisin.',
  date: 'Geçerli bir tarih seçmelisin.',
  time: 'Geçerli bir saat gir.',
  status: 'Bir durum seçmelisin.',
} as const;

type RequiredField = keyof typeof ERROR_MESSAGES;

@Component({
  selector: 'app-content-form',
  imports: [ReactiveFormsModule],
  templateUrl: './content-form.html',
  styleUrl: './content-form.css',
})
export class ContentForm implements OnInit, AfterViewInit {
  private readonly builder = inject(FormBuilder);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly contentService = inject(ContentService, { optional: true });

  readonly item = input<ContentItem>();
  readonly rescheduleSource = input<ContentItem>();
  readonly initialDate = input<string>();
  readonly serviceError = input<string | null>(null);
  readonly saved = output<ContentInput>();
  readonly cancelled = output<void>();

  protected readonly platforms = PLATFORM_OPTIONS;
  protected readonly platformLogos = PLATFORM_LOGOS;
  protected readonly types = TYPE_OPTIONS;
  protected readonly statuses = STATUS_OPTIONS;
  protected readonly quickTimes = QUICK_TIMES;
  protected readonly formatTagLabel = formatTagLabel;
  protected readonly submitted = signal(false);

  protected readonly tagMenuOpen = signal(false);
  protected readonly tagSearchToken = signal('');
  protected readonly activeTagIndex = signal(-1);

  protected readonly teamMenuOpen = signal(false);
  protected readonly teamSearchToken = signal('');
  protected readonly activeTeamIndex = signal(-1);

  protected readonly allTagUsages = computed<TagUsageItem[]>(() =>
    extractTagUsage(this.contentService?.items() ?? []),
  );
  protected readonly allTeamUsages = computed<TeamUsageItem[]>(() =>
    extractTeamUsage(this.contentService?.items() ?? []),
  );

  protected readonly form = this.builder.nonNullable.group({
    title: ['', requiredText],
    platform: ['', matches(isContentPlatform)],
    contentType: ['', matches(isContentType)],
    gameOrEvent: [''],
    date: ['', matches(isValidDate)],
    time: ['', matches(isValidTime)],
    status: ['planned', matches(isContentStatus)],
    description: [''],
    notes: [''],
    team: [''],
    tags: [''],
  });

  ngOnInit(): void {
    const item = this.item();
    if (item) {
      this.form.setValue({
        title: item.title,
        platform: item.platform,
        contentType: item.contentType,
        gameOrEvent: item.gameOrEvent ?? '',
        date: item.date,
        time: item.time,
        status: item.status,
        description: item.description ?? '',
        notes: item.notes ?? '',
        team: item.team.join(', '),
        tags: item.tags.join(', '),
      });
      return;
    }
    const source = this.rescheduleSource();
    if (source) {
      // Eski arşiv kaydını koru; yeni plan ayrı kayıt olarak açılır.
      this.form.setValue({
        title: source.title,
        platform: source.platform,
        contentType: source.contentType,
        gameOrEvent: source.gameOrEvent ?? '',
        date: '',
        time: source.time,
        status: 'planned',
        description: source.description ?? '',
        notes: source.notes ?? '',
        team: [...source.team].join(', '),
        tags: [...source.tags].join(', '),
      });
      return;
    }
    const prefillDate = this.initialDate();
    if (prefillDate && isValidDate(prefillDate)) {
      this.form.controls.date.setValue(prefillDate);
    }
  }

  ngAfterViewInit(): void {
    const element = this.host.nativeElement;
    element.scrollIntoView?.({ block: 'nearest' });
    element.querySelector<HTMLInputElement>('#content-title')?.focus();
  }

  protected selectedPlatformLogo(): string | null {
    const val = this.form.controls.platform.value;
    return isContentPlatform(val) ? this.platformLogos[val] : null;
  }

  protected formHeading(): string {
    if (this.item()) {
      return 'İçeriği Düzenle';
    }
    if (this.rescheduleSource()) {
      return 'İçeriği Yeniden Planla';
    }
    return 'Yeni İçerik Ekle';
  }

  protected submitLabel(): string {
    if (!this.item() && this.rescheduleSource()) {
      return 'Yeni Plan Oluştur';
    }
    return 'Kaydet';
  }

  protected showError(field: RequiredField): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.touched || this.submitted());
  }

  protected errorMessage(field: RequiredField): string {
    return ERROR_MESSAGES[field];
  }

  protected setQuickTime(time: string): void {
    this.form.controls.time.setValue(time);
    this.form.controls.time.markAsTouched();
  }

  protected currentTeam(): string[] {
    return parseList(this.form.controls.team.value);
  }

  protected removeTeamMemberFromForm(memberToRemove: string): void {
    const targetKey = normalizeTeamKey(memberToRemove);
    const remaining = this.currentTeam().filter((member) => normalizeTeamKey(member) !== targetKey);
    this.form.controls.team.setValue(remaining.join(', '));
    this.form.controls.team.markAsDirty();
  }

  protected currentTags(): string[] {
    return parseTagList(this.form.controls.tags.value);
  }

  protected removeTagFromForm(tagToRemove: string): void {
    const targetKey = normalizeTagKey(tagToRemove);
    const remaining = this.currentTags().filter((tag) => normalizeTagKey(tag) !== targetKey);
    this.form.controls.tags.setValue(remaining.join(', '));
    this.form.controls.tags.markAsDirty();
  }

  protected filteredTagSuggestions(): TagUsageItem[] {
    const rawValue = this.form.controls.tags.value;
    const searchKey = normalizeTagKey(this.tagSearchToken());
    const committedText =
      searchKey.length > 0 ? rawValue.split(',').slice(0, -1).join(',') : rawValue;
    const selectedKeys = new Set(parseTagList(committedText).map(normalizeTagKey));

    return this.allTagUsages().filter((usage) => {
      if (selectedKeys.has(usage.key)) {
        return false;
      }
      if (searchKey.length > 0 && !usage.key.includes(searchKey)) {
        return false;
      }
      return true;
    });
  }

  protected filteredTeamSuggestions(): TeamUsageItem[] {
    const rawValue = this.form.controls.team.value;
    const searchKey = normalizeTeamKey(this.teamSearchToken());
    const committedText =
      searchKey.length > 0 ? rawValue.split(',').slice(0, -1).join(',') : rawValue;
    const selectedKeys = new Set(parseList(committedText).map(normalizeTeamKey));

    return this.allTeamUsages().filter((usage) => {
      if (selectedKeys.has(usage.key)) {
        return false;
      }
      if (searchKey.length > 0 && !usage.key.includes(searchKey)) {
        return false;
      }
      return true;
    });
  }

  protected toggleTagMenu(): void {
    if (this.tagMenuOpen()) {
      this.closeTagMenu();
      return;
    }
    this.teamMenuOpen.set(false);
    this.tagSearchToken.set('');
    this.tagMenuOpen.set(true);
    this.activeTagIndex.set(this.filteredTagSuggestions().length > 0 ? 0 : -1);
  }

  protected closeTagMenu(): void {
    this.tagMenuOpen.set(false);
    this.tagSearchToken.set('');
    this.activeTagIndex.set(-1);
  }

  protected onTagsInput(rawValue: string): void {
    const lastSegment = rawValue.split(',').pop()?.trim() ?? '';
    this.tagSearchToken.set(lastSegment);
    if (lastSegment.length > 0 && this.filteredTagSuggestions().length > 0) {
      this.teamMenuOpen.set(false);
      this.tagMenuOpen.set(true);
      this.activeTagIndex.set(0);
    } else if (lastSegment.length === 0) {
      this.activeTagIndex.set(this.filteredTagSuggestions().length > 0 ? 0 : -1);
    }
  }

  protected selectTagSuggestion(tag: string): void {
    const rawValue = this.form.controls.tags.value;
    const hasSearchToken = normalizeTagKey(this.tagSearchToken()).length > 0;
    const baseSegments = hasSearchToken ? rawValue.split(',').slice(0, -1) : rawValue.split(',');
    const nextList = parseTagList([...baseSegments, tag].join(', '));
    this.form.controls.tags.setValue(nextList.join(', '));
    this.form.controls.tags.markAsDirty();
    this.closeTagMenu();
  }

  protected onTagsKeydown(event: KeyboardEvent): void {
    const suggestions = this.filteredTagSuggestions();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!this.tagMenuOpen()) {
        this.teamMenuOpen.set(false);
        this.tagSearchToken.set('');
        this.tagMenuOpen.set(true);
        const opened = this.filteredTagSuggestions();
        this.activeTagIndex.set(opened.length > 0 ? 0 : -1);
        return;
      }
      if (suggestions.length > 0) {
        this.activeTagIndex.update((idx) => (idx + 1) % suggestions.length);
      }
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!this.tagMenuOpen()) {
        this.teamMenuOpen.set(false);
        this.tagSearchToken.set('');
        this.tagMenuOpen.set(true);
        const opened = this.filteredTagSuggestions();
        this.activeTagIndex.set(opened.length > 0 ? opened.length - 1 : -1);
        return;
      }
      if (suggestions.length > 0) {
        this.activeTagIndex.update((idx) => (idx <= 0 ? suggestions.length - 1 : idx - 1));
      }
      return;
    }
    if (event.key === 'Enter' && this.tagMenuOpen()) {
      const idx = this.activeTagIndex();
      if (idx >= 0 && idx < suggestions.length) {
        event.preventDefault();
        this.selectTagSuggestion(suggestions[idx].tag);
      }
      return;
    }
    if (event.key === 'Escape' && this.tagMenuOpen()) {
      event.preventDefault();
      event.stopPropagation();
      this.closeTagMenu();
      return;
    }
    if (event.key === 'Tab') {
      this.closeTagMenu();
    }
  }

  protected toggleTeamMenu(): void {
    if (this.teamMenuOpen()) {
      this.closeTeamMenu();
      return;
    }
    this.tagMenuOpen.set(false);
    this.teamSearchToken.set('');
    this.teamMenuOpen.set(true);
    this.activeTeamIndex.set(this.filteredTeamSuggestions().length > 0 ? 0 : -1);
  }

  protected closeTeamMenu(): void {
    this.teamMenuOpen.set(false);
    this.teamSearchToken.set('');
    this.activeTeamIndex.set(-1);
  }

  protected onTeamInput(rawValue: string): void {
    const lastSegment = rawValue.split(',').pop()?.trim() ?? '';
    this.teamSearchToken.set(lastSegment);
    if (lastSegment.length > 0 && this.filteredTeamSuggestions().length > 0) {
      this.tagMenuOpen.set(false);
      this.teamMenuOpen.set(true);
      this.activeTeamIndex.set(0);
    } else if (lastSegment.length === 0) {
      this.activeTeamIndex.set(this.filteredTeamSuggestions().length > 0 ? 0 : -1);
    }
  }

  protected selectTeamSuggestion(memberName: string): void {
    const rawValue = this.form.controls.team.value;
    const hasSearchToken = normalizeTeamKey(this.teamSearchToken()).length > 0;
    const baseSegments = hasSearchToken ? rawValue.split(',').slice(0, -1) : rawValue.split(',');
    const nextList = parseList([...baseSegments, memberName].join(', '));
    this.form.controls.team.setValue(nextList.join(', '));
    this.form.controls.team.markAsDirty();
    this.closeTeamMenu();
  }

  protected onTeamKeydown(event: KeyboardEvent): void {
    const suggestions = this.filteredTeamSuggestions();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!this.teamMenuOpen()) {
        this.tagMenuOpen.set(false);
        this.teamSearchToken.set('');
        this.teamMenuOpen.set(true);
        const opened = this.filteredTeamSuggestions();
        this.activeTeamIndex.set(opened.length > 0 ? 0 : -1);
        return;
      }
      if (suggestions.length > 0) {
        this.activeTeamIndex.update((idx) => (idx + 1) % suggestions.length);
      }
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!this.teamMenuOpen()) {
        this.tagMenuOpen.set(false);
        this.teamSearchToken.set('');
        this.teamMenuOpen.set(true);
        const opened = this.filteredTeamSuggestions();
        this.activeTeamIndex.set(opened.length > 0 ? opened.length - 1 : -1);
        return;
      }
      if (suggestions.length > 0) {
        this.activeTeamIndex.update((idx) => (idx <= 0 ? suggestions.length - 1 : idx - 1));
      }
      return;
    }
    if (event.key === 'Enter' && this.teamMenuOpen()) {
      const idx = this.activeTeamIndex();
      if (idx >= 0 && idx < suggestions.length) {
        event.preventDefault();
        this.selectTeamSuggestion(suggestions[idx].name);
      }
      return;
    }
    if (event.key === 'Escape' && this.teamMenuOpen()) {
      event.preventDefault();
      event.stopPropagation();
      this.closeTeamMenu();
      return;
    }
    if (event.key === 'Tab') {
      this.closeTeamMenu();
    }
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: Event): void {
    const target = event.target as Node | null;
    if (!target || !this.host.nativeElement.contains(target)) {
      this.closeTagMenu();
      this.closeTeamMenu();
      return;
    }
    const element = target as HTMLElement;
    if (!element.closest('.team-quick-select')) {
      this.closeTeamMenu();
    }
    if (!element.closest('.tag-quick-select')) {
      this.closeTagMenu();
    }
  }

  protected submit(): void {
    this.submitted.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.host.nativeElement
        .querySelector<HTMLElement>('.is-invalid')
        ?.focus();
      return;
    }
    const value = this.form.getRawValue();
    this.saved.emit({
      title: value.title.trim(),
      platform: value.platform as ContentInput['platform'],
      contentType: value.contentType as ContentInput['contentType'],
      gameOrEvent: value.gameOrEvent.trim(),
      date: value.date,
      time: value.time,
      status: value.status as ContentInput['status'],
      description: value.description.trim(),
      notes: value.notes.trim(),
      team: parseList(value.team),
      tags: parseTagList(value.tags),
    });
  }
}
