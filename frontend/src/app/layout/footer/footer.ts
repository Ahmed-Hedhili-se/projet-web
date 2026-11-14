import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface FooterColumn {
  title: string;
  links: { label: string; path: string }[];
}

@Component({
  selector: 'app-footer',
  imports: [RouterLink],
  templateUrl: './footer.html',
})
export class Footer {
  protected readonly year = new Date().getFullYear();

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
