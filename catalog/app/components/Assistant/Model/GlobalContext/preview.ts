import { basename, extname } from 'path'

import type AWSSDK from 'aws-sdk'
import * as Eff from 'effect'
import { Schema as S } from 'effect'

import cfg from 'constants/config'
import { S3ObjectLocation } from 'model/S3'
import * as AWS from 'utils/AWS'
import * as Log from 'utils/Logging'
import mkSearch from 'utils/mkSearch'
import * as s3paths from 'utils/s3paths'

import * as Content from '../Content'
import * as Tool from '../Tool'

const MODULE = 'GlobalContext/preview'

type AWSEffect<T> = Eff.Effect.Effect<T, AWSSDK.AWSError>

// TODO: move this out
export class S3 extends Eff.Context.Tag('S3')<
  S3,
  {
    headObject(handle: S3ObjectLocation): AWSEffect<AWSSDK.S3.HeadObjectOutput>
    getObject(handle: S3ObjectLocation): AWSEffect<AWSSDK.S3.GetObjectOutput>
  }
>() {}

export const fromS3Client = (client: AWSSDK.S3) =>
  Eff.Layer.succeed(S3, {
    headObject: (handle) =>
      Eff.Effect.tryPromise({
        try: () =>
          client
            .headObject({
              Bucket: handle.bucket,
              Key: handle.key,
              VersionId: handle.version,
            })
            .promise(),
        catch: (e) => e as AWSSDK.AWSError,
      }),
    getObject: (handle) =>
      Eff.Effect.tryPromise({
        try: () =>
          client
            .getObject({
              Bucket: handle.bucket,
              Key: handle.key,
              VersionId: handle.version,
            })
            .promise(),
        catch: (e) => e as AWSSDK.AWSError,
      }),
  })

export interface S3SignerOptions {
  urlExpiration?: number // in seconds
  forceProxy?: boolean
}

export class S3Signer extends Eff.Context.Tag('S3Signer')<
  S3Signer,
  {
    sign(handle: S3ObjectLocation, options?: S3SignerOptions): Eff.Effect.Effect<string>
  }
>() {}

export const fromS3Signer = (
  signer: (handle: S3ObjectLocation, options?: S3SignerOptions) => string,
) =>
  Eff.Layer.succeed(S3Signer, {
    sign: (...args) => Eff.Effect.sync(() => signer(...args)),
  })

// The document file name can only contain:
// - alphanumeric characters
// - whitespace characters
// - hyphens
// - parentheses and square brackets
// The name can't contain more than one consecutive whitespace character
const normalizeDocumentName = (name: string) =>
  name
    .replace(/[^a-zA-Z0-9\s\-\(\)\[\]]/g, ' ') // Remove invalid characters
    .replace(/\s+/g, ' ') // Replace multiple whitespace characters with a single space
    .trim() // Remove leading and trailing whitespace

const THRESHOLD = 500 * 1024 // 500 KiB

const PreviewSchema = S.Struct({
  s3_uri: S.String,
}).annotations({
  description: [
    'Render an S3 object as content this model can natively interpret —',
    'thumbnail-resized images, native Document blocks for PDFs / Office docs,',
    'language-tagged text. Use when the goal is for the model to *understand*',
    'the content (summarize, describe, extract).',
    'For raw bytes, scripting, or files where the model only needs the bytes,',
    'use platform__object_read instead.',
    '',
    'Always call platform__s3_object_info first to check size and content-type',
    'before invoking this tool. Skip the preview and fall back to',
    'platform__object_read when:',
    '- ContentLength > 500 KiB and the content is a document',
    '- content-type is outside {image/*, application/pdf, application/msword,',
    '  application/vnd.openxmlformats-officedocument.*, text/*,',
    '  application/json, application/x-yaml}',
    '- the task only needs raw bytes (downloads, scripted parsing).',
    '',
    'Input is a single s3:// URI; versionId may be passed as a query parameter:',
    'e.g. s3://bucket/path/key?versionId=abc.',
  ].join(' '),
})

const parseS3Uri = (s3_uri: string): Eff.Effect.Effect<S3ObjectLocation, Error> =>
  Eff.Effect.try({
    try: () => {
      if (!s3paths.isS3Url(s3_uri)) {
        throw new Error(`Not an s3:// URI: ${s3_uri}`)
      }
      const handle = s3paths.parseS3Url(s3_uri)
      if (!handle.key) {
        throw new Error(`Invalid s3:// URI (missing key): ${s3_uri}`)
      }
      return handle
    },
    catch: (e) => (e instanceof Error ? e : new Error(String(e))),
  })

