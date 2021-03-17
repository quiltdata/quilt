import * as R from 'ramda'

import { makeSchemaValidator } from 'utils/json-schema'
import yaml from 'utils/yaml'
import bucketPreferencesSchema from 'schemas/bucketConfig.yml.json'
import * as bucketErrors from 'containers/Bucket/errors'

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
