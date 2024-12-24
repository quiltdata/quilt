import * as React from 'react'

import type * as Model from 'model'

import {
  BucketPreferences,
  BucketPreferencesInput,
  Result,
  extendDefaults,
} from './BucketPreferences'

const localModePreferences = {
  handle: null,
  prefs: Result.Ok(
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
  ),
  update: () => {
    throw new Error('Bucket config for local mode cannot be updated')
  },
}

interface LocalProviderProps {
  context: React.Context<{
    handle: Model.S3.S3ObjectLocation | null
    prefs: Result
    update: (upd: BucketPreferencesInput) => Promise<BucketPreferences>
  }>
  children: React.ReactNode
}

export default function LocalProvider({ context: Ctx, children }: LocalProviderProps) {
  return <Ctx.Provider value={localModePreferences}>{children}</Ctx.Provider>
}
