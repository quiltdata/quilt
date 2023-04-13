import * as React from 'react'

import AsyncResult from 'utils/AsyncResult'

import { BucketPreferences, extendDefaults } from './BucketPreferences'

const localModePreferences = extendDefaults({
  ui: {
    actions: {
      copyPackage: false,
      createPackage: false,
      deleteRevision: false,
      revisePackage: false,
    },
    blocks: {
      analytics: false,
    },
    nav: {
      queries: false,
    },
  },
})

interface LocalProviderProps {
  context: React.Context<{ preferences: BucketPreferences | null; result: $TSFixMe }>
  children: React.ReactNode
}

export default function LocalProvider({ context: Ctx, children }: LocalProviderProps) {
  const result = AsyncResult.Ok(localModePreferences)
  return (
    <Ctx.Provider value={{ preferences: localModePreferences, result }}>
      {children}
    </Ctx.Provider>
  )
}
