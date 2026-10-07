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
  // Python's `re` rejects the pattern, so every push through this flow fails
  packageNamePatternInvalid?: string
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
  // What a quantifier here would repeat; Python rejects repeating nothing or a repeat
  let prev: 'none' | 'atom' | 'quant' | 'mod' = 'none'
  let uncheckable: string | null = null
  const skip = (why: string) => {
    if (!uncheckable) uncheckable = why
  }
  const invalid = (reason: string): PatternAnalysis => ({ _tag: 'invalid', reason })
  const quantify = (q: string, js: string): PatternAnalysis | null => {
    if (prev === 'none') return invalid(`Nothing for ${q} to repeat`)
    if (prev === 'quant' && (q === '?' || q === '+')) {
      if (q === '+') skip('possessive quantifier')
      prev = 'mod'
    } else if (prev !== 'atom') {
      return invalid(`${q} repeats a repeat`)
    } else prev = 'quant'
    out += js
    return null
  }
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i]
    if (c === '\\') {
      const n = cs[++i]
      if (n === undefined) return invalid('Ends with a lone backslash')
      if (/[A-Za-z]/.test(n) && !PY_KNOWN_LETTER_ESCAPES.has(n)) {
        return invalid(`\\${n} isn't a valid escape for pushes`)
      }
      prev = 'atom'
      if (inClass && n === 'b') out += '\\x08'
      else if ('AZbB'.includes(n)) {
        skip(`\\${n}`)
        prev = 'none'
      } else if (n in SIMPLE) out += SIMPLE[n]
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
        prev = 'atom'
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
      const rest = cs.slice(i + 2).join('')
      if (cs[i + 1] === '?' && rest.startsWith('#')) {
        const end = cs.indexOf(')', i)
        if (end < 0) return invalid('Missing )')
        i = end
        continue
      }
      depth++
      prev = 'none'
      if (cs[i + 1] !== '?') {
        out += c
        continue
      }
      if (/^[:=!]/.test(rest)) {
        out += `(?${rest[0]}`
        i += 2
      } else if (rest.startsWith('P<')) {
        out += '(?<'
        i += 3
      } else if (/^<[=!]/.test(rest)) {
        // Python only allows fixed-width look-behind; JS allows any
        skip('look-behind')
        out += `(?${rest.slice(0, 2)}`
        i += 3
      } else if (/^(P=|>|\(|[aiLmsux-]+[:)])/.test(rest)) {
        skip(`(?${rest.slice(0, 2)}`)
        out += '(?'
        i += 1
      } else if (rest.startsWith('<')) {
        return invalid('Named groups are written (?P<name>...) for pushes')
      } else return invalid(`Unknown group (?${rest.slice(0, 1)}`)
      continue
    }
    if (c === ')') {
      if (!depth) return invalid('Unbalanced )')
      depth--
      prev = 'atom'
      out += c
      continue
    }
    if (c === '|' || c === '^' || c === '$') {
      prev = 'none'
      out += c
      continue
    }
    if (c === '*' || c === '+' || c === '?') {
      const r = quantify(c, c)
      if (r) return r
      continue
    }
    if (c === '{') {
      // Python reads `{` as a repeat only in `{m}`, `{m,}`, `{,n}`, `{m,n}`, `{,}`
      const m = /^\{(\d*)(,(\d*))?\}/.exec(cs.slice(i, i + 40).join(''))
      if (m && m[0] !== '{}') {
        const lo = m[1]
        const hi = m[2] ? m[3] : m[1]
        if (lo && hi && Number(lo) > Number(hi))
          return invalid('Repeat minimum is above maximum')
        const r = quantify(m[0], `{${lo || '0'}${m[2] ? `,${hi}` : ''}}`)
        if (r) return r
        i += m[0].length - 1
        continue
      }
    }
    prev = 'atom'
    out += c === ']' || c === '{' || c === '}' ? `\\${c}` : c
  }
  if (inClass) return invalid('Missing ]')
  if (depth) return invalid('Missing )')
  if (uncheckable) return { _tag: 'uncheckable', reason: uncheckable }
  try {
    return { _tag: 'ok', regex: new RegExp(out, 'u') }
  } catch (e) {
    return { _tag: 'uncheckable', reason: 'syntax the browser reads differently' }
  }
}

function compilePattern(
  src?: string,
): Pick<
  Workflow,
  'packageNamePattern' | 'packageNamePatternError' | 'packageNamePatternInvalid'
> {
  if (!src) return { packageNamePattern: null }
  const a = analyzePattern(src)
  if (a._tag === 'ok') return { packageNamePattern: a.regex }
  return a._tag === 'invalid'
    ? { packageNamePattern: null, packageNamePatternInvalid: a.reason }
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
