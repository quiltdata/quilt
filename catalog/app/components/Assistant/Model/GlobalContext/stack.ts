import * as React from 'react'

import * as Buckets from 'utils/Buckets'
import * as XML from 'utils/XML'

export function useStackInfo() {
  const buckets = Buckets.useRelevantBuckets()

  return React.useMemo(() => {
    const bucketsXml = XML.tag(
      'buckets',
      {},
      'Buckets attached to this stack:',
      ...buckets.map((b) =>
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
    return XML.tag('quilt-stack-info', {}, bucketsXml).toString()
  }, [buckets])
}
