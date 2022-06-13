import type { S3 } from 'aws-sdk'
import * as R from 'ramda'

import { makeSchemaDefaultsSetter, JsonSchema } from 'utils/json-schema'
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
