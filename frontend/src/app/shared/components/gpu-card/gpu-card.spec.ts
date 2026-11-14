import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MOCK_GPUS } from '../../../core/mocks/mock-gpus';
import { GpuCard } from './gpu-card';

describe('GpuCard', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GpuCard],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should show the GPU name, price and availability', async () => {
    const fixture = TestBed.createComponent(GpuCard);
    fixture.componentRef.setInput('gpu', MOCK_GPUS[0]);
    await fixture.whenStable();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('NVIDIA H100 80GB');
    expect(text).toContain('$3.20');
    expect(text).toContain('6 of 8 units available');
  });

  it('should show "Fully booked" when no unit is available', async () => {
    const fixture = TestBed.createComponent(GpuCard);
    fixture.componentRef.setInput('gpu', MOCK_GPUS[3]);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Fully booked');
  });
});
