import type { S3 } from 'aws-sdk'
import * as R from 'ramda'
import * as React from 'react'

import { JsonValue } from 'components/JsonEditor/constants'
import * as APIConnector from 'utils/APIConnector'
import * as AWS from 'utils/AWS'
import * as Config from 'utils/Config'
import { makeSchemaDefaultsSetter, JsonSchema } from 'utils/json-schema'
import mkSearch from 'utils/mkSearch'
import pipeThru from 'utils/pipeThru'
import * as s3paths from 'utils/s3paths'
import * as workflows from 'utils/workflows'

import * as errors from '../errors'
import * as requests from './requestsUntyped'

export const objectSchema = async ({ s3, schemaUrl }: { s3: S3; schemaUrl: string }) => {
  if (!schemaUrl) return null

  const { bucket, key, version } = s3paths.parseS3Url(schemaUrl)

  try {
    const response = await requests.fetchFile({ s3, bucket, path: key, version })
    return JSON.parse(response.Body.toString('utf-8'))
  } catch (e) {
    if (e instanceof errors.FileNotFound || e instanceof errors.VersionNotFound) throw e

    // eslint-disable-next-line no-console
    console.log('Unable to fetch')
    // eslint-disable-next-line no-console
    console.error(e)
  }

  return null
}

interface AWSCredentials {
  accessKeyId: string
  secretAccessKey: string
  sessionToken: string
  getPromise: () => Promise<void>
}

// "CREATE package" - creates package from scratch to new target
// "COPY package" - creates package from source (existing manifest) to new target
// "WRAP package" - creates package (wraps directory) from source (bucket + directory) to new target

interface FileEntry {
  is_dir: boolean
  logical_key: string
  path: string
}

interface FileUpload {
  logical_key: string
  physical_key: string
  hash?: string
  size?: number
  meta?: {}
}

interface RequestBodyBase {
  message: string
  meta: JsonValue
  registry: string
  workflow?: string | null
}

type RequestBodyCreate = string

interface RequestBodyCopy extends RequestBodyBase {
  name: string
  parent: {
    top_hash: string
    registry: string
    name: string
  }
}

interface RequestBodyWrap extends RequestBodyBase {
  dst: {
    registry: string
    name: string
  }
  entries: FileEntry[]
}

interface RequestBodyDelete {
  top_hash: string
  registry: string
  name: string
}

const ENDPOINT_CREATE = '/packages'

const ENDPOINT_COPY = '/packages/promote'

const ENDPOINT_DELETE = '/packages/delete-revision'

const ENDPOINT_WRAP = '/packages/from-folder'

const CREATE_PACKAGE_PAYLOAD_KEY = 'user-requests/create-package'

// TODO: reuse it from some other place, don't remember where I saw it
interface ManifestHandleTarget {
  bucket: string
  name: string
}

// TODO: use app/utils/packageHandle#PackageHandle
interface ManifestHandleSource extends ManifestHandleTarget {
  revision: string
}

interface PackageHandleSource extends ManifestHandleTarget {
  hash: string
}

interface BasePackageParams {
  message: string
  meta: JsonValue
  workflow: workflows.Workflow
}

interface CreatePackageParams extends BasePackageParams {
  contents: FileUpload[]
  target: {
    bucket: string
    name: string
  }
}

interface CopyPackageParams extends BasePackageParams {
  source: ManifestHandleSource
  target: ManifestHandleTarget
}

interface DeleteRevisionParams {
  source: PackageHandleSource
}

interface WrapPackageParams extends BasePackageParams {
  entries: FileEntry[]
  source: string
  target: ManifestHandleTarget
}

interface Response {
  top_hash: string
}

// FIXME: this is copypasted from PackageDialog -- next time we need to TSify utils/APIConnector properly
interface ApiRequest {
  <Output>(opts: {
    endpoint: string
    method?: 'GET' | 'PUT' | 'POST' | 'DELETE' | 'HEAD'
    body?: {}
  }): Promise<Output>
}

interface CredentialsQuery {
  access_key: string
  secret_key: string
  session_token: string
}

const getCredentialsQuery = (credentials: AWSCredentials): CredentialsQuery => ({
  access_key: credentials.accessKeyId,
  secret_key: credentials.secretAccessKey,
  session_token: credentials.sessionToken,
})

interface BackendRequest {
  (
    req: ApiRequest,
    endpoint: typeof ENDPOINT_CREATE,
    body: RequestBodyCreate,
    query: CredentialsQuery,
  ): Promise<Response>
  (
    req: ApiRequest,
    endpoint: typeof ENDPOINT_COPY,
    body: RequestBodyCopy,
    query: CredentialsQuery,
  ): Promise<Response>
  (
    req: ApiRequest,
    endpoint: typeof ENDPOINT_DELETE,
    body: RequestBodyDelete,
    query: CredentialsQuery,
  ): Promise<Response>
  (
    req: ApiRequest,
    endpoint: typeof ENDPOINT_WRAP,
    body: RequestBodyWrap,
    query: CredentialsQuery,
  ): Promise<Response>
}

