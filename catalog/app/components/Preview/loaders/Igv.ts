import hljs from 'highlight.js'
import * as R from 'ramda'
import * as React from 'react'

import * as AWS from 'utils/AWS'
import AsyncResult from 'utils/AsyncResult'
import { useLogicalKeyResolver } from 'utils/LogicalKeyResolver'
import * as Resource from 'utils/Resource'
import * as s3paths from 'utils/s3paths'
import type { JsonRecord } from 'utils/types'

import { PreviewData, PreviewError } from '../types'

import * as summarize from './summarize'
import * as utils from './utils'

// re-use from summarize
interface S3SummarizeHandle {
  bucket: string
  key: string
  logicalKey?: string
  size?: number
  version?: string
}

const traverseUrls = (fn: (v: any) => any, json: JsonRecord) =>
  R.evolve(
    {
      reference: R.evolve({
        fastaURL: fn,
        indexURL: fn,
        cytobandURL: fn,
        aliasURL: fn,
      }),
      tracks: R.map(
        R.evolve({
          url: fn,
          indexURL: fn,
        }),
      ),
    },
    json,
  )

function useUrlsSigner(handle: S3SummarizeHandle) {
  // @ts-expect-error
  const sign = AWS.Signer.useS3Signer({ forceProxy: true })
  const resolveLogicalKey = useLogicalKeyResolver()

  const resolvePath = React.useMemo(
    () =>
      resolveLogicalKey && handle.logicalKey
        ? async (path: string) => {
            try {
              return await resolveLogicalKey(
                s3paths.resolveKey(handle.logicalKey as string, path),
              )
            } catch (e) {
              // eslint-disable-next-line no-console
              console.warn(
                `Error resolving data url '${path}' referenced from vega spec at '${handle.logicalKey}'`,
              )
              // eslint-disable-next-line no-console
              console.error(e)
              throw PreviewError.SrcDoesNotExist({ path })
            }
          }
        : (path: string) => ({
            bucket: handle.bucket,
            key: s3paths.resolveKey(handle.key, path),
          }),
    [resolveLogicalKey, handle.logicalKey, handle.key, handle.bucket],
  )

  const processUrl = React.useMemo(
    () =>
      R.pipe(
        Resource.parse,
        Resource.Pointer.case({
          Web: async (url) => url,
          S3: async (h) => sign(h),
          S3Rel: async (path) => sign(await resolvePath(path)),
          Path: async (path) => sign(await resolvePath(path)),
        }),
      ),
    [sign, resolvePath],
  )

  return React.useCallback(
    async (json: JsonRecord) => {
      const promises: Promise<$TSFixMe>[] = []
      // spec url in each tracks[].url and tracks[].indexURL
      const specWithPlaceholders = traverseUrls((url: string): number => {
        const len = promises.push(processUrl(url))
        return len - 1
      }, json)
      const results = await Promise.all(promises)
      return traverseUrls((idx: number): string => results[idx], specWithPlaceholders)
    },
    [processUrl],
  )
}

export const detect = (key: string, options: summarize.File) =>
  summarize.detect('igv')(options)

const hl = (language: string) => (contents: string) =>
  hljs.highlight(contents, { language }).value

interface IgvLoaderProps {
  children: (r: $TSFixMe) => React.ReactNode
  gated?: boolean
  handle: S3SummarizeHandle
}

interface PreviewResult {
  info: {
    data: {
      head: string[]
      tail: string[]
    }
    note?: string
    warnings?: string
  }
}

export const Loader = function IgvLoader({ gated, handle, children }: IgvLoaderProps) {
  const signUrls = useUrlsSigner(handle)

  const { result, fetch } = utils.usePreview({
    type: 'txt',
    handle,
  } as $TSFixMe)

  const processed = utils.useAsyncProcessing(
    result,
    async ({ info: { data, note, warnings } }: PreviewResult) => {
      const head = data.head.join('\n')
      const tail = data.tail.join('\n')
      try {
        // TODO: url signers, re-use useVegaSpecSigner
        const options = JSON.parse([head, tail].join('\n'))
        const auxOptions = await signUrls(options)
        return PreviewData.Igv({ options: auxOptions })
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e)
        if (e instanceof SyntaxError) {
          const lang = 'json'
          // @ts-expect-error ts can't find appropriate type declaration
          const highlighted = R.map<string, string>(hl(lang), { head, tail })
          return PreviewData.Text({
            lang,
            highlighted,
            note,
            warnings,
          })
        }
        throw e
      }
    },
    [],
  )
  const handled = utils.useErrorHandling(processed, { handle, retry: fetch })
  return children(
    gated && AsyncResult.Init.is(handled)
      ? AsyncResult.Err(PreviewError.Gated({ handle, load: fetch }))
      : handled,
  )
}
