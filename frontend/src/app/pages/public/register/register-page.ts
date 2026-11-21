import { Component, DestroyRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { getErrorCode, getErrorDetails, getErrorMessage } from '../../../core/models/api-error';
import { AuthService } from '../../../core/services/auth-service';
import { Alert } from '../../../shared/components/alert/alert';
import { PasswordStrength } from '../../../shared/components/password-strength/password-strength';
import { SplitText } from '../../../shared/components/split-text/split-text';

type RegisterField = 'firstName' | 'lastName' | 'email' | 'password'; // champs envoyés à l'API

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  // les deux mots de passe doivent être identiques
  const password = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return confirm && password !== confirm ? { passwordsMismatch: true } : null;
}

@Component({
  selector: 'app-register-page',
  imports: [ReactiveFormsModule, RouterLink, Alert, SplitText, PasswordStrength],
  templateUrl: './register-page.html',
})
export class RegisterPage {
  readonly returnUrl = input<string>(); // ?returnUrl=… (withComponentInputBinding)

  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly steps = [
    // étapes affichées dans le panneau de gauche
    { number: '01', text: 'Create your free account' },
    { number: '02', text: 'Find the right GPU for your model' },
    { number: '03', text: 'Book it by the hour and start computing' },
  ];

  protected readonly form = new FormGroup(
    {
      firstName: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(50)],
      }),
      lastName: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(50)],
      }),
      email: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.email],
      }),
      password: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(8), Validators.maxLength(72)],
      }),
      confirmPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      acceptTerms: new FormControl(false, {
        nonNullable: true,
        validators: [Validators.requiredTrue],
      }),
    },
    { validators: passwordsMatch },
  );

  protected readonly showPassword = signal(false);
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly serverErrors = signal<Partial<Record<RegisterField, string>>>({}); // erreurs de l'API, par champ
  protected readonly shaking = signal(false); // secousse si l'email est déjà pris

  protected fieldError(field: RegisterField | 'confirmPassword' | 'acceptTerms'): string | null {
    // message sous un champ
    const control = this.form.controls[field];
    if (field === 'confirmPassword' && control.touched && this.form.hasError('passwordsMismatch')) {
      return 'Passwords do not match.';
    }
    if (control.touched && control.invalid) {
      switch (field) {
        case 'firstName':
          return 'Enter your first name.';
        case 'lastName':
          return 'Enter your last name.';
        case 'email':
          return 'Enter a valid email address.';
        case 'password':
          return 'Use between 8 and 72 characters.';
        case 'confirmPassword':
          return 'Confirm your password.';
        case 'acceptTerms':
          return 'Please accept the terms to continue.';
      }
    }
    return field === 'confirmPassword' || field === 'acceptTerms'
      ? null
      : (this.serverErrors()[field] ?? null);
  }

  protected togglePassword(): void {
    this.showPassword.update((visible) => !visible);
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched(); // affiche toutes les erreurs
      return;
    }
    this.submitting.set(true);
    this.errorMessage.set(null);
    this.serverErrors.set({});

    const value = this.form.getRawValue();
    this.authService
      .register({
        // confirmPassword et acceptTerms ne sont pas envoyés (docs/API.md)
        email: value.email.trim(),
        password: value.password,
        firstName: value.firstName.trim(),
        lastName: value.lastName.trim(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.router.navigateByUrl(this.safeReturnUrl()), // compte créé et connecté
        error: (err: unknown) => {
          const errors: Partial<Record<RegisterField, string>> = {};
          for (const detail of getErrorDetails(err)) {
            errors[detail.field as RegisterField] = detail.message;
          }
          if (getErrorCode(err) === 'EMAIL_TAKEN') {
            errors.email = 'An account with this email already exists.';
            this.shaking.set(true); // la carte tremble
          }
          this.serverErrors.set(errors);
          this.errorMessage.set(getErrorMessage(err));
          this.submitting.set(false);
        },
      });
  }

  private safeReturnUrl(): string {
    // n'accepte que des adresses internes
    const url = this.returnUrl();
    return url && url.startsWith('/') && !url.startsWith('//') ? url : '/gpus'; // par défaut : le catalogue, pour louer tout de suite
  }
}
