import * as R from 'ramda'

import { JsonValue } from 'components/JsonEditor/constants'
import { makeSchemaDefaultsSetter, JsonSchema } from 'utils/json-schema/json-schema'
import pipeThru from 'utils/pipeThru'
import * as workflows from 'utils/workflows'

interface ManifestBodyBase {}

interface ManifestBodyDirectory {}

interface ManifestBodyCopy {}

type ManifestBody = ManifestBodyBase & ManifestBodyDirectory & ManifestBodyCopy

const ENDPOINT_BASE = '/packages'

const ENDPOINT_DIRECTORY = '/packages/from-folder'

const ENDPOINT_COPY = '/packages/promote'

type Endpoint = typeof ENDPOINT_BASE | typeof ENDPOINT_DIRECTORY | typeof ENDPOINT_COPY

interface Response {
  top_hash: string
}

type Req = (payload: $TSFixMe) => Promise<Response>

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

// TODO: add sources and targets
//       or not
interface BasePackageParams {
  bucket: string
  message: string
  meta: JsonValue
  name: string
  workflow: workflows.Workflow
}

interface CreatePackageParams extends BasePackageParams {
  contents: {
    logical_key: string
    physical_key: {
      bucket: string
      key: string
      version: string
    }
    size: number
    hash: string
  }[]
}

export function createPackage(
  req: Req,
  { name, bucket, message, contents, meta, workflow }: CreatePackageParams,
  schema: JsonSchema, // TODO: should be already inside workflow
): Promise<Response> {
  return req({
    endpoint: '/packages',
    method: 'POST',
    body: {
      name,
      registry: `s3://${bucket}`,
      message,
      contents,
      meta: getMetaValue(meta, schema),
      workflow: getWorkflowApiParam(workflow.slug),
    },
  })
}

export const updatePackage = createPackage

// TODO: reuse it from some other place, don't remember where I saw it
type ManifestHandle = {
  bucket: string
  name: string
  revision?: string
}

interface CopyPackageParams extends BasePackageParams {
  parent: ManifestHandle
}

export function copyPackage(
  req: Req,
  { bucket, message, meta, name, parent, workflow }: CopyPackageParams,
  schema: JsonSchema,
) {
  return req({
    endpoint: '/packages/promote',
    method: 'POST',
    body: {
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
    },
  })
}

interface DirectoryPackageParams extends BasePackageParams {
  dst: ManifestHandle
  entries: {
    is_dir: boolean
    logical_key: string
    path: string
  }[]
}

export function directoryPackage(
  req: Req,
  { bucket, message, meta, dst, workflow, entries }: DirectoryPackageParams,
  schema: JsonSchema,
) {
  return req({
    endpoint: '/packages/from-folder',
    method: 'POST',
    body: {
      dst: {
        registry: `s3://${dst.bucket}`,
        name: dst.name,
      },
      entries,
      message,
      meta: getMetaValue(meta, schema),
      registry: `s3://${bucket}`,
      workflow: getWorkflowApiParam(workflow.slug),
    },
  })
}

// export function useDirectoryPackage() {
//   const req: Req = APIConnector.use()
//   return React.useCallback((params, schema) => directoryPackage(req, params, schema))
// }

export function uploadManifest(
  req: Req,
  endpoint: Endpoint,
  body: ManifestBody,
): Promise<Response> {
  return req({
    endpoint,
    method: 'POST',
    body,
  })
}
