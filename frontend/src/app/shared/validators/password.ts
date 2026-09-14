import { ValidatorFn, Validators } from '@angular/forms';

export const passwordValidators = [
  Validators.required,
  Validators.minLength(8),
  Validators.maxLength(12),
  Validators.pattern(/^(?=.*\p{Lu})(?=.*[0-9])(?=.*[\p{P}\p{S}])\p{L}.*$/u)
];

export const matchingPasswords: ValidatorFn = group => {
  const password = group.get('newPassword')?.value;
  const confirmation = group.get('confirmPassword')?.value;
  // Empty fields are handled by their own required validators.
  return password && confirmation && password !== confirmation
    ? { passwordMismatch: true } : null;
};
