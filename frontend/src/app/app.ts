import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Map } from './component/map/map';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Map],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('here-now');
}
