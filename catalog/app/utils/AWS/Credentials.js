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
  constructor(headline, detail, object) {
    super(headline, { headline, detail, object })
  }
}

class OutdatedTokenError extends CredentialsError {}

class InvalidTokenError extends CredentialsError {}

class NewExpirationInThePastError extends CredentialsError {}

class RegistryCredentials extends AWS.Credentials {
  constructor({ req, reqOpts }) {
    super()
    this.req = req
    this.reqOpts = reqOpts
  }

  refresh(callback) {
    if (!this.refreshing) {
      this.refreshing = this.req({ endpoint: '/auth/get_credentials', ...this.reqOpts })
        .then((data) => {
          const expireTime = data.Expiration ? new Date(data.Expiration) : null
          if (expireTime?.getTime() < Date.now()) {
            throw new NewExpirationInThePastError(
              `We're getting credentials that are already expired. Check your computer's clock, please`,
            )
          }
          this.expireTime = expireTime
          this.accessKeyId = data.AccessKeyId
          this.secretAccessKey = data.SecretAccessKey
          this.sessionToken = data.SessionToken
          delete this.refreshing
          if (callback) callback()
        })
        .catch((e) => {
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

class EmptyCredentials extends AWS.Credentials {
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

const Ctx = React.createContext()

export function AWSCredentialsProvider({ children }) {
  return <Ctx.Provider value={useCredentialsMemo()}>{children}</Ctx.Provider>
}

export function useCredentials() {
  const credentials = React.useContext(Ctx)
  if (!credentials) throw new CredentialsError('Failed to get credentials')
  if (
    credentials.error instanceof OutdatedTokenError ||
    credentials.error instanceof InvalidTokenError
  ) {
    logout()
  }
  return React.useContext(Ctx)
}

export { AWSCredentialsProvider as Provider, useCredentials as use }
