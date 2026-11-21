import { Component, ElementRef, afterNextRender, input, output, viewChild } from '@angular/core';

@Component({
  selector: 'app-confirm-dialog', // usage : @if (open) { <app-confirm-dialog title="…" (confirmed)="…" (cancelled)="…" /> }
  templateUrl: './confirm-dialog.html',
  host: {
    '(document:keydown.escape)': 'cancel()', // touche Échap = annuler
  },
})
export class ConfirmDialog {
  // fenêtre de confirmation (annuler une location, supprimer…)
  readonly title = input.required<string>();
  readonly message = input('');
  readonly confirmLabel = input('Confirm');
  readonly cancelLabel = input('Keep it');
  readonly busy = input(false); // action en cours : boutons désactivés
  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  private readonly cancelButton = viewChild.required<ElementRef<HTMLButtonElement>>('cancelButton');

  constructor() {
    afterNextRender(() => this.cancelButton().nativeElement.focus()); // le focus va sur le bouton le moins dangereux
  }

  protected cancel(): void {
    if (!this.busy()) {
      this.cancelled.emit();
    }
  }
}
