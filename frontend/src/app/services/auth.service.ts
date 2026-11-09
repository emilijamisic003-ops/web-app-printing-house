import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

export interface UserProfile {
  username: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  profileImage: string;
  clientType?: string;
  institutionName?: string;
  address?: string;
  registrationNumber?: string;
  pib?: string;
}

@Injectable({providedIn: 'root'})
export class AuthService {
  
  private http = inject(HttpClient);

  forgotPassword(identifier: string) {
    return this.http.post<{ message: string }>('http://localhost:4000/users/forgot-password', { identifier });
  }

  resetPassword(token: string, password: string) {
    return this.http.post<{ message: string }>('http://localhost:4000/users/reset-password', { token, password });
  }

  getCurrentUser(): { username?: string; role?: string; clientType?: string } | null {
    try {
      const user = JSON.parse(localStorage.getItem('currentUser') ?? 'null');
      if (user && ['client', 'printer', 'admin'].includes(user.role)) return user;
      return null;
    } catch {
      return null;
    }
  }

  isLoggedIn(): boolean {
    return this.getCurrentUser() !== null;
  }

  logout(): void {
    localStorage.removeItem('currentUser');
  }

  getHomeRouteForCurrentUser(): string {
    const role = this.getCurrentUser()?.role;
    if (role === 'client') return '/client';
    if (role === 'printer') return '/printer';
    if (role === 'admin') return '/admin';
    return '/';
  }

  getUser(username: string) {
    return this.http.get<UserProfile>('http://localhost:4000/users/' + encodeURIComponent(username));
  }

  updateUser(username: string, data: object) {
    return this.http.put<UserProfile>('http://localhost:4000/users/' + encodeURIComponent(username), data);
  }

  uploadProfileImage(username: string, file: File) {
    const image = new FormData();
    image.append('profileImage', file);
    return this.http.put<{ message: string; user: UserProfile }>('http://localhost:4000/users/' + encodeURIComponent(username) + '/profile-image', image);
  }

  register(data: Record<string, string>, image: File | null = null) {
    const formData = new FormData();
    for (const key of Object.keys(data)) {
      formData.append(key, data[key]);
    }
    if (image) formData.append('profileImage', image);
    return this.http.post('http://localhost:4000/users/register', formData);
  }

  login(username: string, password: string) {
    return this.http.post<{
      username: string;
      firstName: string;
      lastName: string;
      email: string;
      role: string;
      clientType: string | null;
    }>('http://localhost:4000/users/login', {username, password});
  }

  adminLogin(username: string, password: string) {
    return this.http.post<{
      username: string;
      firstName: string;
      lastName: string;
      email: string;
      role: 'admin';
    }>('http://localhost:4000/users/admin-login', {username, password});
  }



}
