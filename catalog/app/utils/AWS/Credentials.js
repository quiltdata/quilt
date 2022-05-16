import AWS from 'aws-sdk/lib/core'
import 'aws-sdk/lib/credentials'
import * as React from 'react'
import * as redux from 'react-redux'

import * as authSelectors from 'containers/Auth/selectors'
import * as APIConnector from 'utils/APIConnector'
import * as Config from 'utils/Config'
import { BaseError } from 'utils/error'
import useMemoEq from 'utils/useMemoEq'

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
          this.expireTime = data.Expiration ? new Date(data.Expiration) : null
          this.accessKeyId = data.AccessKeyId
          this.secretAccessKey = data.SecretAccessKey
          this.sessionToken = data.SessionToken
          delete this.refreshing
          if (callback) callback()
        })
        .catch((e) => {
          delete this.refreshing
          this.error = new Error(`Unable to fetch AWS credentials: ${e}`)
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

function useCredentialsMemo({ local }) {
  const empty = React.useMemo(() => new EmptyCredentials(), [])
  const reg = useMemoEq(APIConnector.use(), (req) => new RegistryCredentials({ req }))
  const anon = useMemoEq(
    APIConnector.use(),
    (req) => new RegistryCredentials({ req, reqOpts: { auth: false } }),
  )

  return useMemoEq(
    {
      local,
      auth: redux.useSelector(authSelectors.authenticated),
      reg,
      anon,
      empty,
    },
    // eslint-disable-next-line no-nested-ternary
    (i) => (i.auth ? i.reg : i.local ? i.anon : i.empty),
  )
}

const Ctx = React.createContext()

export function AWSCredentialsProvider({ children }) {
  const cfg = Config.use()
  const local = cfg.mode === 'LOCAL'
  return <Ctx.Provider value={useCredentialsMemo({ local })}>{children}</Ctx.Provider>
}

export class CredentialsError extends BaseError {
  constructor(headline, detail, object) {
    super(headline, { headline, detail, object })
  }
}

export function useCredentials() {
  const credentials = React.useContext(Ctx)
  // TODO: find out real reason
  if (!credentials) throw new CredentialsError('Session expired')
  return React.useContext(Ctx)
}

export { AWSCredentialsProvider as Provider, useCredentials as use }