const makeBackendRequest: BackendRequest = (
  req: ApiRequest,
  endpoint: string,
  body: {},
  query?: {},
): Promise<Response> =>
  req<Response>({
    endpoint: `${endpoint}${query ? mkSearch(query) : ''}`,
    method: 'POST',
    body,
  })

export const getMetaValue = (value: unknown, optSchema?: JsonSchema) =>
  value
    ? pipeThru(value || {})(
        makeSchemaDefaultsSetter(optSchema),
        R.toPairs,
        R.filter(([k]) => !!k.trim()),
        R.fromPairs,
        R.when(R.isEmpty, () => undefined),
      )
    : undefined

export const getWorkflowApiParam = R.cond([
  [R.equals(workflows.notAvailable), R.always(undefined)],
  [R.equals(workflows.notSelected), R.always(null)],
  [R.T, R.identity],
]) as (
  slug: typeof workflows.notAvailable | typeof workflows.notSelected | string,
) => string | null | undefined

interface CreatePackageDependencies {
  s3: S3
  credentials: AWSCredentials
  req: ApiRequest
  serviceBucket: string
}

const mkCreatePackage =
  ({ s3, credentials, req, serviceBucket }: CreatePackageDependencies) =>
  async (
    { contents, message, meta, target, workflow }: CreatePackageParams,
    schema?: JsonSchema, // TODO: should be already inside workflow
  ) => {
    await credentials.getPromise()
    const header = {
      name: target.name,
      registry: `s3://${target.bucket}`,
      message,
      meta: getMetaValue(meta, schema),
      workflow: getWorkflowApiParam(workflow.slug),
    }
    const payload = [header, ...contents].map((x) => JSON.stringify(x)).join('\n')
    const upload = s3.upload({
      Bucket: serviceBucket,
      Key: CREATE_PACKAGE_PAYLOAD_KEY,
      Body: payload,
    })
    const res = await upload.promise()

    return makeBackendRequest(
      req,
      ENDPOINT_CREATE,
      JSON.stringify((res as any).VersionId as string),
      getCredentialsQuery(credentials),
    )
  }

export function useCreatePackage() {
  const req: ApiRequest = APIConnector.use()
  const { serviceBucket } = Config.use()
  const credentials = AWS.Credentials.use()
  const s3 = AWS.S3.use()
  return React.useMemo(
    () => mkCreatePackage({ s3, credentials, req, serviceBucket }),
    [s3, credentials, req, serviceBucket],
  )
}

const copyPackage = async (
  req: ApiRequest,
  credentials: AWSCredentials,
  { message, meta, source, target, workflow }: CopyPackageParams,
  schema?: JsonSchema, // TODO: should be already inside workflow
) => {
  // refresh credentials and load if they are not loaded
  await credentials.getPromise()

  const body = {
    message,
    meta: getMetaValue(meta, schema),
    name: target.name,
    parent: {
      top_hash: source.revision,
      registry: `s3://${source.bucket}`,
      name: source.name,
    },
    registry: `s3://${target.bucket}`,
    workflow: getWorkflowApiParam(workflow.slug),
  }

  return makeBackendRequest(req, ENDPOINT_COPY, body, getCredentialsQuery(credentials))
}

export function useCopyPackage() {
  const credentials = AWS.Credentials.use()
  const req: ApiRequest = APIConnector.use()
  return React.useCallback(
    (params: CopyPackageParams, schema?: JsonSchema) =>
      copyPackage(req, credentials, params, schema),
    [credentials, req],
  )
}

const deleteRevision = async (
  req: ApiRequest,
  credentials: AWSCredentials,
  { source }: DeleteRevisionParams,
) => {
  // refresh credentials and load if they are not loaded
  await credentials.getPromise()

  return makeBackendRequest(
    req,
    ENDPOINT_DELETE,
    {
      name: source.name,
      registry: `s3://${source.bucket}`,
      top_hash: source.hash,
    },
    getCredentialsQuery(credentials),
  )
}

export function useDeleteRevision() {
  const credentials = AWS.Credentials.use()
  const req: ApiRequest = APIConnector.use()
  return React.useCallback(
    (params: DeleteRevisionParams) => deleteRevision(req, credentials, params),
    [credentials, req],
  )
}

const wrapPackage = async (
  req: ApiRequest,
  credentials: AWSCredentials,
  { message, meta, source, target, workflow, entries }: WrapPackageParams,
  schema?: JsonSchema, // TODO: should be already inside workflow
) => {
  // refresh credentials and load if they are not loaded
  await credentials.getPromise()

  const body = {
    dst: {
      registry: `s3://${target.bucket}`,
      name: target.name,
    },
    entries,
    message,
    meta: getMetaValue(meta, schema),
    registry: `s3://${source}`,
    workflow: getWorkflowApiParam(workflow.slug),
  }

  return makeBackendRequest(req, ENDPOINT_WRAP, body, getCredentialsQuery(credentials))
}

export function useWrapPackage() {
  const credentials = AWS.Credentials.use()
  const req: ApiRequest = APIConnector.use()
  return React.useCallback(
    (params: WrapPackageParams, schema?: JsonSchema) =>
      wrapPackage(req, credentials, params, schema),
    [credentials, req],
  )
}
