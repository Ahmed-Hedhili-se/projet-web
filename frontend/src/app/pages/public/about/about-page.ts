import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ScrollText } from '../../../shared/components/scroll-text/scroll-text';
import { SplitText } from '../../../shared/components/split-text/split-text';
import { CountUp } from '../../../shared/directives/count-up';
import { Reveal } from '../../../shared/directives/reveal';
import { Tilt } from '../../../shared/directives/tilt';

interface Stat {
  value: number;
  from?: number;
  suffix?: string;
  grouping?: boolean;
  label: string;
}

interface Value {
  icon: 'eye' | 'bolt' | 'leaf' | 'chat';
  title: string;
  text: string;
}

interface Milestone {
  year: string;
  title: string;
  text: string;
}

interface TeamMember {
  name: string;
  role: string;
}

@Component({
  selector: 'app-about-page',
  imports: [RouterLink, Reveal, Tilt, CountUp, SplitText, ScrollText],
  templateUrl: './about-page.html',
})
export class AboutPage {
  protected readonly stats: Stat[] = [
    { value: 2024, from: 2000, grouping: false, label: 'Founded' },
    { value: 3, label: 'Data centers' },
    { value: 1200, suffix: '+', label: 'Customers' },
    { value: 60, label: 'GPUs in our fleet' },
  ];

  protected readonly mission =
    'Training and serving AI models should not require a research-lab budget. Too many teams overpay for GPUs they do not need, or wait weeks for capacity. We built TeraMind to fix that: modern GPUs you can book by the hour, and a recommender that tells you exactly which one fits your model.';

  protected readonly values: Value[] = [
    { icon: 'eye', title: 'Transparency', text: 'One clear hourly price per GPU. What you see is what you pay.' },
    { icon: 'bolt', title: 'Performance', text: 'Modern data-center hardware, monitored around the clock.' },
    { icon: 'leaf', title: 'Efficiency', text: 'The right GPU for the job means less waste, for your budget and the planet.' },
    { icon: 'chat', title: 'Support', text: 'Engineers who understand AI workloads, available 24/7.' },
  ];

  protected readonly milestones: Milestone[] = [
    { year: '2024', title: 'TeraMind is founded', text: 'A small team of ML engineers sets out to make GPU compute simple and affordable.' },
    { year: '2025', title: 'First H100 cluster', text: 'Our first data center goes live with H100 and A100 GPUs for training workloads.' },
    { year: '2026', title: 'AI GPU advisor launch', text: 'Customers can now share the GitHub repository of their model and get the best GPU configuration, with time and cost estimates.' },
  ];

  protected readonly team: TeamMember[] = [
    { name: 'Adem YOUSSFI', role: 'Co-founder · Frontend & design' },
    { name: 'Ahmed HEDHILI', role: 'Co-founder · Backend & AI' },
  ];

  protected initials(name: string): string {
    return name
      .split(' ')
      .map((part) => part[0])
      .join('');
  }
}
