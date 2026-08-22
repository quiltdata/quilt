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

// aws-sdk v3 model: credentials are an `AwsCredentialIdentityProvider` —
// `() => Promise<AwsCredentialIdentity>` — not a class the SDK invokes via ES5
// pseudo-inheritance. We keep a plain class here (no `extends AWS.Credentials`)
// purely to preserve the catalog's React-suspense contract (`.suspend()`,
// `.error`, `.needsRefresh()`), and expose a v3 `.provider` the clients consume.
//
// The SDK calls `provider()` before each request and re-invokes it once the
// returned `expiration` has passed, so we cache the in-flight refresh and hand
// back the current identity until it expires.
class RegistryCredentials {
  constructor({ req, reqOpts }) {
    this.req = req
    this.reqOpts = reqOpts
    this.accessKeyId = undefined
    this.secretAccessKey = undefined
    this.sessionToken = undefined
    this.expireTime = undefined
    // bound so it can be passed directly as an AwsCredentialIdentityProvider
    this.provider = this.provider.bind(this)
  }

  // matches aws-sdk v2 Credentials#needsRefresh expiry-window semantics:
  // refresh a bit before actual expiry (15s) to avoid using stale creds.
  needsRefresh() {
    if (!this.accessKeyId) return true
    if (!this.expireTime) return false
    return this.expireTime.getTime() - 15 * 1000 < Date.now()
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

  // aws-sdk v3 AwsCredentialIdentityProvider entry point.
  async provider() {
    if (this.error) throw this.error
    if (this.needsRefresh()) await this.refresh()
    return {
      accessKeyId: this.accessKeyId,
      secretAccessKey: this.secretAccessKey,
      sessionToken: this.sessionToken,
      expiration: this.expireTime ?? undefined,
    }
  }

  suspend() {
    if (this.error) throw this.error
    if (this.needsRefresh()) throw this.refresh()
    return this
  }
}

// Anonymous / unauthenticated. Exposes the same surface; its provider should
// never actually be invoked (anonymous requests use a noop signer), but we
// return empty creds defensively.
class EmptyCredentials {
  constructor() {
    this.provider = this.provider.bind(this)
  }

  needsRefresh() {
    return false
  }

  // eslint-disable-next-line class-methods-use-this
  async provider() {
    return { accessKeyId: '', secretAccessKey: '' }
  }

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
