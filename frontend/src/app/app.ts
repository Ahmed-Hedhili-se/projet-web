import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Footer } from './layout/footer/footer';
import { Navbar } from './layout/navbar/navbar';

@Component({
  imports: [RouterOutlet, Navbar, Footer],                 // composants utilisés dans le layout
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {}                                        // composant racine : layout commun à toutes les pages
