import semver from 'semver'

import * as R from 'ramda'

import workflowsConfigSchema from 'schemas/workflows-config-1.1.0.json'
import workflowsCatalogConfigSchema from 'schemas/workflows-config_catalog-1.0.0.json'

import * as bucketErrors from 'containers/Bucket/errors'
import { makeSchemaValidator } from 'utils/JSONSchema'
import type * as packageHandleUtils from 'utils/packageHandle'
import * as s3paths from 'utils/s3paths'
import * as YAML from 'utils/yaml'
import { S3ObjectLocation, parseS3Url } from 'utils/s3paths'

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

export interface WorkflowYaml {
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

export interface SchemaRef {
  name: string
  location: S3ObjectLocation
}

export interface Workflow {
  description?: string
  isDefault: boolean
  isDisabled: boolean
  isMessageRequired?: boolean
  entriesSchema?: string
  name?: string
  packageNamePattern: RegExp | null
  packageNamePatternError?: string
  // `handle_pattern` as written, for display; the compiled pattern may be a translation
  handlePattern?: string
  undefinedSchemas?: string[]
  packageName: Required<packageHandleUtils.NameTemplates>
  schema?: Schema
  slug: string | typeof notAvailable | typeof notSelected
  schemas: {
    entries?: SchemaRef
    metadata?: SchemaRef
  }
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
    schemas: {},
  }
}

const COPY_DATA_DEFAULT = true

export const nullConfig: WorkflowsConfig = {
  isWorkflowRequired: false,
  packageName: defaultPackageNameTemplates,
  successors: [],
  workflows: [getNoWorkflow({} as WorkflowsYaml, false)],
}

export const emptyConfig = (bucket: string): WorkflowsConfig => ({
  ...nullConfig,
  successors: [bucketToSuccessor(bucket)],
})

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

const parseSchemaRef = (
  name: string | undefined,
  schemas: Record<string, Schema> | undefined,
): SchemaRef | undefined =>
  name && schemas && name in schemas
    ? {
        name,
        location: parseS3Url(schemas[name]?.url),
      }
    : undefined

export type PatternAnalysis =
  | { _tag: 'ok'; regex: RegExp }
  // Valid for Python, but the browser can't reproduce it exactly; the push enforces it
  | { _tag: 'uncheckable'; reason: string }
  // Python's `re` would reject it, so every push through the flow would fail
  | { _tag: 'invalid'; reason: string }

const PY_KNOWN_LETTER_ESCAPES = new Set('abBAZdDsSwWfnrtvxuUN'.split(''))

// Python `\w` and `\d` are Unicode-aware on str patterns; JS needs them spelled out.
const CLASS_OUT: Record<string, string> = {
  w: '[\\p{L}\\p{N}_]',
  W: '[^\\p{L}\\p{N}_]',
  d: '\\p{Nd}',
  D: '\\P{Nd}',
  s: '\\s',
  S: '\\S',
}
const CLASS_IN: Record<string, string | null> = {
  w: '\\p{L}\\p{N}_',
  W: null,
  d: '\\p{Nd}',
  D: '\\P{Nd}',
  s: '\\s',
  S: '\\S',
}
const SIMPLE: Record<string, string> = {
  n: '\\n',
  r: '\\r',
  t: '\\t',
  f: '\\f',
  v: '\\v',
  a: '\\x07',
}

const hex = (cp: number) =>
  cp < 0x100 ? `\\x${cp.toString(16).padStart(2, '0')}` : `\\u{${cp.toString(16)}}`

