import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AboutPage } from './about-page';

describe('AboutPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AboutPage],
      providers: [provideRouter([])], // la page utilise routerLink
    }).compileComponents();
  });

  it('should render the title and the team initials', async () => {
    const fixture = TestBed.createComponent(AboutPage);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('We make AI compute simple.');
    expect(compiled.textContent).toContain('AY'); // initiales d'« Adem YOUSSFI »
    expect(compiled.textContent).toContain('Ahmed HEDHILI');
  });
});
