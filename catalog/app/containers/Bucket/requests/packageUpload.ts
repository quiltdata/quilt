import * as R from 'ramda'
import * as React from 'react'

import { JsonValue } from 'components/JsonEditor/constants'
import * as APIConnector from 'utils/APIConnector'
import { makeSchemaDefaultsSetter, JsonSchema } from 'utils/json-schema/json-schema'
import pipeThru from 'utils/pipeThru'
import * as workflows from 'utils/workflows'

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

interface ManifestBodyBase {
  message: string
  meta: JsonValue
  registry: string
  workflow?: string | null
}

interface ManifestBodyCreate extends ManifestBodyBase {
  contents: FileUpload[]
  name: string
}

interface ManifestBodyCopy extends ManifestBodyBase {
  name: string
  parent: {
    top_hash: string
    registry: string
    name: string
  }
}

interface ManifestBodyDirectory extends ManifestBodyBase {
  dst: {
    registry: string
    name: string
  }
  entries: FileEntry[]
}

type ManifestBody = ManifestBodyCreate | ManifestBodyDirectory | ManifestBodyCopy

const ENDPOINT_BASE = '/packages'

const ENDPOINT_DIRECTORY = '/packages/from-folder'

const ENDPOINT_COPY = '/packages/promote'

type Endpoint = typeof ENDPOINT_BASE | typeof ENDPOINT_DIRECTORY | typeof ENDPOINT_COPY

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
  source: {
    bucket: string
    name: string
  }
}

// TODO: reuse it from some other place, don't remember where I saw it
interface ManifestHandleTarget {
  bucket: string
  name: string
}

interface ManifestHandleSource extends ManifestHandleTarget {
  revision: string
}

interface CopyPackageParams extends BasePackageParams {
  source: ManifestHandleSource
  target: ManifestHandleTarget
}

interface DirectoryPackageParams extends BasePackageParams {
  entries: FileEntry[]
  source: string
  target: ManifestHandleTarget
}

interface Response {
  top_hash: string
}

// FIXME: this is copypasted from PackageDialog -- next time we need to TSify utils/APIConnector properly
interface ApiRequest {
  <O>(opts: {
    endpoint: string
    method?: 'GET' | 'PUT' | 'POST' | 'DELETE' | 'HEAD'
    body?: {}
  }): Promise<O>
}

const uploadManifest = (
  req: ApiRequest,
  endpoint: Endpoint,
  body: ManifestBody,
): Promise<Response> =>
  req({
    endpoint,
    method: 'POST',
    body,
  })

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

export const createPackage = (
  req: ApiRequest,
  { contents, message, meta, target, workflow }: CreatePackageParams,
  schema: JsonSchema, // TODO: should be already inside workflow
) =>
  uploadManifest(req, ENDPOINT_BASE, {
    name: target.name,
    registry: `s3://${target.bucket}`,
    message,
    contents,
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

export const updatePackage = (
  req: ApiRequest,
  { contents, message, meta, source, workflow }: UpdatePackageParams,
  schema: JsonSchema, // TODO: should be already inside workflow
) =>
  uploadManifest(req, ENDPOINT_BASE, {
    name: source.name,
    registry: `s3://${source.bucket}`,
    message,
    contents,
    meta: getMetaValue(meta, schema),
    workflow: getWorkflowApiParam(workflow.slug),
  })

export function useUpdatePackage() {
  const req: ApiRequest = APIConnector.use()
  return React.useCallback(
    (params: UpdatePackageParams, schema: JsonSchema) =>
      updatePackage(req, params, schema),
    [req],
  )
}

export const copyPackage = (
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

export const directoryPackage = (
  req: ApiRequest,
  { message, meta, source, target, workflow, entries }: DirectoryPackageParams,
  schema: JsonSchema, // TODO: should be already inside workflow
) =>
  uploadManifest(req, ENDPOINT_DIRECTORY, {
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

export function useDirectoryPackage() {
  const req: ApiRequest = APIConnector.use()
  return React.useCallback(
    (params: DirectoryPackageParams, schema: JsonSchema) =>
      directoryPackage(req, params, schema),
    [req],
  )
}
