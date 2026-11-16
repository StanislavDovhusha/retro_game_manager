import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MainPageComponent } from './features/main/main-page/main-page.component';

/** Root component: hosts the main page. */
@Component({
  selector: 'app-root',
  imports: [MainPageComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {}
