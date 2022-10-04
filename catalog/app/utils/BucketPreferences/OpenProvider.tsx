import * as React from 'react'

import * as Sentry from 'utils/Sentry'

import { BucketPreferences, extendDefaults } from './BucketPreferences'

const openModePreferences = {
  ui: {
    actions: {
      copyPackage: false,
      createPackage: false,
      deleteRevision: false,
      revisePackage: false,
    },
  },
}

interface OpenProviderProps {
  context: React.Context<BucketPreferences | null>
  children: React.ReactNode
}

export default function OpenProvider({ context: Ctx, children }: OpenProviderProps) {
  const sentry = Sentry.use()
  const value = React.useMemo(() => extendDefaults(openModePreferences, sentry), [sentry])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
