import { BaseError } from 'utils/error'

interface AuthErrorProps {
  message?: string
  [k: string]: any
}

const withDefaultMessage = (message: string, props?: AuthErrorProps) => ({
  message,
  ...props,
})

export class AuthError extends BaseError {
  static displayName = 'AuthError'

  constructor(props?: AuthErrorProps) {
    const { message, ...rest } = withDefaultMessage('auth error', props)
    super(message, rest)
  }
}

export class NoDefaultRole extends AuthError {
  static displayName = 'NoDefaultRole'

  constructor(props?: AuthErrorProps) {
    super(withDefaultMessage('default role not set', props))
  }
}

export class InvalidToken extends AuthError {
  static displayName = 'InvalidToken'

  constructor(props?: AuthErrorProps) {
    super(withDefaultMessage('invalid token', props))
  }
}

export class InvalidCredentials extends AuthError {
  static displayName = 'InvalidCredentials'

  constructor(props?: AuthErrorProps) {
    super(withDefaultMessage('invalid credentials', props))
  }
}

export class EmailTaken extends AuthError {
  static displayName = 'EmailTaken'

  constructor(props?: AuthErrorProps) {
    super(withDefaultMessage('email taken', props))
  }
}

interface EmailDomainNotAllowedProps extends AuthErrorProps {
  domain?: string
}

export class EmailDomainNotAllowed extends AuthError {
  static displayName = 'EmailDomainNotAllowed'

  constructor(props: EmailDomainNotAllowedProps) {
    super(withDefaultMessage(`email domain not allowed: "${props.domain}"`, props))
  }
}

export class UsernameTaken extends AuthError {
  static displayName = 'UsernameTaken'

  constructor(props?: AuthErrorProps) {
    super(withDefaultMessage('username taken', props))
  }
}

export class InvalidUsername extends AuthError {
  static displayName = 'InvalidUsername'

  constructor(props?: AuthErrorProps) {
    super(withDefaultMessage('invalid username', props))
  }
}

export class InvalidEmail extends AuthError {
  static displayName = 'InvalidEmail'

  constructor(props?: AuthErrorProps) {
    super(withDefaultMessage('invalid email', props))
  }
}

export class InvalidPassword extends AuthError {
  static displayName = 'InvalidPassword'

  constructor(props?: AuthErrorProps) {
    super(withDefaultMessage('invalid password', props))
  }
}

export class PassChangeUserNotFound extends AuthError {
  static displayName = 'PassChangeUserNotFound'

  constructor(props?: AuthErrorProps) {
    super(withDefaultMessage('user not found', props))
  }
}

export class PassChangeNotAllowed extends AuthError {
  static displayName = 'PassChangeNotAllowed'

  constructor(props?: AuthErrorProps) {
    super(withDefaultMessage('user not allowed to reset password', props))
  }
}

export class PassChangeInvalidToken extends AuthError {
  static displayName = 'PassChangeInvalidToken'

  constructor(props?: AuthErrorProps) {
    super(withDefaultMessage('invalid token', props))
  }
}

export class SMTPError extends AuthError {
  static displayName = 'SMTPError'

  constructor(props?: AuthErrorProps) {
    super(withDefaultMessage('SMTP error', props))
  }
}

export class SSOUserNotFound extends AuthError {
  static displayName = 'SSOUserNotFound'

  constructor(props?: AuthErrorProps) {
    super(withDefaultMessage('linked user not found', props))
  }
}

interface SSOErrorProps extends AuthErrorProps {
  provider?: string
  code?: string
  details?: string
}

export class SSOError extends AuthError {
  static displayName = 'SSOError'

  constructor(props: SSOErrorProps) {
    super(
      withDefaultMessage(`[${props.provider}] ${props.code}: ${props.details}`, props),
    )
  }
}

export class SubscriptionInvalid extends AuthError {
  static displayName = 'SubscriptionInvalid'

  constructor(props?: AuthErrorProps) {
    super(withDefaultMessage('Subscription invalid', props))
  }
}
