import { Component } from '@angular/core';
import { LoginForm } from '../../shared/login-form/login-form';

@Component({
  selector: 'app-admin-login',
  imports: [LoginForm],
  template: '<app-login-form [admin]="true" />'
})
export class AdminLogin {}
