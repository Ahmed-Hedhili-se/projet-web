import { Component, input } from '@angular/core';

@Component({
  selector: 'app-alert',
  templateUrl: './alert.html',
})
export class Alert {
  readonly type = input<'error' | 'success'>('error');
  readonly message = input.required<string>();
}
