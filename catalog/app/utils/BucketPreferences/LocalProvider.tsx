import * as React from 'react'

import { BucketPreferences, extendDefaults } from './BucketPreferences'

const localModePreferences: BucketPreferences = extendDefaults({
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
})

interface LocalProviderProps {
  context: React.Context<BucketPreferences | null>
  children: React.ReactNode
}

export default function LocalProvider({ context: Ctx, children }: LocalProviderProps) {
  return <Ctx.Provider value={localModePreferences}>{children}</Ctx.Provider>
}
