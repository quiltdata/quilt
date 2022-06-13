import semver from 'semver'

import * as R from 'ramda'

import workflowsConfigSchema from 'schemas/workflows-config-1.1.0.json'
import workflowsCatalogConfigSchema from 'schemas/workflows-config_catalog-1.0.0.json'

import { makeSchemaValidator } from 'utils/json-schema'
import type * as packageHandleUtils from 'utils/packageHandle'
import * as s3paths from 'utils/s3paths'
import yaml from 'utils/yaml'
import * as bucketErrors from 'containers/Bucket/errors'

interface WorkflowsVersion {
  base: string
  catalog?: string
}

interface WorkflowsYaml {
  default_workflow?: string
  is_workflow_required?: boolean
  catalog?: {
    package_handle?: packageHandleUtils.NameTemplates
  }
  schemas?: Record<string, Schema>
  successors?: Record<string, SuccessorYaml>
  version: '1' | WorkflowsVersion
  workflows: Record<string, WorkflowYaml>
}

interface WorkflowYaml {
  description?: string
  entries_schema?: string
  handle_pattern?: string
  is_message_required?: boolean
  metadata_schema?: string
  name: string
  catalog?: {
    package_handle?: packageHandleUtils.NameTemplates
  }
}

interface SuccessorYaml {
  title: string
  copy_data?: boolean
}

export interface Successor {
  name: string
  slug: string
  url: string
  copyData: boolean
}

export interface Schema {
  url: string
}

export interface Workflow {
  description?: string
  isDefault: boolean
  isDisabled: boolean
  entriesSchema?: string
  name?: string
  packageNamePattern: RegExp | null
  packageName: Required<packageHandleUtils.NameTemplates>
  schema?: Schema
  slug: string | typeof notAvailable | typeof notSelected
}

export interface WorkflowsConfig {
  isWorkflowRequired: boolean
  packageName: Required<packageHandleUtils.NameTemplates>
  successors: Successor[]
  workflows: Workflow[]
}

const defaultPackageNameTemplates = {
  files: '',
  packages: '',
}

export const notAvailable = Symbol('not available')

const parsePackageNameTemplates = (
  globalTemplates?: packageHandleUtils.NameTemplates,
  workflowTemplates?: packageHandleUtils.NameTemplates,
): Required<packageHandleUtils.NameTemplates> => ({
  ...defaultPackageNameTemplates,
  ...globalTemplates,
  ...workflowTemplates,
})

export const notSelected = Symbol('not selected')

function getNoWorkflow(data: WorkflowsYaml, hasConfig: boolean): Workflow {
  return {
    isDefault: !data.default_workflow,
    isDisabled: data.is_workflow_required !== false,
    packageName: parsePackageNameTemplates(data.catalog?.package_handle),
    packageNamePattern: null,
    slug: hasConfig ? notSelected : notAvailable,
  }
}

const COPY_DATA_DEFAULT = true

export const emptyConfig: WorkflowsConfig = {
  isWorkflowRequired: false,
  packageName: defaultPackageNameTemplates,
  successors: [],
  workflows: [getNoWorkflow({} as WorkflowsYaml, false)],
}

function parseSchema(
  schemaSlug: string | undefined,
  schemas: Record<string, Schema> | undefined,
): Schema | undefined {
  return schemaSlug && schemas && schemaSlug in schemas
    ? {
        url: R.path([schemaSlug, 'url'], schemas) as string,
      }
    : undefined
}

function parseWorkflow(
  workflowSlug: string,
  workflow: WorkflowYaml,
  data: WorkflowsYaml,
): Workflow {
  return {
    description: workflow.description,
    isDefault: workflowSlug === data.default_workflow,
    isDisabled: false,
    entriesSchema: data.schemas?.[workflow.entries_schema || '']?.url,
    name: workflow.name,
    packageName: parsePackageNameTemplates(
      data.catalog?.package_handle,
      workflow.catalog?.package_handle,
    ),
    packageNamePattern: workflow.handle_pattern
      ? new RegExp(workflow.handle_pattern)
      : null,
    schema: parseSchema(workflow.metadata_schema, data.schemas),
    slug: workflowSlug,
  }
}

const parseSuccessor = (url: string, successor: SuccessorYaml): Successor => ({
  copyData: successor.copy_data === undefined ? COPY_DATA_DEFAULT : successor.copy_data,
  name: successor.title,
  slug: s3paths.parseS3Url(url).bucket || '',
  url,
})

function validateConfigVersion(
  objectVersion: string,
  schemaVersion: string,
): undefined | Error {
  if (semver.satisfies(schemaVersion, `^${objectVersion}`)) return undefined

  return new Error(
    `Your config file version (${objectVersion}) is incompatible with the current version of the config schema (${schemaVersion})`,
  )
}

function validateConfigCompoundVersion(
  objectCompoundVersion: WorkflowsVersion,
): undefined | Error[] {
  const { base: baseVersion, catalog: catalogVersion } = objectCompoundVersion
  const errors = []

  const invalidBaseVersion = validateConfigVersion(baseVersion, '1.1.0')
  if (invalidBaseVersion) {
    errors.push(invalidBaseVersion)
  }

  if (catalogVersion) {
    const invalidCatalogVersion = validateConfigVersion(catalogVersion, '1.0.0')
    if (invalidCatalogVersion) {
      errors.push(invalidCatalogVersion)
    }
  }

  return errors.length ? errors : undefined
}

function validateConfig(data: unknown): asserts data is WorkflowsYaml {
  const objectVersion = (data as WorkflowsYaml).version
  const workflowsConfigValidator = (objectVersion as WorkflowsVersion).catalog
    ? makeSchemaValidator(workflowsCatalogConfigSchema, [workflowsConfigSchema])
    : makeSchemaValidator(workflowsConfigSchema)

  const versionErrors = validateConfigCompoundVersion(
    typeof objectVersion === 'string' ? { base: objectVersion } : objectVersion,
  )
  if (versionErrors)
    throw new bucketErrors.WorkflowsConfigInvalid({ errors: versionErrors })

  const errors = workflowsConfigValidator(data)
  if (errors.length) throw new bucketErrors.WorkflowsConfigInvalid({ errors })
}

function prepareData(data: unknown): WorkflowsYaml {
  validateConfig(data)

  if ((data.version as WorkflowsVersion).catalog) return data

  const removeCatalog = R.dissoc('catalog')
  return removeCatalog(
    R.over(R.lensProp('workflows'), R.mapObjIndexed(removeCatalog), data),
  )
}

export function parse(workflowsYaml: string): WorkflowsConfig {
  const rawData = yaml(workflowsYaml)
  if (!rawData) return emptyConfig

  const data = prepareData(rawData)

  const { workflows } = data
  const workflowsList = Object.keys(workflows).map((slug) =>
    parseWorkflow(slug, workflows[slug], data),
  )

  const noWorkflow = getNoWorkflow(data, true)

  const successors = data.successors || {}
  return {
    isWorkflowRequired: data.is_workflow_required !== false,
    packageName: parsePackageNameTemplates(data.catalog?.package_handle),
    successors: Object.entries(successors).map(([url, successor]) =>
      parseSuccessor(url, successor),
    ),
    workflows: [noWorkflow, ...workflowsList],
  }
}
