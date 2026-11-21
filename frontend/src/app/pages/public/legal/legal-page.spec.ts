import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PrivacyPage } from '../privacy/privacy-page';
import { LegalPage } from './legal-page';

describe('Legal pages', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LegalPage, PrivacyPage],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should show the legal notice with the team and the terms of service', async () => {
    const fixture = TestBed.createComponent(LegalPage);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Legal notice.');
    expect(compiled.textContent).toContain('Adem YOUSSFI');
    expect(compiled.querySelector('#terms')).not.toBeNull();
    expect(compiled.querySelectorAll('nav a').length).toBe(
      compiled.querySelectorAll('article > section').length,
    );
  });

  it('should list the data collected in the privacy policy', async () => {
    const fixture = TestBed.createComponent(PrivacyPage);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Privacy policy.');
    expect(compiled.textContent).toContain('AI advisor: your conversations');
    expect(compiled.textContent).toContain('2004-63');
  });
});
