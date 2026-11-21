import { Component, input } from '@angular/core';
import { RentalStatus } from '../../../core/models/rental';

@Component({
  selector: 'app-status-badge',
  templateUrl: './status-badge.html',
})
export class StatusBadge {
  // statut d'une location (UPCOMING, ACTIVE, COMPLETED, CANCELLED)
  readonly status = input.required<RentalStatus>();

  protected readonly labels: Record<RentalStatus, string> = {
    // texte affiché pour chaque statut
    UPCOMING: 'Upcoming',
    ACTIVE: 'Active',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
  };
}
