import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { getErrorDetails, getErrorMessage } from '../../../core/models/api-error';
import { ContactService } from '../../../core/services/contact-service';
import { Alert } from '../../../shared/components/alert/alert';
import { SplitText } from '../../../shared/components/split-text/split-text';
import { Reveal } from '../../../shared/directives/reveal';
import { Tilt } from '../../../shared/directives/tilt';

type ContactField = 'name' | 'email' | 'subject' | 'message'; // noms des champs du formulaire

@Component({
  selector: 'app-contact-page',
  imports: [ReactiveFormsModule, Alert, SplitText, Reveal, Tilt],
  templateUrl: './contact-page.html',
})
export class ContactPage {
  private readonly contactService = inject(ContactService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly maxMessageLength = 2000;
  protected readonly topics = ['Sales & pricing', 'Technical support', 'Partnership', 'Other']; // sujets proposés

  protected readonly infoCards = [                         // cartes d'information (entreprise fictive)
    { icon: 'mail', label: 'Email', value: 'hello@teramind.example' },
    { icon: 'clock', label: 'Response time', value: 'Within one business day' },
    { icon: 'pin', label: 'Office', value: 'Ariana, Tunisia' },
  ];

  protected readonly faq = [                               // questions fréquentes (accordéon)
    { question: 'How quickly can I start using a GPU?', answer: 'Your GPU is ready at the start time you choose when booking, usually within a minute.' },
    { question: 'Can I cancel a rental?', answer: 'Yes. You can cancel for free from your account at any time before the rental starts.' },
    { question: 'Do you offer volume discounts?', answer: 'For rentals of 8 GPUs or more, or longer than 30 days, contact our sales team for a custom offer.' },
  ];
  protected readonly openFaq = signal<number | null>(0);   // question ouverte (la première au départ)

  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(100)] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    subject: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(150)] }),
    message: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(10), Validators.maxLength(this.maxMessageLength)],
    }),
  });

  protected readonly sending = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly serverErrors = signal<Partial<Record<ContactField, string>>>({}); // erreurs renvoyées par l'API, par champ
  protected readonly sent = signal<{ name: string; id: number } | null>(null); // message envoyé : affiche la confirmation

  protected toggleFaq(index: number): void {
    this.openFaq.update((open) => (open === index ? null : index)); // ouvre ou ferme la question
  }

  protected chooseTopic(topic: string): void {
    this.form.controls.subject.setValue(topic);
    this.form.controls.subject.markAsTouched();
  }

  protected fieldError(field: ContactField): string | null { // message d'erreur à afficher sous un champ
    const control = this.form.controls[field];
    if (control.touched && control.invalid) {
      switch (field) {
        case 'name': return 'Enter your name (100 characters max).';
        case 'email': return 'Enter a valid email address.';
        case 'subject': return 'Enter a subject (150 characters max).';
        case 'message': return 'Your message must be between 10 and 2000 characters.';
      }
    }
    return this.serverErrors()[field] ?? null;
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();                        // affiche toutes les erreurs
      return;
    }
    const value = this.form.getRawValue();
    this.sending.set(true);
    this.errorMessage.set(null);
    this.serverErrors.set({});

    this.contactService
      .send({ name: value.name.trim(), email: value.email.trim(), subject: value.subject.trim(), message: value.message.trim() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.sent.set({ name: value.name.trim(), id: response.id });
          this.sending.set(false);
        },
        error: (err: unknown) => {
          const errors: Partial<Record<ContactField, string>> = {};
          for (const detail of getErrorDetails(err)) {
            errors[detail.field as ContactField] = detail.message; // place chaque erreur sous son champ
          }
          this.serverErrors.set(errors);
          this.errorMessage.set(getErrorMessage(err));
          this.sending.set(false);
        },
      });
  }

  protected sendAnother(): void {
    this.form.reset();                                     // vide le formulaire
    this.sent.set(null);                                   // revient au formulaire
  }
}
