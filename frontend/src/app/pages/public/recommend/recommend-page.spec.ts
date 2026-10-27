import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RecommendPage } from './recommend-page';

describe('RecommendPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecommendPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()], // pas de vrai réseau
    }).compileComponents();
  });

  it('should show the form with the five model types and the empty result', async () => {
    const fixture = TestBed.createComponent(RecommendPage);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelectorAll('input[type="radio"][formcontrolname="modelType"]').length).toBe(5);
    expect(compiled.textContent).toContain('Your recommendation will appear here.');
  });
});
