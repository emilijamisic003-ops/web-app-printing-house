import { Component } from '@angular/core';
import { LoginForm } from '../../shared/login-form/login-form';

@Component({
  selector: 'app-login',
  imports: [LoginForm],
  template: '<app-login-form />'
})
export class Login {}
