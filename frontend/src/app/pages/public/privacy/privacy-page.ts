import { Component } from '@angular/core';
import {
  LegalDocument,
  LegalSection,
} from '../../../shared/components/legal-document/legal-document';

@Component({
  selector: 'app-privacy-page',
  imports: [LegalDocument],
  template: `
    <app-legal-document
      eyebrow="Privacy"
      title="Privacy policy."
      intro="What personal data TeraMind collects, why we need it, how long we keep it, and how you stay in control of it."
      updated="November 21, 2026"
      [sections]="sections"
    />
  `,
})
export class PrivacyPage {
  protected readonly sections: LegalSection[] = [
    {
      id: 'controller',
      title: 'Who is responsible for your data',
      paragraphs: [
        'TeraMind is responsible for the personal data collected on this website. You can reach us at any time through the contact page.',
      ],
    },
    {
      id: 'data',
      title: 'Data we collect',
      paragraphs: ['We only collect the data we need to provide the service:'],
      items: [
        'Account: first name, last name, email address and password. The password is never stored as such: we only keep a secure hash of it.',
        'Rentals: the GPU, the number of units, the dates, the duration and the price of each rental.',
        'Contact messages: your name, email address, subject and message.',
        'AI advisor: your conversations with the advisor, the links of the GitHub repositories you share, and the number of messages you send each day.',
      ],
    },
    {
      id: 'purposes',
      title: 'Why we use it',
      paragraphs: ['We use your data only to:'],
      items: [
        'create and secure your account, and sign you in;',
        'book, display and cancel your rentals;',
        'answer your messages;',
        'recommend a GPU configuration and keep your conversation history;',
        'prevent abuse, for example by limiting failed sign-in attempts and the number of messages sent to the AI advisor.',
      ],
    },
    {
      id: 'not-collected',
      title: 'What we do not do',
      paragraphs: [
        'We do not sell or rent your data. We do not use advertising or tracking cookies, and we do not measure your visits with an analytics tool. We do not ask for payment card details on this website.',
      ],
    },
    {
      id: 'browser-storage',
      title: 'Data stored in your browser',
      paragraphs: [
        'When you sign in, your browser keeps a session token and your basic profile (name, email, role) in its local storage, so that you stay signed in when you reload the page. Signing out removes them.',
        'In the demonstration version of the website, the demo data (accounts, rentals, messages, conversations) is also kept in your browser only. Clearing your browser data resets it.',
      ],
    },
    {
      id: 'third-parties',
      title: 'Services that receive data',
      paragraphs: ['Some features rely on external services:'],
      items: [
        'Google Fonts: the font of the website is loaded from Google servers, which receive your IP address and browser information.',
        'GitHub: when you share a repository link, the AI advisor reads that public repository through the GitHub service.',
        'AI provider: your messages to the AI advisor are sent to the language model provider configured by TeraMind, which generates the answer. Do not include personal or confidential information in them.',
      ],
    },
    {
      id: 'retention',
      title: 'How long we keep it',
      paragraphs: [],
      items: [
        'Account data: as long as your account exists.',
        'Rentals: as long as your account exists, so that you and our team can see your rental history.',
        'Contact messages: until our team has answered and deletes them.',
        'AI advisor conversations: until you delete them from your history, or until your account is deleted.',
      ],
    },
    {
      id: 'security',
      title: 'Security',
      paragraphs: [
        'Passwords are hashed, sessions use signed tokens that expire, and access to the admin area is limited to TeraMind staff. Repeated failed sign-in attempts are blocked for a while.',
      ],
    },
    {
      id: 'rights',
      title: 'Your rights',
      paragraphs: [
        'You can see and correct your name, email and password at any time from your profile. You can delete your AI advisor conversations from the history.',
        'To get a copy of your data, or to have your account and data deleted, send us a request through the contact page. We answer within 30 days.',
        'These rights follow the Tunisian law on the protection of personal data (Organic Law No. 2004-63 of 27 July 2004).',
      ],
    },
    {
      id: 'changes',
      title: 'Changes to this policy',
      paragraphs: ['If we change this policy, we will update the date at the top of this page.'],
    },
  ];
}
