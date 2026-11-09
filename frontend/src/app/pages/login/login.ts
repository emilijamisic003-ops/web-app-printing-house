import { Component, inject, OnInit } from '@angular/core';
import { LoginForm } from '../../shared/login-form/login-form';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  imports: [LoginForm],
  template: '@if (!authService.isLoggedIn()) { <app-login-form /> }'
})
export class Login implements OnInit {
  authService = inject(AuthService);
  private router = inject(Router);

  ngOnInit(): void {
    if (this.authService.isLoggedIn()) {
      this.router.navigate([this.authService.getHomeRouteForCurrentUser()], { replaceUrl: true });
    }
  }
}
