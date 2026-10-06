import * as React from 'react'

import * as GQL from 'utils/GraphQL'
import * as S3Tags from 'utils/s3Tags'
import * as YAML from 'utils/yaml'

import BUCKET_OBJECT_TAGS_CONFIG_QUERY from '../gql/BucketObjectTagsConfig.generated'

/** `null` when the bucket maps nothing; admins edit the mapping in Admin → Buckets */
export type S3TagsConfigState = S3Tags.S3TagsConfig | null | Error

export function useS3TagsConfig(
  open: boolean,
  bucket: string,
): { config: S3TagsConfigState; loading: boolean } {
  const res = GQL.useQuery(BUCKET_OBJECT_TAGS_CONFIG_QUERY, { bucket }, { pause: !open })
  return React.useMemo(() => {
    if (!open) return { config: null, loading: false }
    return GQL.fold(res, {
      data: (data, { fetching }) => {
        if (fetching) return { config: null, loading: true }
        const text = data.bucketConfig?.objectTagsConfig
        if (!text) return { config: null, loading: false }
        // A broken config doesn't block pushing: the preview shows the error.
        try {
          const parsed = YAML.parseStrict(text)
          if (parsed instanceof Error) throw parsed
          return { config: S3Tags.parseConfig(parsed), loading: false }
        } catch (e) {
          return { config: e instanceof Error ? e : new Error(`${e}`), loading: false }
        }
      },
      fetching: () => ({ config: null, loading: true }),
      error: (e) => ({ config: e, loading: false }),
    })
  }, [open, res])
}
