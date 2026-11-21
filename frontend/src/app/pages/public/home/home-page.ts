import { CurrencyPipe } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ScrollText } from '../../../shared/components/scroll-text/scroll-text';
import { SplitText } from '../../../shared/components/split-text/split-text';
import { CountUp } from '../../../shared/directives/count-up';
import { Reveal } from '../../../shared/directives/reveal';
import { Tilt } from '../../../shared/directives/tilt';

interface Stat {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  label: string;
}

interface Feature {
  icon: 'target' | 'clock' | 'chip';
  title: string;
  text: string;
}

interface FeaturedGpu {
  id: number;
  name: string;
  architecture: string;
  vramGb: number;
  fp16Tflops: number;
  pricePerHour: number;
  useCase: string;
}

interface Step {
  number: string;
  title: string;
  text: string;
}

@Component({
  selector: 'app-home-page',
  imports: [RouterLink, CurrencyPipe, Reveal, Tilt, CountUp, SplitText, ScrollText],
  templateUrl: './home-page.html',
})
export class HomePage {
  protected readonly stats: Stat[] = [
    { value: 99.9, decimals: 1, suffix: '%', label: 'Uptime SLA' },
    { value: 60, prefix: '< ', suffix: ' s', label: 'From booking to ready' },
    { value: 0.69, decimals: 2, prefix: '$', label: 'Starting price per hour' },
    { value: 24, suffix: '/7', label: 'Expert support' },
  ];

  protected readonly marqueeGpus = [
    'NVIDIA H100 80GB',
    'AMD Instinct MI300X',
    'NVIDIA A100 80GB',
    'NVIDIA A100 40GB',
    'NVIDIA RTX 4090',
    'NVIDIA L4',
  ];

  protected readonly statement =
    'Every AI model has a perfect GPU. Our AI advisor finds it, you book it in one click, and you pay only for the hours you actually use.';

  protected readonly features: Feature[] = [
    {
      icon: 'target',
      title: 'An AI advisor that reads your code',
      text: 'Share your GitHub repository or describe your workload. The advisor simulates every configuration and explains its choice.',
    },
    {
      icon: 'clock',
      title: 'Pay by the hour',
      text: 'Book exactly the hours you need. No long-term commitment and no hidden fees.',
    },
    {
      icon: 'chip',
      title: 'Latest data-center GPUs',
      text: 'From RTX 4090 to H100 80GB, choose the hardware that matches your workload.',
    },
  ];

  protected readonly featuredGpus: FeaturedGpu[] = [
    {
      id: 1,
      name: 'NVIDIA H100 80GB',
      architecture: 'Hopper',
      vramGb: 80,
      fp16Tflops: 989.5,
      pricePerHour: 3.2,
      useCase: 'Large-scale training',
    },
    {
      id: 2,
      name: 'NVIDIA A100 80GB',
      architecture: 'Ampere',
      vramGb: 80,
      fp16Tflops: 312,
      pricePerHour: 1.89,
      useCase: 'Fine-tuning',
    },
    {
      id: 5,
      name: 'NVIDIA RTX 4090',
      architecture: 'Ada Lovelace',
      vramGb: 24,
      fp16Tflops: 165,
      pricePerHour: 0.69,
      useCase: 'Fast inference',
    },
  ];

  protected readonly steps: Step[] = [
    {
      number: '01',
      title: 'Ask the AI advisor',
      text: 'Paste your GitHub repository or describe your workload to get the best GPU configuration.',
    },
    {
      number: '02',
      title: 'Book your GPU',
      text: 'Pick a start date and a duration in hours. The price is shown instantly.',
    },
    {
      number: '03',
      title: 'Start computing',
      text: 'Your GPU is ready at the scheduled time. Cancel for free before it starts.',
    },
  ];
}
