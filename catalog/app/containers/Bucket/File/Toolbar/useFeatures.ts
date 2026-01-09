import cfg from 'constants/config'
import * as BucketPreferences from 'utils/BucketPreferences'

export interface Features {
  get: false | { code: boolean } | null
  organize: false | { delete: boolean } | null
  qurator: boolean | null
}

export function useFeatures(notAvailable?: boolean): Features | null {
  const { prefs } = BucketPreferences.use()
  if (typeof notAvailable === 'undefined') return null
  return BucketPreferences.Result.match(
    {
      Ok: ({ ui: { actions, blocks } }) => ({
        get:
          !notAvailable && !cfg.noDownload && actions.downloadObject
            ? { code: blocks.code }
            : false,
        organize: !notAvailable ? { delete: actions.deleteObject } : false,
        qurator: blocks.qurator,
      }),
      _: () => null,
    },
    prefs,
  )
}
