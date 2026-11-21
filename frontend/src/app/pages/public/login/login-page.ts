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
  readonly returnUrl = input<string>();

  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly benefits = [
    'Book GPUs by the hour, in under a minute',
    'Track and cancel your rentals',
    'Ask the AI advisor which GPU fits your model',
  ];

  protected readonly demoAccounts = environment.useMockApi
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

  protected readonly showPassword = signal(false);
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly shaking = signal(false);

  protected togglePassword(): void {
    this.showPassword.update((visible) => !visible);
  }

  protected useDemoAccount(account: { email: string; password: string }): void {
    this.form.setValue({ email: account.email, password: account.password });
    this.errorMessage.set(null);
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.errorMessage.set(null);

    const value = this.form.getRawValue();
    this.authService
      .login({ email: value.email.trim(), password: value.password })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.router.navigateByUrl(this.safeReturnUrl()),
        error: (err: unknown) => {
          this.errorMessage.set(getErrorMessage(err));
          if (getErrorCode(err) === 'INVALID_CREDENTIALS') {
            this.shaking.set(true);
            this.form.controls.password.reset();
          }
          this.submitting.set(false);
        },
      });
  }

  private safeReturnUrl(): string {
    const url = this.returnUrl();
    return url && url.startsWith('/') && !url.startsWith('//') ? url : '/';
  }
}
