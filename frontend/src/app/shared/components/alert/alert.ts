import { Component, input } from '@angular/core';

@Component({
  selector: 'app-alert',
  templateUrl: './alert.html',
})
export class Alert {                                       // message d'erreur ou de succès ; contenu en plus via <ng-content>
  readonly type = input<'error' | 'success'>('error');
  readonly message = input.required<string>();
}
