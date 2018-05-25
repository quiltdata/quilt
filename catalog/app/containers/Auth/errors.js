import { BaseError } from 'utils/error';

const withDefaultMessage = (message, props) => ({ message, ...props });

export class AuthError extends BaseError {
  static displayName = 'AuthError';

  constructor(props) {
    const { message, ...rest } = withDefaultMessage('auth error', props);
    super(message, rest);
  }
}

export class InvalidCredentials extends AuthError {
  static displayName = 'InvalidCredentials';

  constructor(props) {
    super(withDefaultMessage('invalid credentials', props));
  }
}

export class NotAuthenticated extends AuthError {
  static displayName = 'NotAuthenticated';

  constructor(props) {
    super(withDefaultMessage('not authenticated', props));
  }
}

export class EmailTaken extends AuthError {
  static displayName = 'EmailTaken';

  constructor(props) {
    super(withDefaultMessage('email taken', props));
  }
}

export class UsernameTaken extends AuthError {
  static displayName = 'UsernameTaken';

  constructor(props) {
    super(withDefaultMessage('username taken', props));
  }
}

export class InvalidUsername extends AuthError {
  static displayName = 'InvalidUsername';

  constructor(props) {
    super(withDefaultMessage('invalid username', props));
  }
}

export class UserNotFound extends AuthError {
  static displayName = 'UserNotFound';

  constructor(props) {
    super(withDefaultMessage('user not found', props));
  }
}
