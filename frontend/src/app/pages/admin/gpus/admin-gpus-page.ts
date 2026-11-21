import { CurrencyPipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminGpu, GpuInput } from '../../../core/models/admin';
import { getErrorCode, getErrorDetails, getErrorMessage } from '../../../core/models/api-error';
import { AdminService } from '../../../core/services/admin-service';
import { Alert } from '../../../shared/components/alert/alert';
import { ConfirmDialog } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { SplitText } from '../../../shared/components/split-text/split-text';
import { Reveal } from '../../../shared/directives/reveal';
import { downloadCsv } from '../../../shared/utils/csv';

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';
type GpuField = keyof GpuInput;

@Component({
  selector: 'app-admin-gpus-page',
  imports: [ReactiveFormsModule, CurrencyPipe, Alert, ConfirmDialog, SplitText, Reveal],
  templateUrl: './admin-gpus-page.html',
  host: {
    '(document:keydown.escape)': 'closeDrawer()',
  },
})
export class AdminGpusPage implements OnInit {
  readonly create = input<string>();

  private readonly adminService = inject(AdminService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly gpus = signal<AdminGpu[]>([]);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly search = signal('');
  protected readonly statusFilter = signal<StatusFilter>('ALL');
  protected readonly statusOptions: { value: StatusFilter; label: string }[] = [
    { value: 'ALL', label: 'All' },
    { value: 'ACTIVE', label: 'Active' },
    { value: 'INACTIVE', label: 'Inactive' },
  ];

  protected readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    return this.gpus().filter(
      (gpu) =>
        (this.statusFilter() === 'ALL' || gpu.isActive === (this.statusFilter() === 'ACTIVE')) &&
        (!term ||
          `${gpu.name} ${gpu.manufacturer} ${gpu.architecture}`.toLowerCase().includes(term)),
    );
  });

  protected readonly manufacturers = computed(() =>
    [...new Set(this.gpus().map((gpu) => gpu.manufacturer))].sort(),
  );

  protected readonly editing = signal<AdminGpu | 'new' | null>(null);
  protected readonly saving = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly serverErrors = signal<Partial<Record<GpuField, string>>>({});
  protected readonly toDeactivate = signal<AdminGpu | null>(null);
  protected readonly deactivating = signal(false);
  protected readonly notice = signal<string | null>(null);

  protected readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100)],
    }),
    manufacturer: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(50)],
    }),
    architecture: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(50)],
    }),
    vramGb: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(1),
      Validators.max(1024),
      Validators.pattern(/^\d+$/),
    ]),
    fp16Tflops: new FormControl<number | null>(null, [Validators.required, Validators.min(0.01)]),
    pricePerHour: new FormControl<number | null>(null, [Validators.required, Validators.min(0.01)]),
    totalUnits: new FormControl<number | null>(null, [
      Validators.required,
      Validators.min(0),
      Validators.max(1000),
      Validators.pattern(/^\d+$/),
    ]),
    description: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(1000)],
    }),
    isActive: new FormControl(true, { nonNullable: true }),
  });

  ngOnInit(): void {
    this.load();
    if (this.create() === '1') {
      this.openCreate();
    }
  }

  protected load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.adminService
      .listGpus()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.gpus.set(response.gpus);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.errorMessage.set(getErrorMessage(err));
          this.loading.set(false);
        },
      });
  }

  protected openCreate(): void {
    this.form.reset();
    this.resetFormMessages();
    this.editing.set('new');
  }

  protected openEdit(gpu: AdminGpu): void {
    this.form.setValue({
      name: gpu.name,
      manufacturer: gpu.manufacturer,
      architecture: gpu.architecture,
      vramGb: gpu.vramGb,
      fp16Tflops: gpu.fp16Tflops,
      pricePerHour: gpu.pricePerHour,
      totalUnits: gpu.totalUnits,
      description: gpu.description,
      isActive: gpu.isActive,
    });
    this.resetFormMessages();
    this.editing.set(gpu);
  }

  protected closeDrawer(): void {
    if (!this.saving() && !this.toDeactivate()) {
      this.editing.set(null);
    }
  }

  protected fieldError(field: GpuField): string | null {
    const control = this.form.controls[field];
    if (control.touched && control.invalid) {
      const messages: Record<GpuField, string> = {
        name: 'Enter a name (100 characters max).',
        manufacturer: 'Enter a manufacturer.',
        architecture: 'Enter an architecture.',
        vramGb: 'Whole number between 1 and 1024.',
        fp16Tflops: 'Must be greater than 0.',
        pricePerHour: 'Must be greater than 0.',
        totalUnits: 'Whole number between 0 and 1000.',
        description: 'Enter a description (1000 characters max).',
        isActive: 'Choose a status.',
      };
      return messages[field];
    }
    return this.serverErrors()[field] ?? null;
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const input: GpuInput = {
      ...value,
      name: value.name.trim(),
      manufacturer: value.manufacturer.trim(),
      architecture: value.architecture.trim(),
      description: value.description.trim(),
      vramGb: Number(value.vramGb),
      fp16Tflops: Number(value.fp16Tflops),
      pricePerHour: Number(value.pricePerHour),
      totalUnits: Number(value.totalUnits),
    };
    const editing = this.editing();
    const request =
      editing && editing !== 'new'
        ? this.adminService.updateGpu(editing.id, input)
        : this.adminService.createGpu(input);
    this.saving.set(true);
    this.resetFormMessages();

    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        const rentalCount = editing && editing !== 'new' ? editing.rentalCount : 0;
        const saved: AdminGpu = { ...response.gpu, rentalCount };
        this.gpus.update((list) =>
          editing && editing !== 'new'
            ? list.map((gpu) => (gpu.id === saved.id ? saved : gpu))
            : [...list, saved].sort((a, b) => a.name.localeCompare(b.name)),
        );
        this.notice.set(
          editing === 'new'
            ? `${saved.name} was added to the catalog.`
            : `${saved.name} was updated.`,
        );
        this.saving.set(false);
        this.editing.set(null);
      },
      error: (err: unknown) => {
        const errors: Partial<Record<GpuField, string>> = {};
        for (const detail of getErrorDetails(err)) {
          errors[detail.field as GpuField] = detail.message;
        }
        if (getErrorCode(err) === 'GPU_NAME_TAKEN') {
          errors.name = 'A GPU with this name already exists.';
        }
        this.serverErrors.set(errors);
        this.formError.set(getErrorMessage(err));
        this.saving.set(false);
      },
    });
  }

  protected confirmDeactivate(): void {
    const gpu = this.toDeactivate();
    if (!gpu) {
      return;
    }
    this.deactivating.set(true);
    this.adminService
      .deactivateGpu(gpu.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.replace({ ...response.gpu, rentalCount: gpu.rentalCount });
          this.notice.set(
            `${gpu.name} was deactivated. It no longer appears in the public catalog.`,
          );
          this.deactivating.set(false);
          this.toDeactivate.set(null);
        },
        error: (err: unknown) => {
          this.errorMessage.set(getErrorMessage(err));
          this.deactivating.set(false);
          this.toDeactivate.set(null);
        },
      });
  }

  protected reactivate(gpu: AdminGpu): void {
    const { id, rentalCount, availableUnits, createdAt, updatedAt, ...fields } = gpu;
    this.adminService
      .updateGpu(id, { ...fields, isActive: true })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.replace({ ...response.gpu, rentalCount });
          this.notice.set(`${gpu.name} is back in the catalog.`);
        },
        error: (err: unknown) => this.errorMessage.set(getErrorMessage(err)),
      });
  }

  protected exportCsv(): void {
    downloadCsv('teramind-gpus.csv', [
      [
        'ID',
        'Name',
        'Manufacturer',
        'Architecture',
        'VRAM (GB)',
        'FP16 TFLOPS',
        'Price per hour (USD)',
        'Total units',
        'Available now',
        'Rentals',
        'Status',
      ],
      ...this.filtered().map((gpu) => [
        gpu.id,
        gpu.name,
        gpu.manufacturer,
        gpu.architecture,
        gpu.vramGb,
        gpu.fp16Tflops,
        gpu.pricePerHour,
        gpu.totalUnits,
        gpu.availableUnits,
        gpu.rentalCount,
        gpu.isActive ? 'Active' : 'Inactive',
      ]),
    ]);
  }

  private replace(saved: AdminGpu): void {
    this.gpus.update((list) => list.map((gpu) => (gpu.id === saved.id ? saved : gpu)));
  }

  private resetFormMessages(): void {
    this.formError.set(null);
    this.serverErrors.set({});
  }
}
