import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Reveal } from '../../../shared/directives/reveal';

interface Stat {                                           // chiffre clé de l'entreprise
  value: string;
  label: string;
}

interface Value {                                          // valeur de l'entreprise
  icon: 'eye' | 'bolt' | 'leaf' | 'chat';                  // nom de l'icône SVG affichée
  title: string;
  text: string;
}

interface Milestone {                                      // étape de l'histoire
  year: string;
  title: string;
  text: string;
}

interface TeamMember {                                     // membre de l'équipe (entreprise fictive)
  name: string;
  role: string;
}

@Component({
  selector: 'app-about-page',
  imports: [RouterLink, Reveal],
  templateUrl: './about-page.html',
})
export class AboutPage {
  protected readonly stats: Stat[] = [
    { value: '2024', label: 'Founded' },
    { value: '3', label: 'Data centers' },
    { value: '1,200+', label: 'Customers' },
    { value: '60', label: 'GPUs in our fleet' },
  ];

  protected readonly values: Value[] = [
    { icon: 'eye', title: 'Transparency', text: 'One clear hourly price per GPU. What you see is what you pay.' },
    { icon: 'bolt', title: 'Performance', text: 'Modern data-center hardware, monitored around the clock.' },
    { icon: 'leaf', title: 'Efficiency', text: 'The right GPU for the job means less waste, for your budget and the planet.' },
    { icon: 'chat', title: 'Support', text: 'Engineers who understand AI workloads, available 24/7.' },
  ];

  protected readonly milestones: Milestone[] = [
    { year: '2024', title: 'NeuroGrid is founded', text: 'A small team of ML engineers sets out to make GPU compute simple and affordable.' },
    { year: '2025', title: 'First H100 cluster', text: 'Our first data center goes live with H100 and A100 GPUs for training workloads.' },
    { year: '2026', title: 'GPU recommender launch', text: 'Customers can now describe their model and get the most cost-effective GPU instantly.' },
  ];

  protected readonly team: TeamMember[] = [
    { name: 'Amira Haddad', role: 'Chief Executive Officer' },
    { name: 'Youssef Trabelsi', role: 'Head of Infrastructure' },
    { name: 'Lina Mansour', role: 'ML Solutions Lead' },
    { name: 'Karim Jaziri', role: 'Customer Success' },
  ];

  protected initials(name: string): string {
    return name
      .split(' ')
      .map((part) => part[0])                              // première lettre de chaque mot
      .join('');                                           // ex. « Amira Haddad » → « AH »
  }
}
