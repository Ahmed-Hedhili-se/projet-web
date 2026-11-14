import { CurrencyPipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Gpu } from '../../../core/models/gpu';
import { Tilt } from '../../directives/tilt';

@Component({
  selector: 'app-gpu-card',
  imports: [RouterLink, CurrencyPipe, Tilt],
  templateUrl: './gpu-card.html',
})
export class GpuCard {
  readonly gpu = input.required<Gpu>();
}
