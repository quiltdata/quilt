import * as Eff from 'effect'
import * as React from 'react'
import { Schema as S } from '@effect/schema'

import * as Assistant from 'components/Assistant'
import type * as Model from 'model'
import * as APIConnector from 'utils/APIConnector'
import mkSearch from 'utils/mkSearch'

type EsHit = { _source?: { content?: string } }

type EsOutput = { hits?: { hits?: EsHit[] } } | null

interface ApiRequest {
  (endpoint: string): Promise<EsOutput>
}

const GetObjectContentsAndMetadataSchema = S.Struct({
  bucket: S.String,
  key: S.String,
  version: S.optional(S.String).annotations({}),
}).annotations({
  description: 'Get full contents and metadata of an S3 object',
})

function useGetObjectContentsAndMetadata() {
  const req: ApiRequest = APIConnector.use()

  return Assistant.Model.Tool.useMakeTool(
    GetObjectContentsAndMetadataSchema,
    (handle) =>
      Eff.Effect.gen(function* () {
        yield* Eff.Console.debug('TOOL: getObjectContents', handle)

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
        const res = yield* Eff.Effect.promise(() => req(`/search${qs}`))
        // eslint-disable-next-line no-underscore-dangle
        const content = res?.hits?.hits?.[0]._source?.content
        if (!content) throw new Error('Failed to find the content for this file')
        // TODO: return appropriate Content.* type
        return Eff.Option.some(
          Assistant.Model.Tool.Result({
            status: 'success',
            content: [
              Assistant.Model.Content.ToolResultContentBlock.Text({ text: content }),
            ],
          }),
        )
      }),
    [req],
  )
}

interface QuratorContextProps {
  handle: Model.S3.S3ObjectLocation
}

export default function QuratorContext({ handle }: QuratorContextProps) {
  const tools = {
    getObjectContents: useGetObjectContentsAndMetadata(),
  }

  const messages = React.useMemo(
    () => [`You are viewing the details page for an S3 object ${JSON.stringify(handle)}`],
    [handle],
  )

  return <Assistant.Context.Push messages={messages} tools={tools} />
}
