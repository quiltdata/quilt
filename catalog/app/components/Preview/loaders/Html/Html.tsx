import * as R from 'ramda'
import * as React from 'react'
import * as Sentry from '@sentry/react'

import cfg from 'constants/config'
import type * as Model from 'model'
import * as AWS from 'utils/AWS'
import useShouldSign from 'utils/AWS/useShouldSign'
import AsyncResult from 'utils/AsyncResult'
import { useIsInStack } from 'utils/Buckets'
import * as GQL from 'utils/GraphQL'
import log from 'utils/Logging'
import type * as LogicalKeyResolver from 'utils/LogicalKeyResolver'
import { useEnsurePFSCookie } from 'utils/PFSCookieManager'
import * as PackageUri from 'utils/PackageUri'
import { useStatusReportsBucket } from 'utils/StatusReportsBucket'
import assertNever from 'utils/assertNever'
import type { PackageHandle } from 'utils/packageHandle'

import { PreviewError, PreviewData } from '../../types'

import * as Text from '../Text'
import FileType from '../fileType'
import * as utils from '../utils'

import BROWSABLE_BUCKET_QUERY from './gql/BrowsableBucket.generated'
import CREATE_BROWSING_SESSION from './gql/CreateBrowsingSession.generated'
import DISPOSE_BROWSING_SESSION from './gql/DisposeBrowsingSession.generated'
import REFRESH_BROWSING_SESSION from './gql/RefreshBrowsingSession.generated'

export const detect = utils.extIn(['.htm', '.html'])

export const FILE_TYPE = FileType.Html

const SESSION_TTL = 60 * 3
const REFRESH_INTERVAL = SESSION_TTL * 0.2 * 1000

type SessionId = Model.GQLTypes.BrowsingSession['id']
type CreateData = GQL.DataForDoc<typeof CREATE_BROWSING_SESSION>['browsingSessionCreate']
type GQLErrorData = Extract<CreateData, { __typename: 'OperationError' | 'InvalidInput' }>

class GQLError extends Error {
  op: 'create' | 'refresh'

  data: GQLErrorData

  constructor(op: 'create' | 'refresh', data: GQLErrorData) {
    super()
    this.op = op
    this.data = data
  }
}