// Reads a `handle_pattern` the way quilt3's `re` does. Only constructs with an exact
// JS (`u` flag) equivalent are translated; anything else is left to the push.
export function analyzePattern(src: string): PatternAnalysis {
  if (/\(\?[aiLmsu-]*x/.test(src))
    return { _tag: 'uncheckable', reason: 'verbose mode (?x)' }
  const cs = Array.from(src)
  let out = ''
  let depth = 0
  let inClass = false
  let classFirst = -1
  let uncheckable: string | null = null
  const skip = (why: string) => {
    if (!uncheckable) uncheckable = why
  }
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i]
    if (c === '\\') {
      const n = cs[++i]
      if (n === undefined)
        return { _tag: 'invalid', reason: 'Ends with a lone backslash' }
      if (/[A-Za-z]/.test(n) && !PY_KNOWN_LETTER_ESCAPES.has(n)) {
        return { _tag: 'invalid', reason: `\\${n} isn't a valid escape for pushes` }
      }
      if (inClass && n === 'b') out += '\\x08'
      else if (n in SIMPLE) out += SIMPLE[n]
      else if (n in CLASS_OUT) {
        const t = inClass ? CLASS_IN[n] : CLASS_OUT[n]
        if (t === null) skip(`\\${n} inside [...]`)
        else out += t
      } else if (n === 'x' && /^[0-9a-fA-F]{2}$/.test(cs.slice(i + 1, i + 3).join(''))) {
        out += `\\x${cs.slice(i + 1, i + 3).join('')}`
        i += 2
      } else if (n === 'u' && /^[0-9a-fA-F]{4}$/.test(cs.slice(i + 1, i + 5).join(''))) {
        out += `\\u${cs.slice(i + 1, i + 5).join('')}`
        i += 4
      } else if (/[A-Za-z0-9]/.test(n)) skip(`\\${n}`)
      // Any other escaped character is that character
      else out += hex(n.codePointAt(0)!)
      continue
    }
    if (inClass) {
      if (c === ']' && i !== classFirst) {
        inClass = false
        out += ']'
      } else out += c === ']' || c === '[' ? `\\${c}` : c
      continue
    }
    if (c === '[') {
      inClass = true
      classFirst = cs[i + 1] === '^' ? i + 2 : i + 1
      out += c
      if (cs[i + 1] === '^') out += cs[++i]
      continue
    }
    if (c === '(') {
      depth++
      if (cs[i + 1] !== '?') {
        out += c
        continue
      }
      const rest = cs.slice(i + 2).join('')
      if (/^[:=!]/.test(rest) || /^<[=!]/.test(rest)) out += '(?'
      else if (rest.startsWith('#')) {
        const end = cs.indexOf(')', i)
        if (end < 0) return { _tag: 'invalid', reason: 'Missing )' }
        depth--
        i = end
        continue
      } else if (rest.startsWith('P<')) {
        out += '(?<'
        i += 2
      } else {
        skip(`(?${rest.slice(0, 2)}`)
        out += '(?'
      }
      i += 1
      continue
    }
    if (c === ')') {
      if (!depth) return { _tag: 'invalid', reason: 'Unbalanced )' }
      depth--
    }
    if ('*+?}'.includes(c) && cs[i + 1] === '+') skip('possessive quantifier')
    out += c === ']' ? '\\]' : c
  }
  if (inClass) return { _tag: 'invalid', reason: 'Missing ]' }
  if (depth) return { _tag: 'invalid', reason: 'Missing )' }
  if (uncheckable) return { _tag: 'uncheckable', reason: uncheckable }
  try {
    return { _tag: 'ok', regex: new RegExp(out, 'u') }
  } catch (e) {
    return { _tag: 'uncheckable', reason: 'syntax the browser reads differently' }
  }
}

function compilePattern(
  src?: string,
): Pick<Workflow, 'packageNamePattern' | 'packageNamePatternError'> {
  if (!src) return { packageNamePattern: null }
  const a = analyzePattern(src)
  return a._tag === 'ok'
    ? { packageNamePattern: a.regex }
    : { packageNamePattern: null, packageNamePatternError: a.reason }
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
    isMessageRequired: !!workflow.is_message_required,
    entriesSchema: data.schemas?.[workflow.entries_schema || '']?.url,
    name: workflow.name,
    packageName: parsePackageNameTemplates(
      data.catalog?.package_handle,
      workflow.catalog?.package_handle,
    ),
    ...compilePattern(workflow.handle_pattern),
    handlePattern: workflow.handle_pattern,
    // quilt3 rejects every push through such a workflow ("There is no ... in schemas").
    undefinedSchemas: Array.from(
      new Set(
        [workflow.metadata_schema, workflow.entries_schema].filter(
          (id): id is string => !!id && !data.schemas?.[id],
        ),
      ),
    ),
    schema: parseSchema(workflow.metadata_schema, data.schemas),
    slug: workflowSlug,
    schemas: {
      entries: parseSchemaRef(workflow.entries_schema, data.schemas),
      metadata: parseSchemaRef(workflow.metadata_schema, data.schemas),
    },
  }
}

const parseSuccessor = (url: string, successor: SuccessorYaml): Successor => ({
  copyData: successor.copy_data === undefined ? COPY_DATA_DEFAULT : successor.copy_data,
  name: successor.title,
  slug: s3paths.parseS3Url(url).bucket || '',
  url,
})

export const bucketToSuccessor = (bucket: string) => ({
  copyData: COPY_DATA_DEFAULT,
  name: bucket,
  slug: bucket,
  url: `s3://${bucket}`,
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
  if (!objectVersion)
    throw new bucketErrors.WorkflowsConfigInvalid({
      errors: [new Error('Provide the config version')],
    })
  const workflowsConfigValidator = (objectVersion as WorkflowsVersion).catalog
    ? makeSchemaValidator(workflowsCatalogConfigSchema, [workflowsConfigSchema])
    : makeSchemaValidator(workflowsConfigSchema)

  const versionErrors = validateConfigCompoundVersion(
    typeof objectVersion === 'string' ? { base: objectVersion } : objectVersion,
  )
  if (versionErrors)
    throw new bucketErrors.WorkflowsConfigInvalid({ errors: versionErrors })

  const errors = workflowsConfigValidator(data).filter(
    (e) =>
      !(
        'keyword' in e &&
        e.keyword === 'format' &&
        e.instancePath.endsWith('/handle_pattern')
      ),
  )
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

export function parse(
  workflowsYaml: string,
  bucket: string,
  { strict = false }: { strict?: boolean } = {},
): WorkflowsConfig {
  // quilt3 rejects a push when this file doesn't parse, so the catalog must not read it
  // as "no flows" (that would also offer to create flows over it).
  const rawData = YAML.parseStrict(workflowsYaml)
  if (rawData instanceof Error) {
    throw new bucketErrors.WorkflowsConfigInvalid({
      errors: [new Error(`The file isn't valid YAML: ${rawData.message.split('\n')[0]}`)],
    })
  }
  if (!rawData) return strict ? nullConfig : emptyConfig(bucket)

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
