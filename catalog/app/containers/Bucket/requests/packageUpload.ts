import * as R from 'ramda'
import * as React from 'react'

// TODO:
// createFromScratch: source - null, target - exists
// update           : source - manifest, target - null
// copy             : source - manifest, target - exists

// createFromDirectory : source - directory, target - exists

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

interface BasePackageParams {
  bucket: string
  message: string
  meta: JsonValue
  name: string
  workflow: workflows.Workflow
}

interface CreatePackageParams extends BasePackageParams {
  contents: FileUpload[]
}

export const createPackage = (
  req: ApiRequest,
  { name, bucket, message, contents, meta, workflow }: CreatePackageParams,
  schema: JsonSchema, // TODO: should be already inside workflow
) =>
  uploadManifest(req, ENDPOINT_BASE, {
    name,
    registry: `s3://${bucket}`,
    message,
    contents,
    meta: getMetaValue(meta, schema),
    workflow: getWorkflowApiParam(workflow.slug),
  })

export const updatePackage = createPackage

export function useCreatePackage() {
  const req: ApiRequest = APIConnector.use()
  return React.useCallback(
    (params: CreatePackageParams, schema: JsonSchema) =>
      createPackage(req, params, schema),
    [req],
  )
}

export const useUpdatePackage = useCreatePackage

// TODO: reuse it from some other place, don't remember where I saw it
interface ManifestHandle {
  bucket: string
  name: string
}

interface ManifestHandleRevisioned extends ManifestHandle {
  revision: string
}

interface CopyPackageParams extends BasePackageParams {
  parent: ManifestHandleRevisioned
}

export const copyPackage = (
  req: ApiRequest,
  { bucket, message, meta, name, parent, workflow }: CopyPackageParams,
  schema: JsonSchema, // TODO: should be already inside workflow
) =>
  uploadManifest(req, ENDPOINT_COPY, {
    message,
    meta: getMetaValue(meta, schema),
    name,
    parent: {
      top_hash: parent.revision,
      registry: `s3://${parent.bucket}`,
      name: parent.name,
    },
    registry: `s3://${bucket}`,
    workflow: getWorkflowApiParam(workflow.slug),
  })

export function useCopyPackage() {
  const req: ApiRequest = APIConnector.use()
  return React.useCallback(
    (params: CopyPackageParams, schema: JsonSchema) => copyPackage(req, params, schema),
    [req],
  )
}

interface DirectoryPackageParams extends BasePackageParams {
  dst: ManifestHandle
  entries: FileEntry[]
}

export const directoryPackage = (
  req: ApiRequest,
  { bucket, message, meta, dst, workflow, entries }: DirectoryPackageParams,
  schema: JsonSchema, // TODO: should be already inside workflow
) =>
  uploadManifest(req, ENDPOINT_DIRECTORY, {
    dst: {
      registry: `s3://${dst.bucket}`,
      name: dst.name,
    },
    entries,
    message,
    meta: getMetaValue(meta, schema),
    registry: `s3://${bucket}`,
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
