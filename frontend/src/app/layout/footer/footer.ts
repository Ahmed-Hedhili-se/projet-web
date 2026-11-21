import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface FooterColumn {
  // une colonne de liens du pied de page
  title: string; // titre de la colonne
  links: { label: string; path: string }[]; // liens de la colonne
}

@Component({
  selector: 'app-footer',
  imports: [RouterLink],
  templateUrl: './footer.html',
})
export class Footer {
  protected readonly year = new Date().getFullYear(); // année affichée dans le copyright

  protected readonly columns: FooterColumn[] = [
    {
      title: 'Services',
      links: [
        { label: 'GPU catalog', path: '/gpus' },
        { label: 'GPU recommendation', path: '/recommend' },
      ],
    },
    {
      title: 'Company',
      links: [
        { label: 'About', path: '/about' },
        { label: 'Contact', path: '/contact' },
      ],
    },
    {
      title: 'Account',
      links: [
        { label: 'Sign in', path: '/login' },
        { label: 'Create an account', path: '/register' },
      ],
    },
  ];
}
