import { CurrencyPipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Gpu } from '../../../core/models/gpu';

@Component({
  selector: 'app-gpu-card',
  imports: [RouterLink, CurrencyPipe],
  templateUrl: './gpu-card.html',
})
export class GpuCard {                                     // carte d'un GPU dans le catalogue
  readonly gpu = input.required<Gpu>();
}
