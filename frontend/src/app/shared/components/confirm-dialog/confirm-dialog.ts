import { Component, ElementRef, afterNextRender, input, output, viewChild } from '@angular/core';

@Component({
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.html',
  host: {
    '(document:keydown.escape)': 'cancel()',
  },
})
export class ConfirmDialog {
  readonly title = input.required<string>();
  readonly message = input('');
  readonly confirmLabel = input('Confirm');
  readonly cancelLabel = input('Keep it');
  readonly busy = input(false);
  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  private readonly cancelButton = viewChild.required<ElementRef<HTMLButtonElement>>('cancelButton');

  constructor() {
    afterNextRender(() => this.cancelButton().nativeElement.focus());
  }

  protected cancel(): void {
    if (!this.busy()) {
      this.cancelled.emit();
    }
  }
}
