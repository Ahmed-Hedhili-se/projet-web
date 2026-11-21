import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-password-strength', // usage : <app-password-strength [password]="form.controls.password.value" />
  templateUrl: './password-strength.html',
})
export class PasswordStrength {
  // 4 barres qui se remplissent selon la force du mot de passe
  readonly password = input('');

  protected readonly bars = [1, 2, 3, 4];
  protected readonly strength = computed(() => {
    // score de 0 à 4 et libellé
    const password = this.password();
    if (password.length === 0) {
      return { score: 0, label: '' };
    }
    if (password.length < 8) {
      return { score: 0, label: 'Too short' };
    }
    let score = 1; // assez long
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++; // minuscules et majuscules
    if (/\d/.test(password)) score++; // au moins un chiffre
    if (/[^A-Za-z0-9]/.test(password) || password.length >= 12) score++; // symbole ou très long
    return { score, label: ['Too short', 'Weak', 'Fair', 'Good', 'Strong'][score] };
  });
}
