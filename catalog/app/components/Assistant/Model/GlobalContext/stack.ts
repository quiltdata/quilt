import * as React from 'react'

import * as BucketConfig from 'utils/BucketConfig'
import * as XML from 'utils/XML'

export function useStackInfo() {
  const bucketConfigs = BucketConfig.useRelevantBucketConfigs()

  return React.useMemo(() => {
    const buckets = XML.tag(
      'buckets',
      {},
      'Buckets attached to this stack:',
      ...bucketConfigs.map((b) =>
        XML.tag(
          'bucket',
          {},
          JSON.stringify(
            {
              name: b.name,
              title: b.title,
              description: b.description,
              tags: b.tags,
            },
            null,
            2,
          ),
        ),
      ),
    )
    return XML.tag('quilt-stack-info', {}, buckets).toString()
  }, [bucketConfigs])
}
