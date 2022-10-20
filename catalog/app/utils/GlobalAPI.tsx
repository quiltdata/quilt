import invariant from 'invariant'
import * as React from 'react'
import * as rredux from 'react-redux'
import type * as redux from 'redux'

import * as Auth from 'containers/Auth'
import defer from 'utils/defer'

export function GlobalAPIProvider({
  children,
  api,
}: React.PropsWithChildren<{ api: GlobalAPI }>) {
  const store = rredux.useStore()
  React.useEffect(() => {
    api.setReduxStore(store)
  }, [api, store])
  return <>{children}</>
}

interface ReduxStoreContainer {
  store: redux.Store | null
  promise: Promise<void>
  resolve: () => void
}

export default class GlobalAPI {
  private reduxStoreContainer: ReduxStoreContainer

  constructor() {
    const dfd = defer<void>()
    this.reduxStoreContainer = {
      store: null,
      promise: dfd.promise,
      resolve: dfd.resolver.resolve,
    }
  }

  setReduxStore(store: redux.Store) {
    const { reduxStoreContainer: c } = this
    const shouldResolve = !c.store
    c.store = store
    if (shouldResolve) c.resolve()
    return this
  }

  async dispatch(action: redux.AnyAction) {
    const { reduxStoreContainer: c } = this
    await c.promise
    invariant(c.store, 'store is not set')
    return c.store.dispatch(action)
  }

  async signIn(credentials: { username: string; password: string }) {
    const result = defer()
    await this.dispatch(Auth.actions.signIn(credentials, result.resolver))
    await result.promise
  }

  attach(window: any, key = 'QuiltCatalog') {
    window[key] = this
  }

  getProvider() {
    return (props: React.PropsWithChildren<{}>) => (
      <GlobalAPIProvider {...props} api={this} />
    )
  }
}
