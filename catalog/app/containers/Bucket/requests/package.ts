import type { S3 } from 'aws-sdk'
import * as R from 'ramda'
import * as React from 'react'

import { JsonValue } from 'components/JsonEditor/constants'
import * as APIConnector from 'utils/APIConnector'
import * as AWS from 'utils/AWS'
import { makeSchemaDefaultsSetter, JsonSchema } from 'utils/json-schema'
import pipeThru from 'utils/pipeThru'
import * as s3paths from 'utils/s3paths'
import * as workflows from 'utils/workflows'

import * as errors from '../errors'
import * as requests from './requestsUntyped'

// "CREATE package" - creates package from scratch to new target
// "UPDATE package" - creates package from scratch (using existing manifest) to defined target
// "COPY package" - creates package from source (existing manifest) to new target
// "WRAP package" - creates package (wraps directory) from source (bucket + directory) to new target

interface FileEntry {
  is_dir: boolean
  logical_key: string
  path: string
}

interface FileUpload {
  hash: string
  logical_key: string
  physical_key: {
    bucket: string
    key: string
    version: string
  }
  size: number
}

interface RequestBodyBase {
  message: string
  meta: JsonValue
  registry: string
  workflow?: string | null
}

interface RequestBodyCreate extends RequestBodyBase {
  contents: FileUpload[]
  name: string
}

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

type RequestBody = RequestBodyCreate | RequestBodyWrap | RequestBodyCopy

const ENDPOINT_CREATE = '/packages'

const ENDPOINT_UPDATE = '/packages'

const ENDPOINT_COPY = '/packages/promote'

const ENDPOINT_WRAP = '/packages/from-folder'

type Endpoint =
  | typeof ENDPOINT_CREATE
  | typeof ENDPOINT_UPDATE
  | typeof ENDPOINT_COPY
  | typeof ENDPOINT_WRAP

// TODO: reuse it from some other place, don't remember where I saw it
interface ManifestHandleTarget {
  bucket: string
  name: string
}

interface ManifestHandleSource extends ManifestHandleTarget {
  revision: string
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

interface UpdatePackageParams extends BasePackageParams {
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

interface WrapPackageParams extends BasePackageParams {
  entries: FileEntry[]
  source: string
  target: ManifestHandleTarget
}

interface Response {
  top_hash: string
}

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

// FIXME: this is copypasted from PackageDialog -- next time we need to TSify utils/APIConnector properly
interface ApiRequest {
  <Output, Body = {}>(opts: {
    endpoint: string
    method?: 'GET' | 'PUT' | 'POST' | 'DELETE' | 'HEAD'
    body?: Body
  }): Promise<Output>
}

const uploadManifest = async (
  req: ApiRequest,
  s3: S3,
  endpoint: Endpoint,
  workflow: workflows.Workflow,
  body: RequestBody,
): Promise<Response> => {
  if (workflow.manifestSchema) {
    const manifestSchema = await objectSchema({
      s3,
      schemaUrl: workflow.manifestSchema,
    })
    const validationErrors = makeSchemaDefaultsSetter(manifestSchema)(body)
    if (validationErrors.length) throw validationErrors[0]
  }
  return req<Response, RequestBody>({
    endpoint,
    method: 'POST',
    body,
  })
}

const getMetaValue = (value: unknown, optSchema: JsonSchema) =>
  value
    ? pipeThru(value || {})(
        makeSchemaDefaultsSetter(optSchema),
        R.toPairs,
        R.filter(([k]) => !!k.trim()),
        R.fromPairs,
        R.when(R.isEmpty, () => undefined),
      )
    : undefined

const getWorkflowApiParam = R.cond([
  [R.equals(workflows.notAvailable), R.always(undefined)],
  [R.equals(workflows.notSelected), R.always(null)],
  [R.T, R.identity],
]) as (
  slug: typeof workflows.notAvailable | typeof workflows.notSelected | string,
) => string | null | undefined

const createPackage = (
  req: ApiRequest,
  s3: S3,
  { contents, message, meta, target, workflow }: CreatePackageParams,
  schema: JsonSchema, // TODO: should be already inside workflow
) =>
  uploadManifest(req, s3, ENDPOINT_CREATE, workflow, {
    name: target.name,
    registry: `s3://${target.bucket}`,
    message,
    contents,
    meta: getMetaValue(meta, schema),
    workflow: getWorkflowApiParam(workflow.slug),
  })

export function useCreatePackage() {
  const req: ApiRequest = APIConnector.use()
  const s3 = AWS.S3.use()
  return React.useCallback(
    (params: CreatePackageParams, schema: JsonSchema) =>
      createPackage(req, s3, params, schema),
    [req, s3],
  )
}

const updatePackage = (
  req: ApiRequest,
  s3: S3,
  { contents, message, meta, target, workflow }: UpdatePackageParams,
  schema: JsonSchema, // TODO: should be already inside workflow
) =>
  uploadManifest(req, s3, ENDPOINT_UPDATE, workflow, {
    name: target.name,
    registry: `s3://${target.bucket}`,
    message,
    contents,
    meta: getMetaValue(meta, schema),
    workflow: getWorkflowApiParam(workflow.slug),
  })

export function useUpdatePackage() {
  const req: ApiRequest = APIConnector.use()
  const s3 = AWS.S3.use()
  return React.useCallback(
    (params: UpdatePackageParams, schema: JsonSchema) =>
      updatePackage(req, s3, params, schema),
    [req, s3],
  )
}

const copyPackage = (
  req: ApiRequest,
  s3: S3,
  { message, meta, source, target, workflow }: CopyPackageParams,
  schema: JsonSchema, // TODO: should be already inside workflow
) =>
  uploadManifest(req, s3, ENDPOINT_COPY, workflow, {
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
  })

export function useCopyPackage() {
  const req: ApiRequest = APIConnector.use()
  const s3 = AWS.S3.use()
  return React.useCallback(
    (params: CopyPackageParams, schema: JsonSchema) =>
      copyPackage(req, s3, params, schema),
    [req, s3],
  )
}

const wrapPackage = (
  req: ApiRequest,
  s3: S3,
  { message, meta, source, target, workflow, entries }: WrapPackageParams,
  schema: JsonSchema, // TODO: should be already inside workflow
) =>
  uploadManifest(req, s3, ENDPOINT_WRAP, workflow, {
    dst: {
      registry: `s3://${target.bucket}`,
      name: target.name,
    },
    entries,
    message,
    meta: getMetaValue(meta, schema),
    registry: `s3://${source}`,
    workflow: getWorkflowApiParam(workflow.slug),
  })

export function useWrapPackage() {
  const req: ApiRequest = APIConnector.use()
  const s3 = AWS.S3.use()
  return React.useCallback(
    (params: WrapPackageParams, schema: JsonSchema) =>
      wrapPackage(req, s3, params, schema),
    [req, s3],
  )
}
