import { Component, DestroyRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { getErrorCode, getErrorMessage } from '../../../core/models/api-error';
import { AuthService } from '../../../core/services/auth-service';
import { Alert } from '../../../shared/components/alert/alert';
import { SplitText } from '../../../shared/components/split-text/split-text';

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, RouterLink, Alert, SplitText],
  templateUrl: './login-page.html',
})
export class LoginPage {
  readonly returnUrl = input<string>(); // ?returnUrl=… ajouté par authGuard (withComponentInputBinding)

  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly benefits = [
    // avantages listés dans le panneau de gauche
    'Book GPUs by the hour, in under a minute',
    'Track and cancel your rentals',
    'Ask the AI advisor which GPU fits your model',
  ];

  protected readonly demoAccounts = environment.useMockApi // comptes fictifs, affichés seulement avec les données de démonstration
    ? [
        { label: 'User', email: 'jane.doe@example.com', password: 'Password123' },
        { label: 'Admin', email: 'admin@teramind.example', password: 'Admin12345' },
        { label: 'Blocked', email: 'blocked@example.com', password: 'Password123' },
      ]
    : [];

  protected readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  protected readonly showPassword = signal(false); // mot de passe visible ou masqué
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly shaking = signal(false); // déclenche la secousse de la carte

  protected togglePassword(): void {
    this.showPassword.update((visible) => !visible);
  }

  protected useDemoAccount(account: { email: string; password: string }): void {
    this.form.setValue({ email: account.email, password: account.password }); // remplit le formulaire
    this.errorMessage.set(null);
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched(); // affiche les erreurs sous les champs
      return;
    }
    this.submitting.set(true);
    this.errorMessage.set(null);

    const value = this.form.getRawValue();
    this.authService
      .login({ email: value.email.trim(), password: value.password })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.router.navigateByUrl(this.safeReturnUrl()), // retourne à la page demandée, sinon à l'accueil
        error: (err: unknown) => {
          this.errorMessage.set(getErrorMessage(err)); // message de l'API, en anglais
          if (getErrorCode(err) === 'INVALID_CREDENTIALS') {
            this.shaking.set(true); // la carte tremble
            this.form.controls.password.reset(); // on vide le mot de passe
          }
          this.submitting.set(false);
        },
      });
  }

  private safeReturnUrl(): string {
    // n'accepte que des adresses internes (ex. "/account/rentals")
    const url = this.returnUrl();
    return url && url.startsWith('/') && !url.startsWith('//') ? url : '/';
  }
}
