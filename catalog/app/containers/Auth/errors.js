import { BaseError } from 'utils/error'

const withDefaultMessage = (message, props) => ({ message, ...props })

export class AuthError extends BaseError {
  static displayName = 'AuthError'

  constructor(props) {
    const { message, ...rest } = withDefaultMessage('auth error', props)
    super(message, rest)
  }
}

export class NoDefaultRole extends AuthError {
  static displayName = 'NoDefaultRole'

  constructor(props) {
    super(withDefaultMessage('default role not set', props))
  }
}

export class InvalidToken extends AuthError {
  static displayName = 'InvalidToken'

  constructor(props) {
    super(withDefaultMessage('invalid token', props))
  }
}

export class InvalidCredentials extends AuthError {
  static displayName = 'InvalidCredentials'

  constructor(props) {
    super(withDefaultMessage('invalid credentials', props))
  }
}

export class EmailTaken extends AuthError {
  static displayName = 'EmailTaken'

  constructor(props) {
    super(withDefaultMessage('email taken', props))
  }
}

export class EmailDomainNotAllowed extends AuthError {
  static displayName = 'EmailDomainNotAllowed'

  constructor(props) {
    super(withDefaultMessage(`email domain not allowed: "${props.domain}"`, props))
  }
}

export class UsernameTaken extends AuthError {
  static displayName = 'UsernameTaken'

  constructor(props) {
    super(withDefaultMessage('username taken', props))
  }
}

export class InvalidUsername extends AuthError {
  static displayName = 'InvalidUsername'

  constructor(props) {
    super(withDefaultMessage('invalid username', props))
  }
}

export class InvalidEmail extends AuthError {
  static displayName = 'InvalidEmail'

  constructor(props) {
    super(withDefaultMessage('invalid email', props))
  }
}

export class InvalidPassword extends AuthError {
  static displayName = 'InvalidPassword'

  constructor(props) {
    super(withDefaultMessage('invalid password', props))
  }
}

export class PassChangeUserNotFound extends AuthError {
  static displayName = 'PassChangeUserNotFound'

  constructor(props) {
    super(withDefaultMessage('user not found', props))
  }
}

export class PassChangeNotAllowed extends AuthError {
  static displayName = 'PassChangeNotAllowed'

  constructor(props) {
    super(withDefaultMessage('user not allowed to reset password', props))
  }
}

export class PassChangeInvalidToken extends AuthError {
  static displayName = 'PassChangeInvalidToken'

  constructor(props) {
    super(withDefaultMessage('invalid token', props))
  }
}

export class SMTPError extends AuthError {
  static displayName = 'SMTPError'

  constructor(props) {
    super(withDefaultMessage('SMTP error', props))
  }
}

export class SSOUserNotFound extends AuthError {
  static displayName = 'SSOUserNotFound'

  constructor(props) {
    super(withDefaultMessage('linked user not found', props))
  }
}

export class SSOError extends AuthError {
  static displayName = 'SSOError'

  constructor(props) {
    super(
      withDefaultMessage(`[${props.provider}] ${props.code}: ${props.details}`, props),
    )
  }
}
