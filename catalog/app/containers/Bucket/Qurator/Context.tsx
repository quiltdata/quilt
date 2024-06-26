import * as React from 'react'

import * as Assistant from 'components/Assistant'
import type * as Model from 'model'
import * as APIConnector from 'utils/APIConnector'
import mkSearch from 'utils/mkSearch'

type EsHit = { _source?: { content?: string } }

type EsOutput = { hits?: { hits?: EsHit[] } } | null

interface ApiRequest {
  (endpoint: string): Promise<EsOutput>
}

function useGetObjectContentsAndMetadata() {
  const req: ApiRequest = APIConnector.use()

  return React.useCallback(
    async (handle: Model.S3.S3ObjectLocation) => {
      // eslint-disable-next-line no-console
      console.log('TOOL: getObjectContents', handle)

      const qs = mkSearch({
        action: 'freeform',
        body: JSON.stringify({
          query: {
            query_string: {
              query: `key:"${handle.key}"`,
            },
          },
        }),
        filter_path: 'hits.hits',
        index: handle.bucket,
        size: 1,
      })
      const res: EsOutput = await req(`/search${qs}`)
      // eslint-disable-next-line no-underscore-dangle
      const content = res?.hits?.hits?.[0]._source?.content
      if (!content) throw new Error('Failed to find the content for this file')
      return [{ text: content }]
    },
    [req],
  )
}

interface QuratorContextProps {
  handle: Model.S3.S3ObjectLocation
}

export default function QuratorContext({ handle }: QuratorContextProps) {
  const getObjectContents = useGetObjectContentsAndMetadata()

  const tools = React.useMemo(
    () => ({
      getObjectContents: {
        description: 'Get full contents and metadata of an S3 object',
        schema: {
          type: 'object',
          properties: {
            bucket: { type: 'string' },
            key: { type: 'string' },
            version: { type: 'string' },
          },
          required: ['bucket', 'key'],
        },
        fn: getObjectContents,
      },
    }),
    [getObjectContents],
  )

  const messages = React.useMemo(
    () => [`You are viewing the details page for an S3 object ${JSON.stringify(handle)}`],
    [handle],
  )

  return <Assistant.Context.Push messages={messages} tools={tools} />
}
