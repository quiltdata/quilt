import * as R from 'ramda'

import * as AWS from 'utils/AWS'
import { useData } from 'utils/Data'
import { makeSchemaValidator } from 'utils/json-schema'
import yaml from 'utils/yaml'
import bucketPreferencesSchema from 'schemas/bucketConfig.yml.json'
import * as bucketErrors from 'containers/Bucket/errors'
import * as requests from 'containers/Bucket/requests'

export type ActionPreferences = Record<'copy' | 'create' | 'revise', boolean>

export type NavPreferences = Record<
  'overview' | 'files' | 'packages' | 'queries',
  boolean
>

type UiPreferences = {
  actions: ActionPreferences
  nav: NavPreferences
}

interface BucketPreferencesYaml {
  ui?: Partial<UiPreferences>
}

export interface BucketPreferences {
  ui: UiPreferences
}

export const defaultPreferences: BucketPreferences = {
  ui: {
    actions: {
      copy: true,
      create: true,
      revise: true,
    },
    nav: {
      files: true,
      overview: true,
      packages: true,
      queries: true,
    },
  },
}

const bucketPreferencesValidator = makeSchemaValidator(bucketPreferencesSchema)

function validate(data: unknown): asserts data is BucketPreferencesYaml {
  const errors = bucketPreferencesValidator(data)
  if (errors.length) throw new bucketErrors.BucketPreferencesInvalid({ errors })
}

export function parse(bucketPreferencesYaml: string): BucketPreferences {
  const data = yaml(bucketPreferencesYaml)
  if (!data) return defaultPreferences

  validate(data)

  return {
    ui: {
      actions: R.mergeRight(defaultPreferences.ui.actions, data?.ui?.actions || {}),
      nav: R.mergeRight(defaultPreferences.ui.nav, data?.ui?.nav || {}),
    },
  }
}

const BUCKET_PREFERENCES_PATH = '.quilt/catalog/config.yml'

export const fetchBucketPreferences = async ({
  s3,
  bucket,
}: {
  s3: any
  bucket: string
}) => {
  try {
    const response = await requests.fetchFile({
      s3,
      bucket,
      path: BUCKET_PREFERENCES_PATH,
    })
    return parse(response.Body.toString('utf-8'))
  } catch (e) {
    if (
      e instanceof bucketErrors.FileNotFound ||
      e instanceof bucketErrors.VersionNotFound
    )
      return defaultPreferences

    // eslint-disable-next-line no-console
    console.log('Unable to fetch')
    // eslint-disable-next-line no-console
    console.error(e)
    throw e
  }
}

export function useBucketPreferences(bucket: string): BucketPreferences | null {
  const s3 = AWS.S3.use()
  const data = useData(fetchBucketPreferences, { s3, bucket })

  return data.case({
    Ok: R.identity,
    Err: () => defaultPreferences,
    _: () => null,
  })
}
