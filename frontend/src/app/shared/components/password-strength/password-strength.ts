import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-password-strength',
  templateUrl: './password-strength.html',
})
export class PasswordStrength {
  readonly password = input('');

  protected readonly bars = [1, 2, 3, 4];
  protected readonly strength = computed(() => {
    const password = this.password();
    if (password.length === 0) {
      return { score: 0, label: '' };
    }
    if (password.length < 8) {
      return { score: 0, label: 'Too short' };
    }
    let score = 1;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password) || password.length >= 12) score++;
    return { score, label: ['Too short', 'Weak', 'Fair', 'Good', 'Strong'][score] };
  });
}
