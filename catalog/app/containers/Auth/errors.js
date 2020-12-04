import { BaseError } from 'utils/error'

const withDefaultMessage = (message, props) => ({ message, ...props })

export class AuthError extends BaseError {
  // eslint-disable-next-line react/static-property-placement
  static displayName = 'AuthError'

  constructor(props) {
    const { message, ...rest } = withDefaultMessage('auth error', props)
    super(message, rest)
  }
}

export class InvalidToken extends AuthError {
  // eslint-disable-next-line react/static-property-placement
  static displayName = 'InvalidToken'

  constructor(props) {
    super(withDefaultMessage('invalid token', props))
  }
}

export class InvalidCredentials extends AuthError {
  // eslint-disable-next-line react/static-property-placement
  static displayName = 'InvalidCredentials'

  constructor(props) {
    super(withDefaultMessage('invalid credentials', props))
  }
}

export class EmailTaken extends AuthError {
  // eslint-disable-next-line react/static-property-placement
  static displayName = 'EmailTaken'

  constructor(props) {
    super(withDefaultMessage('email taken', props))
  }
}

export class EmailDomainNotAllowed extends AuthError {
  // eslint-disable-next-line react/static-property-placement
  static displayName = 'EmailDomainNotAllowed'

  constructor(props) {
    super(withDefaultMessage(`email domain not allowed: "${props.domain}"`, props))
  }
}

export class UsernameTaken extends AuthError {
  // eslint-disable-next-line react/static-property-placement
  static displayName = 'UsernameTaken'

  constructor(props) {
    super(withDefaultMessage('username taken', props))
  }
}

export class InvalidUsername extends AuthError {
  // eslint-disable-next-line react/static-property-placement
  static displayName = 'InvalidUsername'

  constructor(props) {
    super(withDefaultMessage('invalid username', props))
  }
}

export class InvalidEmail extends AuthError {
  // eslint-disable-next-line react/static-property-placement
  static displayName = 'InvalidEmail'

  constructor(props) {
    super(withDefaultMessage('invalid email', props))
  }
}

export class InvalidResetLink extends AuthError {
  // eslint-disable-next-line react/static-property-placement
  static displayName = 'InvalidResetLink'

  constructor(props) {
    super(withDefaultMessage('invalid reset link', props))
  }
}

export class InvalidPassword extends AuthError {
  // eslint-disable-next-line react/static-property-placement
  static displayName = 'InvalidPassword'

  constructor(props) {
    super(withDefaultMessage('invalid password', props))
  }
}

export class SMTPError extends AuthError {
  // eslint-disable-next-line react/static-property-placement
  static displayName = 'SMTPError'

  constructor(props) {
    super(withDefaultMessage('SMTP error', props))
  }
}

export class SSOUserNotFound extends AuthError {
  // eslint-disable-next-line react/static-property-placement
  static displayName = 'SSOUserNotFound'

  constructor(props) {
    super(withDefaultMessage('linked user not found', props))
  }
}

export class SSOError extends AuthError {
  // eslint-disable-next-line react/static-property-placement
  static displayName = 'SSOError'

  constructor(props) {
    super(
      withDefaultMessage(`[${props.provider}] ${props.code}: ${props.details}`, props),
    )
  }
}
