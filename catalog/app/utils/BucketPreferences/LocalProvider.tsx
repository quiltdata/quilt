import * as React from 'react'

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
    blocks: {
      analytics: true,
      browser: true,
      code: true,
      meta: true,
    },
    nav: {
      files: true,
      packages: true,
      queries: false,
    },
  },
}

interface LocalProviderProps {
  context: React.Context<BucketPreferences | null>
  children: React.ReactNode
}

export default function LocalProvider({ context: Ctx, children }: LocalProviderProps) {
  const sentry = Sentry.use()
  const value = React.useMemo(
    () => extendDefaults(localModePreferences, sentry),
    [sentry],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
