import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export const authGuard: CanActivateFn = (route) => {
  
  const router = inject(Router);
  const storedUser = localStorage.getItem('currentUser');
  const adminRoute = route.data['role'] === 'admin';

  if (!storedUser) {
    return router.createUrlTree([adminRoute ? '/admin/login' : '/login']);
  }

  try {
    const user = JSON.parse(storedUser);
    if (!user || !['client', 'printer', 'admin'].includes(user.role)) {
      return router.createUrlTree([adminRoute ? '/admin/login' : '/login']);
    }

    if (user.role !== route.data['role']) {
      return router.createUrlTree(['/' + user.role]);
    }
    if (route.data['clientType'] && user.clientType !== route.data['clientType']) {
      return router.createUrlTree(['/client']);
    }

    return true;
  } catch {
    return router.createUrlTree([adminRoute ? '/admin/login' : '/login']);
  }
};
