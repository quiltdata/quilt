import AWS from 'aws-sdk/lib/core'
import 'aws-sdk/lib/credentials'
import * as React from 'react'
import * as reduxHook from 'redux-react-hook'

import * as Auth from 'containers/Auth'
import * as APIConnector from 'utils/APIConnector'
import * as Config from 'utils/Config'
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
          this.expireTime = new Date(data.Expiration)
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
      auth: reduxHook.useMappedState(Auth.selectors.authenticated),
      reg,
      anon,
      empty,
    },
    // eslint-disable-next-line no-nested-ternary
    (i) => (i.auth ? i.reg : i.local ? i.anon : i.empty),
  )
}

const Ctx = React.createContext()

export function Provider({ children }) {
  const cfg = Config.use()
  const local = cfg.mode === 'LOCAL'
  return <Ctx.Provider value={useCredentialsMemo({ local })}>{children}</Ctx.Provider>
}

export const useCredentials = () => React.useContext(Ctx)

export const use = useCredentials
