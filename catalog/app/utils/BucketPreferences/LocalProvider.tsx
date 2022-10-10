import * as React from 'react'

import AsyncResult from 'utils/AsyncResult'
import * as Sentry from 'utils/Sentry'

import { BucketPreferences, extendDefaults } from './BucketPreferences'

const localModePreferences = {
  ui: {
    actions: {
      copyPackage: false,
      createPackage: false,
      deleteRevision: false,
      revisePackage: false,
    },
    nav: {
      queries: false,
    },
  },
}

interface LocalProviderProps {
  context: React.Context<{ preferences: BucketPreferences | null; result: $TSFixMe }>
  children: React.ReactNode
}

export default function LocalProvider({ context: Ctx, children }: LocalProviderProps) {
  const sentry = Sentry.use()
  const preferences = React.useMemo(
    () => extendDefaults(localModePreferences, sentry),
    [sentry],
  )
  const result = AsyncResult.Ok(preferences)
  return <Ctx.Provider value={{ preferences, result }}>{children}</Ctx.Provider>
}
