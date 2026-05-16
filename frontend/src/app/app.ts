import { Component, signal, OnInit } from '@angular/core';
import { Router, RouterLink, RouterOutlet, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  protected readonly title = signal('here-now');
  protected readonly showNavbar = signal(true);

  constructor(private router: Router) {}

  ngOnInit() {
    this.updateNavbarVisibility();
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => this.updateNavbarVisibility());
  }

  private updateNavbarVisibility() {
    this.showNavbar.set(this.router.url !== '/' && this.router.url !== '/signup');
  }
}
