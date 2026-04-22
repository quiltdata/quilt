import * as React from 'react'

import * as Buckets from 'utils/Buckets'
import * as XML from 'utils/XML'

export function useStackInfo() {
  const bucketList = Buckets.useRelevantBuckets()

  return React.useMemo(() => {
    const buckets = XML.tag(
      'buckets',
      {},
      'Buckets attached to this stack:',
      ...bucketList.map((b) =>
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
  }, [bucketList])
}
