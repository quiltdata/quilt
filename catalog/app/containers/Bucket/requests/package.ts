import * as R from 'ramda'
import * as React from 'react'

import { JsonValue } from 'components/JsonEditor/constants'
import * as APIConnector from 'utils/APIConnector'
import { makeSchemaDefaultsSetter, JsonSchema } from 'utils/json-schema'
import pipeThru from 'utils/pipeThru'
import * as workflows from 'utils/workflows'

// "CREATE package" - creates package from scratch to new target
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
  entries?: FileEntry[]
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

const ENDPOINT_CREATE = '/packages'

const ENDPOINT_COPY = '/packages/promote'

const ENDPOINT_WRAP = '/packages/from-folder'

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
  entries?: FileEntry[]
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

// FIXME: this is copypasted from PackageDialog -- next time we need to TSify utils/APIConnector properly
interface ApiRequest {
  <Output>(opts: {
    endpoint: string
    method?: 'GET' | 'PUT' | 'POST' | 'DELETE' | 'HEAD'
    body?: {}
  }): Promise<Output>
}

interface UploadManifest {
  (
    req: ApiRequest,
    endpoint: typeof ENDPOINT_CREATE,
    body: RequestBodyCreate,
  ): Promise<Response>
  (
    req: ApiRequest,
    endpoint: typeof ENDPOINT_COPY,
    body: RequestBodyCopy,
  ): Promise<Response>
  (
    req: ApiRequest,
    endpoint: typeof ENDPOINT_WRAP,
    body: RequestBodyWrap,
  ): Promise<Response>
}

const uploadManifest: UploadManifest = (
  req: ApiRequest,
  endpoint: string,
  body: {},
): Promise<Response> => req<Response>({ endpoint, method: 'POST', body })

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
  { contents, entries, message, meta, target, workflow }: CreatePackageParams,
  schema: JsonSchema, // TODO: should be already inside workflow
) =>
  uploadManifest(req, ENDPOINT_CREATE, {
    name: target.name,
    registry: `s3://${target.bucket}`,
    message,
    contents,
    entries,
    meta: getMetaValue(meta, schema),
    workflow: getWorkflowApiParam(workflow.slug),
  })

export function useCreatePackage() {
  const req: ApiRequest = APIConnector.use()
  return React.useCallback(
    (params: CreatePackageParams, schema: JsonSchema) =>
      createPackage(req, params, schema),
    [req],
  )
}

const copyPackage = (
  req: ApiRequest,
  { message, meta, source, target, workflow }: CopyPackageParams,
  schema: JsonSchema, // TODO: should be already inside workflow
) =>
  uploadManifest(req, ENDPOINT_COPY, {
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
  return React.useCallback(
    (params: CopyPackageParams, schema: JsonSchema) => copyPackage(req, params, schema),
    [req],
  )
}

const wrapPackage = (
  req: ApiRequest,
  { message, meta, source, target, workflow, entries }: WrapPackageParams,
  schema: JsonSchema, // TODO: should be already inside workflow
) =>
  uploadManifest(req, ENDPOINT_WRAP, {
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
  return React.useCallback(
    (params: WrapPackageParams, schema: JsonSchema) => wrapPackage(req, params, schema),
    [req],
  )
}
