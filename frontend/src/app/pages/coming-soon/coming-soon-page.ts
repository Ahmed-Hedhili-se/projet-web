import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-coming-soon-page',
  imports: [RouterLink],
  templateUrl: './coming-soon-page.html',
})
export class ComingSoonPage {                              // page provisoire, remplacée à chaque étape suivante
  readonly heading = input('');                            // reçu depuis data.heading de la route
}
