export class AuthError extends Error {
  static displayName = 'AuthError';
}

export class NotAuthenticated extends AuthError {
  static displayName = 'NotAuthenticated';
}

export class UserAlreadyExists extends AuthError {
  static displayName = 'UserAlreadyExists';

  constructor({ message, ...props }) {
    super(message, props);
  }
}