// return format:
// - metadata block (text or json)
// - content block (json | text | image | document)
export function useCatalogPreview() {
  const s3Client = AWS.S3.use()
  const s3Signer = AWS.Signer.useS3Signer()

  return Tool.useMakeTool(
    PreviewSchema,
    ({ s3_uri }) =>
      parseS3Uri(s3_uri).pipe(
        Eff.Effect.matchEffect({
          onFailure: (e) =>
            Eff.Effect.succeed(
              Eff.Option.some(
                Tool.fail(
                  Content.text(
                    'Could not parse s3 URI:\n',
                    `<s3-uri-error>\n${e.message}\n</s3-uri-error>`,
                  ),
                ),
              ),
            ),
          onSuccess: (handle) =>
            getObject(handle).pipe(
              Eff.Effect.map(Eff.Option.some),
              Eff.Effect.provide(fromS3Client(s3Client)),
              Eff.Effect.provide(fromS3Signer(s3Signer)),
            ),
        }),
      ),
    [s3Client, s3Signer],
  )
}

const getObject = (handle: S3ObjectLocation) =>
  Log.scoped({
    name: `${MODULE}.getObject`,
    enter: [Log.br, 'handle:', handle],
  })(
    Eff.Effect.gen(function* () {
      const s3 = yield* S3
      const headE = yield* Eff.Effect.either(s3.headObject(handle))
      if (Eff.Either.isLeft(headE)) {
        return Tool.fail(
          Content.text(
            'Error while getting S3 object metadata:\n',
            `<object-metadata-error>\n${headE.left}\n</object-metadata-error>`,
          ),
        )
      }
      const head = headE.right

      const metaBlock = Content.text(
        'Got S3 object metadata:\n',
        `<object-metadata>\n${JSON.stringify(head, null, 2)}\n</object-metadata>`,
      )

      const size = head.ContentLength
      if (size == null) {
        return Tool.succeed(
          metaBlock,
          Content.text('Could not determine object content length'),
        )
      }

      const fileType = detectFileType(handle.key)

      const contentBlocks: Content.ToolResultContentBlock[] = yield* FileType.$match(
        fileType,
        {
          Image: () =>
            getImagePreview(handle).pipe(
              Eff.Effect.map(({ format, bytes }) =>
                Content.ToolResultContentBlock.Image({
                  format,
                  source: bytes as $TSFixMe,
                }),
              ),
              Eff.Effect.catchAll((e) =>
                Eff.Effect.succeed(
                  Content.text(
                    'Error while getting image preview:\n',
                    `<object-contents-error>\n${e}\n</object-contents-error>`,
                  ),
                ),
              ),
              Eff.Effect.map(Eff.Array.of),
            ),
          Document: ({ format }) =>
            size > THRESHOLD
              ? Eff.Effect.succeed([
                  Content.text('Object is too large to include its contents directly'),
                ])
              : getDocumentPreview(handle, format),
          Unidentified: () =>
            Eff.Effect.succeed([
              Content.text(
                'Error while getting object contents:\n',
                `<object-contents-error>\nUnidentified file type\n</object-contents-error>`,
              ),
            ]),
        },
      )

      return Tool.succeed(metaBlock, ...contentBlocks)
    }),
  )

const SUPPORTED_IMAGE_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.bmp',
  '.tiff',
  '.tif',
  '.czi',
]

// =< 1568px as per anthropic/claude guidelines
const PREVIEW_SIZE = `w1024h768`

interface ImagePreview {
  format: Content.ImageFormat
  bytes: ArrayBuffer
}

const getImagePreview = (handle: S3ObjectLocation) =>
  Eff.Effect.gen(function* () {
    const signer = yield* S3Signer
    const url = yield* signer.sign(handle)
    const src = `${cfg.apiGatewayEndpoint}/thumbnail${mkSearch({
      url,
      size: PREVIEW_SIZE,
    })}`
    const r = yield* Eff.Effect.tryPromise(() => fetch(src))
    if (r.status !== 200) {
      const text = yield* Eff.Effect.promise(() => r.text())
      return yield* new Eff.Cause.UnknownException(text, text)
    }
    const bytes = yield* Eff.Effect.promise(() =>
      r.blob().then((blob) => blob.arrayBuffer()),
    )
    const format = yield* Eff.Effect.try(() => {
      const info = r.headers.get('X-Quilt-Info')
      if (!info) throw new Error('X-Quilt-Info header not found')
      const parsed = JSON.parse(info)
      switch (parsed.thumbnail_format) {
        case 'JPG':
          return 'jpeg'
        case 'PNG':
          return 'png'
        case 'GIF':
          return 'gif'
        default:
          throw new Error(`Unknown thumbnail format: ${parsed.thumbnail_format}`)
      }
    })
    return { format, bytes } as ImagePreview
  })

