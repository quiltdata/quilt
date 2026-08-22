import cfg from 'constants/config'
import * as BucketPreferences from 'utils/BucketPreferences'

export interface Features {
  get: false | { code: boolean }
  organize: false | { delete: boolean }
  qurator: boolean
}

/**
 * @param objectDeleted the object's current version is a delete marker, so deleting
 *   again would only stack another one. Kept separate from `notAvailable` because that
 *   also gates `get`, and a pinned surviving version stays downloadable.
 */
export function useFeatures(
  notAvailable?: boolean,
  objectDeleted?: boolean,
): Features | null {
  const { prefs } = BucketPreferences.use()
  if (typeof notAvailable === 'undefined') return null
  return BucketPreferences.Result.match(
    {
      Ok: ({ ui: { actions, blocks } }) => ({
        get:
          !notAvailable && !cfg.noDownload && actions.downloadObject
            ? { code: blocks.code }
            : false,
        organize: !notAvailable
          ? { delete: actions.deleteObject && !objectDeleted }
          : false,
        qurator: blocks.qurator,
      }),
      _: () => null,
    },
    prefs,
  )
}
