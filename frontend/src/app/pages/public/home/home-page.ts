import { CurrencyPipe } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Reveal } from '../../../shared/directives/reveal';

interface Stat {                                           // chiffre clé
  value: string;
  label: string;
}

interface Feature {                                        // point fort de l'offre
  icon: 'target' | 'clock' | 'chip';                       // nom de l'icône SVG affichée
  title: string;
  text: string;
}

interface FeaturedGpu {                                    // GPU mis en avant (données d'exemple, remplacées par l'API en F3)
  name: string;
  architecture: string;
  vramGb: number;
  fp16Tflops: number;
  pricePerHour: number;
  useCase: string;
}

interface Step {                                           // étape du fonctionnement
  number: string;
  title: string;
  text: string;
}

@Component({
  selector: 'app-home-page',
  imports: [RouterLink, CurrencyPipe, Reveal],
  templateUrl: './home-page.html',
})
export class HomePage {
  protected readonly stats: Stat[] = [
    { value: '99.9%', label: 'Uptime SLA' },
    { value: '< 60 s', label: 'From booking to ready' },
    { value: '$0.69', label: 'Starting price per hour' },
    { value: '24/7', label: 'Expert support' },
  ];

  protected readonly features: Feature[] = [
    {
      icon: 'target',
      title: 'Right-sized recommendations',
      text: 'Describe your model and we suggest the GPU that fits its memory needs and your budget.',
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
    { name: 'NVIDIA H100 80GB', architecture: 'Hopper', vramGb: 80, fp16Tflops: 989.5, pricePerHour: 3.2, useCase: 'Large-scale training' },
    { name: 'NVIDIA A100 80GB', architecture: 'Ampere', vramGb: 80, fp16Tflops: 312, pricePerHour: 1.89, useCase: 'Fine-tuning' },
    { name: 'NVIDIA RTX 4090', architecture: 'Ada Lovelace', vramGb: 24, fp16Tflops: 165, pricePerHour: 0.69, useCase: 'Fast inference' },
  ];

  protected readonly steps: Step[] = [
    { number: '01', title: 'Describe your model', text: 'Model type, size, training or inference, and your hourly budget.' },
    { number: '02', title: 'Book your GPU', text: 'Pick a start date and a duration in hours. The price is shown instantly.' },
    { number: '03', title: 'Start computing', text: 'Your GPU is ready at the scheduled time. Cancel for free before it starts.' },
  ];
}
