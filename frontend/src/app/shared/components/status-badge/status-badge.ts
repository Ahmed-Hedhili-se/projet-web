import { Component, input } from '@angular/core';
import { RentalStatus } from '../../../core/models/rental';

@Component({
  selector: 'app-status-badge',
  templateUrl: './status-badge.html',
})
export class StatusBadge {
  readonly status = input.required<RentalStatus>();

  protected readonly labels: Record<RentalStatus, string> = {
    UPCOMING: 'Upcoming',
    ACTIVE: 'Active',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
  };
}