const getDocumentPreview = (handle: S3ObjectLocation, format: Content.DocumentFormat) =>
  S3.pipe(
    Eff.Effect.andThen((s3) => s3.getObject(handle)),
    Eff.Effect.map((body) => {
      const blob = body.Body
      if (!blob) {
        return Content.text('Could not get object contents')
      }
      return Content.ToolResultContentBlock.Document({
        name: normalizeDocumentName(
          `${handle.bucket} ${handle.key} ${handle.version || ''}`,
        ),
        format,
        source: blob as $TSFixMe,
      })
    }),
    Eff.Effect.catchAll((e) =>
      Eff.Effect.succeed(
        Content.text(
          'Error while getting object contents:\n',
          `<object-contents-error>\n${e}\n</object-contents-error>`,
        ),
      ),
    ),
    Eff.Effect.map(Eff.Array.of),
  )

const LANGS = {
  accesslog: /\.log$/,
  bash: /\.(ba|z)?sh$/,
  clojure: /\.clj$/,
  coffeescript: /\.(coffee|cson|iced)$/,
  coq: /\.v$/,
  c: /\.(c|h)$/,
  cpp: /\.((c(c|\+\+|pp|xx)?)|(h(\+\+|pp|xx)?))$/,
  csharp: /\.cs$/,
  css: /\.css$/,
  diff: /\.(diff|patch)$/,
  dockerfile: /^dockerfile$/,
  erlang: /\.erl$/,
  go: /\.go$/,
  haskell: /\.hs$/,
  ini: /\.(ini|toml)$/,
  java: /\.(java|jsp)$/,
  javascript: /\.m?jsx?$/,
  json: /\.jsonl?$/,
  lisp: /\.lisp$/,
  makefile: /^(gnu)?makefile$/,
  matlab: /\.m$/,
  ocaml: /\.mli?$/,
  perl: /\.pl$/,
  php: /\.php[3-7]?$/,
  plaintext:
    /((^license)|(^readme)|(^\.\w*(ignore|rc|config))|(\.txt)|(\.(c|t)sv)|(\.(big)?bed)|(\.cef)|(\.fa)|(\.fsa)|(\.fasta)|(\.(san)?fastq)|(\.fq)|(\.sam)|(\.gff(2|3)?)|(\.gtf)|(\.index)|(\.readme)|(changelog)|(.*notes)|(\.pdbqt)|(\.results)(\.(inn|out)ie))$/,
  python: /\.(py|gyp)$/,
  r: /\.r$/,
  ruby: /\.rb$/,
  rust: /\.rs$/,
  scala: /\.scala$/,
  scheme: /\.s(s|ls|cm)$/,
  sql: /\.sql$/,
  typescript: /\.tsx?$/,
  xml: /\.(xml|x?html|rss|atom|xjb|xsd|xsl|plist)$/,
  yaml: /((\.ya?ml$)|(^snakefile))/,
}

const langPairs = Object.entries(LANGS)

function isText(name: string) {
  const normalized = basename(name).toLowerCase()
  return langPairs.some(([, re]) => re.test(normalized))
}

type FileType = Eff.Data.TaggedEnum<{
  Image: {}
  Document: {
    readonly format: Content.DocumentFormat
  }
  Unidentified: {}
}>

// eslint-disable-next-line @typescript-eslint/no-redeclare
const FileType = Eff.Data.taggedEnum<FileType>()

const detectFileType = (key: string): FileType => {
  const ext = extname(key).toLowerCase()

  if (SUPPORTED_IMAGE_EXTENSIONS.includes(ext)) {
    return FileType.Image()
  }
  if (['.htm', '.html'].includes(ext)) {
    return FileType.Document({ format: 'html' })
  }
  if (['.md', '.rmd'].includes(ext)) {
    return FileType.Document({ format: 'md' })
  }
  if (ext === '.pdf') {
    return FileType.Document({ format: 'pdf' })
  }
  if (ext === '.csv') {
    return FileType.Document({ format: 'csv' })
  }
  if (ext === '.docx') {
    return FileType.Document({ format: 'docx' })
  }
  if (ext === '.doc') {
    return FileType.Document({ format: 'doc' })
  }
  if (ext === '.xls') {
    return FileType.Document({ format: 'xls' })
  }
  if (ext === '.xlsx') {
    return FileType.Document({ format: 'xlsx' })
  }
  if (isText(key)) {
    return FileType.Document({ format: 'txt' })
  }
  if (ext === '.ipynb') {
    return FileType.Document({ format: 'txt' })
  }
  return FileType.Unidentified()
}
