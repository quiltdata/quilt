import * as React from 'react'

import cfg from 'constants/config'
import * as BucketPreferences from 'utils/BucketPreferences'

export interface Features {
  add: boolean | null
  get: false | { code: boolean } | null
  organize: false | { delete: boolean } | null
  createPackage: boolean | null
}

export function useFeatures(): Features | null {
  const { prefs } = BucketPreferences.use()
  return React.useMemo(
    () =>
      BucketPreferences.Result.match(
        {
          Ok: ({ ui: { actions, blocks } }) => ({
            add: actions.writeFile,
            get:
              !cfg.noDownload && actions.downloadObject ? { code: blocks.code } : false,
            organize: { delete: actions.deleteObject },
            createPackage: actions.createPackage,
          }),
          _: () => null,
        },
        prefs,
      ),
    [prefs],
  )
}
