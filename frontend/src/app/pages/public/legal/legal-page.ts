import { Component } from '@angular/core';
import { LegalDocument, LegalSection } from '../../../shared/components/legal-document/legal-document';

@Component({
  selector: 'app-legal-page',
  imports: [LegalDocument],
  template: `
    <app-legal-document
      eyebrow="Legal"
      title="Legal notice."
      intro="Who publishes this website, the rules for using TeraMind, and the credits for the content we use."
      updated="November 21, 2026"
      [sections]="sections"
    />
  `,
})
export class LegalPage {
  protected readonly sections: LegalSection[] = [
    {
      id: 'publisher',
      title: 'Website publisher',
      paragraphs: [
        'This website is published by TeraMind, a fictional company that rents data-center GPUs for AI workloads.',
        "It was designed and built as a web project at SUP'COM (Higher School of Communication of Tunis) by Adem YOUSSFI (frontend and design) and Ahmed HEDHILI (backend and AI advisor).",
      ],
    },
    {
      id: 'hosting',
      title: 'Hosting and source code',
      paragraphs: [
        'This version of the website is a demonstration. It runs on the computer of the person who starts it and is not hosted on a public server.',
        'The source code is published on GitHub, in the TeraMind repository of the project team.',
      ],
    },
    {
      id: 'terms',
      title: 'Terms of service',
      paragraphs: ['By creating an account or renting a GPU, you accept the following rules:'],
      items: [
        'You must give accurate information when you create your account, and keep your password secret.',
        'GPUs are rented by the hour. The price shown before you confirm a rental is the price you pay.',
        'You can cancel a rental for free until it starts. Once it has started, it can no longer be cancelled from your account.',
        'TeraMind may cancel a rental or block an account that breaks these rules or uses the GPUs for illegal purposes.',
        'Availability depends on the number of free units. A rental is only guaranteed once it is confirmed on your account.',
      ],
    },
    {
      id: 'ai-advisor',
      title: 'AI advisor and recommendations',
      paragraphs: [
        'The GPU recommendations, including those of the AI advisor, are estimates given to help you choose. Durations and costs can differ by about 30% from what you will actually observe.',
        'Prices and stock always come from the TeraMind catalog. The final choice of configuration remains your responsibility.',
        'The AI advisor only reads public GitHub repositories, and only the files it needs to understand your model. Never paste secrets, passwords or private data into the conversation.',
      ],
    },
    {
      id: 'intellectual-property',
      title: 'Intellectual property',
      paragraphs: [
        'The TeraMind name, logo, texts, illustrations and the design of this website belong to the project team. You may not reuse them without permission.',
        'The names of GPU models and manufacturers (NVIDIA, AMD) belong to their respective owners and are used only to describe the products available for rent.',
      ],
    },
    {
      id: 'credits',
      title: 'Credits',
      paragraphs: ['This website uses the following free resources:'],
      items: [
        'Earth textures of the 3D planet: NASA Visible Earth / Blue Marble imagery (public domain), as prepared in the three.js examples (MIT licence).',
        'Inter typeface by Rasmus Andersson, served by Google Fonts (SIL Open Font License).',
        'Angular, Tailwind CSS, Three.js, Lenis and marked, all open-source libraries (MIT licence).',
      ],
    },
    {
      id: 'liability',
      title: 'Liability',
      paragraphs: [
        'We do our best to keep the information on this website accurate and up to date, but we cannot guarantee that it is free of errors or always available.',
        'Links to other websites are provided for convenience. We are not responsible for their content.',
      ],
    },
    {
      id: 'law',
      title: 'Applicable law',
      paragraphs: ['These terms are governed by Tunisian law.'],
    },
  ];
}