function mapPreviewError(retry: () => void, e: any) {
  if (!(e instanceof GQLError)) {
    return PreviewError.Unexpected({ retry, message: e.message })
  }

  switch (e.data.__typename) {
    case 'OperationError':
      switch (e.data.name) {
        case 'BucketNotBrowsable':
          return PreviewError.Forbidden()
        case 'BucketNotFound':
          return PreviewError.DoesNotExist()
        case 'SessionNotFound':
          return PreviewError.Expired({ retry })
        case 'OwnerMismatch':
          return PreviewError.Forbidden()
        default:
          const message = (
            <>
              Could not {e.op} browsing session: {e.data.__typename}(${e.data.name})
              <br />${e.data.message}`
            </>
          )
          return PreviewError.Unexpected({ retry, message })
      }
    case 'InvalidInput':
      const message = (
        <>
          Could not {e.op} browsing session: {e.data.__typename}
          {e.data.errors.map((ie) => (
            <React.Fragment key={`${ie.path}:${ie.name}`}>
              <br />
              {ie.name}
              {!!ie.path && ` at ${ie.path}`}: {ie.message}
            </React.Fragment>
          ))}
        </>
      )
      return PreviewError.Unexpected({ retry, message })
    default:
      assertNever(e.data)
  }
}

function useCreateSession() {
  const createSession = GQL.useMutation(CREATE_BROWSING_SESSION)
  const ensureCookie = useEnsurePFSCookie()
  return React.useCallback(
    async (scope: string) => {
      const { browsingSessionCreate: r } = await createSession({
        scope,
        ttl: SESSION_TTL,
      })
      switch (r.__typename) {
        case 'BrowsingSession':
          await ensureCookie()
          return r
        case 'OperationError':
        case 'InvalidInput':
          throw new GQLError('create', r)
        default:
          assertNever(r)
      }
    },
    [createSession, ensureCookie],
  )
}

function useRefreshSession() {
  const refreshSession = GQL.useMutation(REFRESH_BROWSING_SESSION)
  return React.useCallback(
    async (id: SessionId | null) => {
      if (!id) return
      const { browsingSessionRefresh: r } = await refreshSession({ id, ttl: SESSION_TTL })
      switch (r.__typename) {
        case 'BrowsingSession':
          return
        case 'OperationError':
        case 'InvalidInput':
          throw new GQLError('refresh', r)
        default:
          assertNever(r)
      }
    },
    [refreshSession],
  )
}

function useDisposeSession() {
  const disposeSession = GQL.useMutation(DISPOSE_BROWSING_SESSION)
  return React.useCallback(
    (id: SessionId | null) => {
      if (id) disposeSession({ id })
    },
    [disposeSession],
  )
}

interface FileHandle extends LogicalKeyResolver.S3SummarizeHandle {
  packageHandle: PackageHandle
}

function useSession(handle: FileHandle) {
  const [result, setResult] = React.useState(AsyncResult.Pending())
  const [key, setKey] = React.useState(0)
  const retry = React.useCallback(() => setKey(R.inc), [])

  const createSession = useCreateSession()
  const disposeSession = useDisposeSession()
  const refreshSession = useRefreshSession()

  const scope = PackageUri.stringify(handle.packageHandle)

  React.useEffect(() => {
    let disposed = false
    let sessionId: SessionId | null = null
    let timer: number

    const handleError = (e: unknown) => {
      if (disposed) return
      log.error(e)
      Sentry.captureException(e)
      window.clearInterval(timer)
      setResult(AsyncResult.Err(mapPreviewError(retry, e)))
    }

    createSession(scope).then(({ id }) => {
      if (disposed) return
      sessionId = id
      setResult(AsyncResult.Ok(sessionId))
      timer = window.setInterval(
        () => refreshSession(sessionId).catch(handleError),
        REFRESH_INTERVAL,
      )
    }, handleError)

    return () => {
      disposed = true
      window.clearInterval(timer)
      disposeSession(sessionId)
    }
  }, [key, createSession, disposeSession, refreshSession, retry, scope])

  return result
}

const SANDBOX_BROWSABLE = [
  'allow-scripts',
  'allow-same-origin',
  'allow-forms',
  'allow-popups',
].join(' ')

const SANDBOX_RESTRICTED = 'allow-scripts'

interface IFrameLoaderBrowsableProps {
  children: (result: $TSFixMe) => JSX.Element
  handle: FileHandle
}

function IFrameLoaderBrowsable({ handle, children }: IFrameLoaderBrowsableProps) {
  const sessionData = useSession(handle)
  return children(
    AsyncResult.mapCase(
      {
        Ok: (sessionId: SessionId) =>
          PreviewData.IFrame({
            src: `${cfg.s3Proxy}/browse/${sessionId}/${handle.logicalKey}`,
            modes: [FileType.Html, FileType.Text],
            sandbox: SANDBOX_BROWSABLE,
          }),
      },
      sessionData,
    ),
  )
}

interface IFrameLoaderDirectProps {
  children: (result: $TSFixMe) => JSX.Element
  handle: LogicalKeyResolver.S3SummarizeHandle
  browsable: boolean
}

function IFrameLoaderSigned({ handle, browsable, children }: IFrameLoaderDirectProps) {
  const sign = AWS.Signer.useS3Signer()
  const src = React.useMemo(
    () => sign(handle, { ResponseContentType: 'text/html' }),
    [handle, sign],
  )
  // TODO: issue a head request to ensure existence and get storage class
  return children(
    AsyncResult.Ok(
      PreviewData.IFrame({
        src,
        modes: [FileType.Html, FileType.Text],
        sandbox: browsable ? SANDBOX_BROWSABLE : SANDBOX_RESTRICTED,
      }),
    ),
  )
}

const HTML_RETYPE_MAX_SIZE = 3 * 1024 * 1024

function isHtmlContentType(contentType: string | null) {
  return contentType?.split(';', 1)[0].trim().toLowerCase() === 'text/html'
}

function isKnownSizeTooLarge(size: number | undefined) {
  return (
    size !== undefined &&
    Number.isFinite(size) &&
    size >= 0 &&
    size > HTML_RETYPE_MAX_SIZE
  )
}

function isContentLengthTooLarge(contentLength: string | null) {
  if (contentLength === null) return false
  const normalized = contentLength.trim()
  if (!/^\d+$/.test(normalized)) return false
  const size = Number(normalized)
  return !Number.isSafeInteger(size) || size > HTML_RETYPE_MAX_SIZE
}

function escapeHtmlAttribute(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function findTagEnd(source: string, start: number, trackDoctypeSubset = false) {
  let quote: '"' | "'" | null = null
  let subsetDepth = 0

  for (let index = start; index < source.length; index += 1) {
    const character = source[index]
    if (quote) {
      if (character === quote) quote = null
      continue
    }
    if (character === '"' || character === "'") {
      quote = character
    } else if (trackDoctypeSubset && character === '[') {
      subsetDepth += 1
    } else if (trackDoctypeSubset && character === ']' && subsetDepth > 0) {
      subsetDepth -= 1
    } else if (character === '>' && subsetDepth === 0) {
      return index + 1
    }
  }

  return source.length
}

function findBaseInsertionIndex(source: string) {
  const normalizedSource = source.toLowerCase()
  let fallback = 0
  let index = 0

  while (index < source.length) {
    const tagStart = source.indexOf('<', index)
    if (tagStart < 0) break

    if (source.startsWith('<!--', tagStart)) {
      const commentEnd = source.indexOf('-->', tagStart + 4)
      index = commentEnd < 0 ? source.length : commentEnd + 3
      continue
    }

    let cursor = tagStart + 1
    if (source[cursor] === '!') {
      cursor += 1
      while (/\s/.test(source[cursor] ?? '')) cursor += 1
      const nameStart = cursor
      while (/[A-Za-z]/.test(source[cursor] ?? '')) cursor += 1
      const declaration = source.slice(nameStart, cursor).toLowerCase()
      const tagEnd = findTagEnd(source, cursor, declaration === 'doctype')
      if (declaration === 'doctype') fallback = tagEnd
      index = tagEnd
      continue
    }
    if (source[cursor] === '?' || source[cursor] === '/') {
      index = findTagEnd(source, cursor + 1)
      continue
    }

    while (/\s/.test(source[cursor] ?? '')) cursor += 1
    const nameStart = cursor
    while (/[A-Za-z0-9:-]/.test(source[cursor] ?? '')) cursor += 1
    if (cursor === nameStart) {
      index = tagStart + 1
      continue
    }

    const name = source.slice(nameStart, cursor).toLowerCase()
    const tagEnd = findTagEnd(source, cursor)
    if (name === 'head') return tagEnd
    if (name === 'html') fallback = tagEnd
    if (name === 'body') return fallback || tagStart

    if (['script', 'style', 'textarea', 'title'].includes(name)) {
      const closingTag = normalizedSource.indexOf(`</${name}`, tagEnd)
      index = closingTag < 0 ? source.length : findTagEnd(source, closingTag + 2)
    } else {
      index = tagEnd
    }
  }

  return fallback
}

function makeAbsoluteUrl(value: string) {
  try {
    new URL(value)
    return value
  } catch {
    return new URL(value, window.location.href).href
  }
}

function addBaseHref(source: string, documentUrl: string) {
  const absoluteDocumentUrl = makeAbsoluteUrl(documentUrl)
  const parsed = new DOMParser().parseFromString(source, 'text/html')
  const existingBase = parsed.head.querySelector('base[href]')?.getAttribute('href')
  let baseHref = absoluteDocumentUrl
  if (existingBase !== null && existingBase !== undefined) {
    try {
      baseHref = new URL(existingBase, absoluteDocumentUrl).href
    } catch {
      // An invalid existing base has no effect in the original document.
    }
  }

  const base = '<base href="' + escapeHtmlAttribute(baseHref) + '">'
  const insertionIndex = findBaseInsertionIndex(source)
  return source.slice(0, insertionIndex) + base + source.slice(insertionIndex)
}

type BodyChunk = Uint8Array<ArrayBuffer>
type BodyReader = ReadableStreamDefaultReader<BodyChunk>

async function readBoundedBody(
  response: Response,
  handle: LogicalKeyResolver.S3SummarizeHandle,
  signal: AbortSignal,
  setReader: (reader: BodyReader | null) => void,
) {
  const reader = response.body?.getReader()
  if (!reader) return ''

  setReader(reader)
  const decoder = new TextDecoder()
  const chunks: string[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (signal.aborted) {
        await reader.cancel().catch(() => undefined)
        return null
      }
      if (done) break
      if (value.byteLength > HTML_RETYPE_MAX_SIZE - size) {
        await reader.cancel().catch(() => undefined)
        throw PreviewError.TooLarge({ handle })
      }
      size += value.byteLength
      chunks.push(decoder.decode(value, { stream: true }))
    }
  } finally {
    setReader(null)
    reader.releaseLock()
  }

  chunks.push(decoder.decode())
  return chunks.join('')
}

function IFrameLoaderUnsigned({ handle, browsable, children }: IFrameLoaderDirectProps) {
  const sign = AWS.Signer.useS3Signer()
  const src = React.useMemo(() => sign(handle), [handle, sign])
  const [result, setResult] = React.useState(AsyncResult.Pending())
  const [key, setKey] = React.useState(0)
  const retry = React.useCallback(() => setKey(R.inc), [])

  React.useEffect(() => {
    const controller = new AbortController()
    let disposed = false
    let objectUrl: string | null = null
    let bodyReader: BodyReader | null = null

    const directResult = () =>
      AsyncResult.Ok(
        PreviewData.IFrame({
          src,
          modes: [FileType.Html, FileType.Text],
          sandbox: browsable ? SANDBOX_BROWSABLE : SANDBOX_RESTRICTED,
        }),
      )

    const handleError = (e: unknown) => {
      if (disposed || controller.signal.aborted) return
      if (PreviewError.is(e)) {
        setResult(AsyncResult.Err(e))
        return
      }
      const error = e instanceof Error ? e : new Error(String(e))
      log.error(error)
      Sentry.captureException(error)
      setResult(AsyncResult.Err(mapPreviewError(retry, error)))
    }

    const load = async () => {
      let response: Response
      try {
        response = await fetch(src, { signal: controller.signal })
      } catch (e) {
        if (disposed || controller.signal.aborted) return
        // A CORS failure does not mean the browser cannot navigate the public URL.
        if (e instanceof TypeError) {
          setResult(directResult())
          return
        }
        throw e
      }

      if (disposed) return
      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined)
        if (disposed) return
        if (response.status === 401 || response.status === 403) {
          throw PreviewError.Forbidden({ handle })
        }
        if (response.status === 404) {
          throw PreviewError.DoesNotExist({ handle })
        }
        const status = `${response.status}${response.statusText ? ` ${response.statusText}` : ''}`
        throw new Error(`Could not load HTML preview: ${status}`)
      }

      if (isHtmlContentType(response.headers.get('Content-Type'))) {
        controller.abort()
        setResult(directResult())
        return
      }

      if (
        isKnownSizeTooLarge(handle.size) ||
        isContentLengthTooLarge(response.headers.get('Content-Length'))
      ) {
        await response.body?.cancel().catch(() => undefined)
        if (disposed) return
        throw PreviewError.TooLarge({ handle })
      }

      const source = await readBoundedBody(
        response,
        handle,
        controller.signal,
        (reader) => {
          bodyReader = reader
        },
      )
      if (source === null || disposed) return

      const html = new Blob([addBaseHref(source, response.url || src)], {
        type: 'text/html',
      })
      objectUrl = URL.createObjectURL(html)
      setResult(
        AsyncResult.Ok(
          PreviewData.IFrame({
            src: objectUrl,
            modes: [FileType.Html, FileType.Text],
            // Blob URLs inherit the Catalog origin, so never allow same-origin here.
            sandbox: SANDBOX_RESTRICTED,
          }),
        ),
      )
    }

    setResult(AsyncResult.Pending())
    load().catch(handleError)

    return () => {
      disposed = true
      controller.abort()
      if (bodyReader) void bodyReader.cancel().catch(() => undefined)
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [browsable, handle, key, retry, src])

  return children(result)
}

export function IFrameLoaderDirect(props: IFrameLoaderDirectProps) {
  const shouldSign = useShouldSign()
  return shouldSign(props.handle.bucket) ? (
    <IFrameLoaderSigned {...props} />
  ) : (
    <IFrameLoaderUnsigned {...props} />
  )
}

interface IFrameLoaderProps {
  children: (result: $TSFixMe) => JSX.Element
  handle: FileHandle
}

function IFrameLoader({ handle, children }: IFrameLoaderProps) {
  const bucketData = GQL.useQuery(BROWSABLE_BUCKET_QUERY, { bucket: handle.bucket })
  const inPackage = !!handle.packageHandle
  return GQL.fold(bucketData, {
    fetching: () => children(AsyncResult.Pending()),
    error: (e) => children(AsyncResult.Err(e)),
    data: ({ bucket }) =>
      bucket?.browsable && inPackage ? (
        <IFrameLoaderBrowsable {...{ handle, children }} />
      ) : (
        <IFrameLoaderDirect {...{ handle, children }} browsable={!!bucket?.browsable} />
      ),
  })
}

// It's unsafe to render HTML in these conditions
function useHtmlAsText(handle: Model.S3.S3ObjectLocation) {
  const isInStack = useIsInStack()
  const statusReportsBucket = useStatusReportsBucket()
  return (
    cfg.mode !== 'LOCAL' &&
    !isInStack(handle.bucket) &&
    handle.bucket !== statusReportsBucket
  )
}

interface LoaderProps {
  children: (result: $TSFixMe) => JSX.Element
  handle: FileHandle
}

export const Loader = function HtmlLoader({ handle, children }: LoaderProps) {
  return useHtmlAsText(handle) ? (
    <Text.Loader {...{ handle, children }} />
  ) : (
    <IFrameLoader {...{ handle, children }} />
  )
}
