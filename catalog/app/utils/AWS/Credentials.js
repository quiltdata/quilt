import AWS from 'aws-sdk/lib/core'
import 'aws-sdk/lib/credentials'
import * as React from 'react'
import * as reduxHook from 'redux-react-hook'

import * as Auth from 'containers/Auth'
import * as APIConnector from 'utils/APIConnector'
import * as Config from 'utils/Config'
import useMemoEq from 'utils/useMemoEq'

class RegistryCredentials extends AWS.Credentials {
  constructor({ req }) {
    super()
    this.req = req
  }

  refresh(callback) {
    if (!this.refreshing) {
      this.refreshing = this.req({ endpoint: '/auth/get_credentials' })
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
          if (callback) callback(e)
          throw e
        })
    }
    return this.refreshing
  }

  suspend() {
    if (this.needsRefresh()) throw this.refresh()
    return this
  }
}

class GuestCredentials extends AWS.Credentials {
  suspend() {
    return this
  }
}

const useCredentialsMemo = () => {
  const guest = useMemoEq(
    Config.useConfig().guestCredentials,
    (creds) => new GuestCredentials(creds),
  )

  const reg = useMemoEq(APIConnector.use(), (req) => new RegistryCredentials({ req }))

  return useMemoEq(
    {
      auth: reduxHook.useMappedState(Auth.selectors.authenticated),
      guest,
      reg,
    },
    (i) => (i.auth ? i.reg : i.guest),
  )
}

const Ctx = React.createContext()

export const Provider = ({ children }) => (
  <Ctx.Provider value={useCredentialsMemo()}>{children}</Ctx.Provider>
)

export const useCredentials = () => React.useContext(Ctx)

export const use = useCredentials
