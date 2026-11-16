import {
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { TodoItem } from '../../core/models/todo.model';
import { TodoService } from '../../core/services/todo.service';
import { formatDateTime as formatTimestamp } from '../contents/content-labels';
import {
  TODO_STATUS_FILTER_OPTIONS,
  TodoStatusFilter,
  filterAndSortTodos,
} from './todo-filters';

export const MAX_TODO_TITLE_LENGTH = 120;
export const MAX_TODO_DESCRIPTION_LENGTH = 1000;

function trimmedRequired(control: AbstractControl<string>): ValidationErrors | null {
  return control.value.trim().length > 0 ? null : { required: true };
}

@Component({
  selector: 'app-todos',
  imports: [ReactiveFormsModule],
  templateUrl: './todos.html',
  styleUrl: './todos.css',
})
export class Todos {
  private readonly todoService = inject(TodoService);
  private readonly fb = inject(FormBuilder);

  protected readonly items = this.todoService.items;
  protected readonly loadError = this.todoService.loadError;
  protected readonly formatTimestamp = formatTimestamp;
  protected readonly filterOptions = TODO_STATUS_FILTER_OPTIONS;
  protected readonly maxTitleLength = MAX_TODO_TITLE_LENGTH;
  protected readonly maxDescriptionLength = MAX_TODO_DESCRIPTION_LENGTH;

  protected readonly totalCount = computed(() => this.items().length);
  protected readonly pendingCount = computed(
    () => this.items().filter((item) => !item.isCompleted).length,
  );
  protected readonly completedCount = computed(
    () => this.items().filter((item) => item.isCompleted).length,
  );

  protected readonly searchQuery = signal('');
  protected readonly statusFilter = signal<TodoStatusFilter>('all');

  protected readonly filteredItems = computed(() =>
    filterAndSortTodos(this.items(), this.searchQuery(), this.statusFilter()),
  );

  protected readonly emptyMessage = computed(() => {
    if (this.items().length === 0) {
      return 'Henüz görev eklenmedi. İlk görevini oluşturarak başlayabilirsin.';
    }
    if (this.searchQuery().trim().length > 0) {
      return 'Aramana uygun görev bulunamadı.';
    }
    if (this.statusFilter() === 'pending') {
      return 'Bekleyen görevin bulunmuyor. Tüm görevleri tamamlamış görünüyorsun!';
    }
    if (this.statusFilter() === 'completed') {
      return 'Henüz tamamlanmış görevin bulunmuyor.';
    }
    return 'Henüz görev eklenmedi. İlk görevini oluşturarak başlayabilirsin.';
  });

  protected readonly notice = signal<string | null>(null);
  protected readonly createSubmitted = signal(false);
  protected readonly createError = signal<string | null>(null);

  protected readonly editingId = signal<string | null>(null);
  protected readonly editSubmitted = signal(false);
  protected readonly editError = signal<string | null>(null);

  protected readonly toggleError = signal<string | null>(null);

  protected readonly deleteTarget = signal<TodoItem | null>(null);
  protected readonly deleteError = signal<string | null>(null);

  private readonly deleteDialog = viewChild<ElementRef<HTMLElement>>('deleteDialog');
  private readonly cancelDeleteButton =
    viewChild<ElementRef<HTMLButtonElement>>('cancelDeleteButton');
  private deleteTrigger: HTMLElement | null = null;

  protected readonly createForm = this.fb.nonNullable.group({
    title: ['', [trimmedRequired, Validators.maxLength(MAX_TODO_TITLE_LENGTH)]],
    description: ['', [Validators.maxLength(MAX_TODO_DESCRIPTION_LENGTH)]],
  });

  protected readonly editForm = this.fb.nonNullable.group({
    title: ['', [trimmedRequired, Validators.maxLength(MAX_TODO_TITLE_LENGTH)]],
    description: ['', [Validators.maxLength(MAX_TODO_DESCRIPTION_LENGTH)]],
  });

  protected submitCreate(): void {
    this.createSubmitted.set(true);
    this.createError.set(null);
    this.createForm.markAllAsTouched();
    if (this.createForm.invalid) {
      return;
    }

    const raw = this.createForm.getRawValue();
    const title = raw.title.trim();
    const description = raw.description.trim();

    const result = this.todoService.create({
      title,
      description: description ? description : undefined,
    });

    if (!result.ok) {
      this.createError.set(result.message);
      return;
    }

    this.createForm.reset({ title: '', description: '' });
    this.createSubmitted.set(false);
    this.notice.set(`"${result.value.title}" görevi eklendi.`);
  }

  protected startEdit(todo: TodoItem): void {
    this.editingId.set(todo.id);
    this.editSubmitted.set(false);
    this.editError.set(null);
    this.toggleError.set(null);
    this.editForm.reset({
      title: todo.title,
      description: todo.description ?? '',
    });
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
    this.editSubmitted.set(false);
    this.editError.set(null);
  }

  protected submitEdit(todoId: string): void {
    this.editSubmitted.set(true);
    this.editError.set(null);
    this.editForm.markAllAsTouched();
    if (this.editForm.invalid) {
      return;
    }

    const raw = this.editForm.getRawValue();
    const title = raw.title.trim();
    const description = raw.description.trim();

    const result = this.todoService.update(todoId, {
      title,
      description: description ? description : undefined,
    });

    if (!result.ok) {
      this.editError.set(result.message);
      return;
    }

    this.editingId.set(null);
    this.editSubmitted.set(false);
    this.notice.set(`"${result.value.title}" görevi güncellendi.`);
  }

  protected onToggleCompleted(todo: TodoItem, event: Event): void {
    this.toggleError.set(null);
    const checkbox = event.target as HTMLInputElement | null;
    const result = this.todoService.toggleCompleted(todo.id);
    if (!result.ok) {
      if (checkbox) {
        checkbox.checked = todo.isCompleted;
      }
      this.toggleError.set(result.message);
      return;
    }

    this.notice.set(
      result.value.isCompleted
        ? `"${result.value.title}" görevi tamamlandı olarak işaretlendi.`
        : `"${result.value.title}" görevi yeniden beklemeye alındı.`,
    );
  }

  protected askDelete(todo: TodoItem, event?: Event): void {
    this.deleteTrigger =
      (event?.currentTarget as HTMLElement | null) ??
      (document.activeElement as HTMLElement | null);
    this.deleteError.set(null);
    this.deleteTarget.set(todo);
    queueMicrotask(() => this.cancelDeleteButton()?.nativeElement.focus());
  }

  protected cancelDelete(): void {
    if (!this.deleteTarget()) {
      return;
    }
    this.deleteTarget.set(null);
    this.deleteError.set(null);
    const trigger = this.deleteTrigger;
    this.deleteTrigger = null;
    queueMicrotask(() => trigger?.focus());
  }

  protected confirmDelete(): void {
    const target = this.deleteTarget();
    if (!target) {
      return;
    }
    const result = this.todoService.delete(target.id);
    if (!result.ok) {
      this.deleteError.set(result.message);
      return;
    }
    if (this.editingId() === target.id) {
      this.cancelEdit();
    }
    this.deleteTarget.set(null);
    this.deleteError.set(null);
    this.deleteTrigger = null;
    this.notice.set(`"${target.title}" görevi silindi.`);
  }

  protected updateSearch(query: string): void {
    this.searchQuery.set(query);
  }

  protected setStatusFilter(filter: TodoStatusFilter): void {
    this.statusFilter.set(filter);
  }

  protected clearSearchAndFilter(): void {
    this.searchQuery.set('');
    this.statusFilter.set('all');
  }

  protected reload(): void {
    this.todoService.reload();
  }

  protected createFieldInvalid(name: 'title' | 'description'): boolean {
    const control = this.createForm.controls[name];
    return control.invalid && (control.touched || this.createSubmitted());
  }

  protected editFieldInvalid(name: 'title' | 'description'): boolean {
    const control = this.editForm.controls[name];
    return control.invalid && (control.touched || this.editSubmitted());
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.deleteTarget()) {
      this.cancelDelete();
    }
  }

  protected trapFocus(event: KeyboardEvent): void {
    if (event.key !== 'Tab') {
      return;
    }
    const dialog = this.deleteDialog()?.nativeElement;
    if (!dialog) {
      return;
    }
    const focusables = Array.from(
      dialog.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex]:not([tabindex="-1"])'),
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
