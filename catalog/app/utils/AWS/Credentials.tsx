import AWS from 'aws-sdk/lib/core'
import 'aws-sdk/lib/credentials'
import * as React from 'react'
import * as redux from 'react-redux'

import cfg from 'constants/config'
import * as authSelectors from 'containers/Auth/selectors'
import * as APIConnector from 'utils/APIConnector'
import { BaseError } from 'utils/error'
import logout from 'utils/logout'

export class CredentialsError extends BaseError {
  constructor(headline: string, detail?: string, object?: {}) {
    super(headline, { headline, detail, object })
  }
}

class OutdatedTokenError extends CredentialsError {}

class InvalidTokenError extends CredentialsError {}

class NewExpirationInThePastError extends CredentialsError {}

interface RegistryCredentialsOptions {
  req: APIConnector.ApiRequest
  reqOpts?: APIConnector.RequestOptions
}

interface CredentialsResponse {
  Expiration?: string
  AccessKeyId: string
  SecretAccessKey: string
  SessionToken: string
}

// aws-sdk's Credentials constructor requires args; cast the base to a 0-arg
// constructor (instances are still AWS.Credentials, so they stay assignable
// where Credentials is expected) to allow super() without altering behavior.
class RegistryCredentials extends (AWS.Credentials as unknown as {
  new (): AWS.Credentials
}) {
  req: APIConnector.ApiRequest

  reqOpts?: APIConnector.RequestOptions

  refreshing?: Promise<void>

  error?: CredentialsError

  constructor({ req, reqOpts }: RegistryCredentialsOptions) {
    super()
    this.req = req
    this.reqOpts = reqOpts
  }

  refresh(callback?: (err?: any) => void): Promise<void> {
    if (!this.refreshing) {
      this.refreshing = this.req({ endpoint: '/auth/get_credentials', ...this.reqOpts })
        .then((data: CredentialsResponse) => {
          const expireTime = data.Expiration ? new Date(data.Expiration) : null
          if (expireTime != null && expireTime.getTime() < Date.now()) {
            throw new NewExpirationInThePastError(
              `We're getting credentials that are already expired. Check your computer's clock, please`,
            )
          }
          this.expireTime = expireTime as Date
          this.accessKeyId = data.AccessKeyId
          this.secretAccessKey = data.SecretAccessKey
          this.sessionToken = data.SessionToken
          delete this.refreshing
          if (callback) callback()
        })
        .catch((e: Error) => {
          delete this.refreshing
          if (/Outdated access token: please log in again/.test(e.message)) {
            this.error = new OutdatedTokenError(e.message)
          } else if (/Token could not be deserialized/.test(e.message)) {
            this.error = new InvalidTokenError(e.message)
          } else if (e instanceof NewExpirationInThePastError) {
            this.error = e
          } else {
            this.error = new CredentialsError(
              `Unable to fetch AWS credentials: ${e.message}`,
            )
          }
          if (callback) callback(this.error)
          throw this.error
        })
    }
    return this.refreshing
  }

  suspend() {
    if (this.error) throw this.error
    if (this.needsRefresh()) throw this.refresh()
    return this
  }
}

class EmptyCredentials extends (AWS.Credentials as unknown as {
  new (): AWS.Credentials
}) {
  suspend() {
    return this
  }
}

function useCredentialsMemo() {
  const authenticated = redux.useSelector(authSelectors.authenticated)
  const empty = React.useMemo(() => new EmptyCredentials(), [])
  const req = APIConnector.use()
  const reg = React.useMemo(() => new RegistryCredentials({ req }), [req])
  const anon = React.useMemo(
    () => new RegistryCredentials({ req, reqOpts: { auth: false } }),
    [req],
  )

  if (authenticated) return reg
  if (cfg.mode === 'LOCAL') return anon
  return empty
}

// The context always holds one of our subclasses (both expose `suspend()`), or
// null before the provider has run.
type Credentials = RegistryCredentials | EmptyCredentials

const Ctx = React.createContext<Credentials | null>(null)

export function AWSCredentialsProvider({ children }: React.PropsWithChildren<{}>) {
  return <Ctx.Provider value={useCredentialsMemo()}>{children}</Ctx.Provider>
}

export function useCredentials(): Credentials {
  const credentials = React.useContext(Ctx)
  if (!credentials) throw new CredentialsError('Failed to get credentials')
  if (
    (credentials as RegistryCredentials).error instanceof OutdatedTokenError ||
    (credentials as RegistryCredentials).error instanceof InvalidTokenError
  ) {
    logout()
  }
  return React.useContext(Ctx)!
}

export { AWSCredentialsProvider as Provider, useCredentials as use }
