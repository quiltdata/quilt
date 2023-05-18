import * as React from 'react'

import { Result, extendDefaults } from './BucketPreferences'

const localModePreferences = Result.Ok(
  extendDefaults({
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
  }),
)

interface LocalProviderProps {
  context: React.Context<Result>
  children: React.ReactNode
}

export default function LocalProvider({ context: Ctx, children }: LocalProviderProps) {
  return <Ctx.Provider value={localModePreferences}>{children}</Ctx.Provider>
}
