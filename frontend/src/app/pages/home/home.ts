import { Component } from '@angular/core';

@Component({
  selector: 'app-home',
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home {
  searchSubmitted = false;

  search(event: Event): void {
    event.preventDefault();
    this.searchSubmitted = true;
  }
}
