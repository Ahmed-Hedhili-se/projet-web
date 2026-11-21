import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { getErrorCode, getErrorDetails, getErrorMessage } from '../../../core/models/api-error';
import { AuthService } from '../../../core/services/auth-service';
import { UserService } from '../../../core/services/user-service';
import { Alert } from '../../../shared/components/alert/alert';
import { PasswordStrength } from '../../../shared/components/password-strength/password-strength';
import { SplitText } from '../../../shared/components/split-text/split-text';
import { Tilt } from '../../../shared/directives/tilt';

type ProfileField = 'firstName' | 'lastName' | 'email';

function newPasswordsMatch(group: AbstractControl): ValidationErrors | null {
  // nouveau mot de passe = confirmation
  const password = group.get('newPassword')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return confirm && password !== confirm ? { passwordsMismatch: true } : null;
}

@Component({
  selector: 'app-profile-page',
  imports: [ReactiveFormsModule, RouterLink, DatePipe, Alert, PasswordStrength, SplitText, Tilt],
  templateUrl: './profile-page.html',
})
export class ProfilePage implements OnInit {
  protected readonly authService = inject(AuthService); // utilisateur affiché (mis à jour après chaque modification)
  private readonly userService = inject(UserService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly initials = computed(() => {
    // ex. Jane Doe → « JD »
    const user = this.authService.currentUser();
    return user ? `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase() : '';
  });

  protected readonly profileForm = new FormGroup({
    // informations personnelles (PUT /users/me)
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
  });
  protected readonly savingProfile = signal(false);
  protected readonly profileSaved = signal(false);
  protected readonly profileError = signal<string | null>(null);
  protected readonly profileServerErrors = signal<Partial<Record<ProfileField, string>>>({});

  protected readonly passwordForm = new FormGroup(
    // changement de mot de passe (PUT /users/me/password)
    {
      currentPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      newPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(8), Validators.maxLength(72)],
      }),
      confirmPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
    },
    { validators: newPasswordsMatch },
  );
  protected readonly savingPassword = signal(false);
  protected readonly passwordSaved = signal(false);
  protected readonly passwordError = signal<string | null>(null);
  protected readonly wrongPassword = signal(false); // mot de passe actuel incorrect (WRONG_PASSWORD)

  ngOnInit(): void {
    this.fillProfileForm();
    this.userService // relit le profil depuis l'API (GET /users/me)
      .getProfile()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.authService.updateCurrentUser(response.user);
          this.fillProfileForm();
        },
      });
  }

  protected profileFieldError(field: ProfileField): string | null {
    const control = this.profileForm.controls[field];
    if (control.touched && control.invalid) {
      return field === 'email'
        ? 'Enter a valid email address.'
        : `Enter your ${field === 'firstName' ? 'first' : 'last'} name.`;
    }
    return this.profileServerErrors()[field] ?? null;
  }

  protected saveProfile(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }
    const value = this.profileForm.getRawValue();
    this.savingProfile.set(true);
    this.profileSaved.set(false);
    this.profileError.set(null);
    this.profileServerErrors.set({});

    this.userService
      .updateProfile({
        firstName: value.firstName.trim(),
        lastName: value.lastName.trim(),
        email: value.email.trim(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.savingProfile.set(false);
          this.profileSaved.set(true); // message « Profile updated »
          this.profileForm.markAsPristine();
        },
        error: (err: unknown) => {
          const errors: Partial<Record<ProfileField, string>> = {};
          for (const detail of getErrorDetails(err)) {
            errors[detail.field as ProfileField] = detail.message;
          }
          if (getErrorCode(err) === 'EMAIL_TAKEN') {
            errors.email = 'An account with this email already exists.';
          }
          this.profileServerErrors.set(errors);
          this.profileError.set(getErrorMessage(err));
          this.savingProfile.set(false);
        },
      });
  }

  protected passwordFieldError(
    field: 'currentPassword' | 'newPassword' | 'confirmPassword',
  ): string | null {
    const control = this.passwordForm.controls[field];
    if (field === 'currentPassword' && this.wrongPassword()) {
      return 'Your current password is incorrect.';
    }
    if (
      field === 'confirmPassword' &&
      control.touched &&
      this.passwordForm.hasError('passwordsMismatch')
    ) {
      return 'Passwords do not match.';
    }
    if (control.touched && control.invalid) {
      return field === 'newPassword'
        ? 'Use between 8 and 72 characters.'
        : 'This field is required.';
    }
    return null;
  }

  protected savePassword(): void {
    this.wrongPassword.set(false);
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    const value = this.passwordForm.getRawValue();
    this.savingPassword.set(true);
    this.passwordSaved.set(false);
    this.passwordError.set(null);

    this.userService
      .changePassword({ currentPassword: value.currentPassword, newPassword: value.newPassword }) // la confirmation n'est pas envoyée
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.savingPassword.set(false);
          this.passwordSaved.set(true);
          this.passwordForm.reset(); // vide les trois champs
        },
        error: (err: unknown) => {
          if (getErrorCode(err) === 'WRONG_PASSWORD') {
            this.wrongPassword.set(true); // message sous « Current password »
          } else {
            this.passwordError.set(getErrorMessage(err));
          }
          this.savingPassword.set(false);
        },
      });
  }

  protected signOut(): void {
    this.authService.logout();
  }

  private fillProfileForm(): void {
    // remplit le formulaire avec l'utilisateur connecté
    const user = this.authService.currentUser();
    if (user) {
      this.profileForm.setValue({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      });
    }
  }
}
