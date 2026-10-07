import yaml from 'js-yaml'

import * as Types from 'utils/types'

interface Options {
  // 'core' leaves values like `2024-01-01` as strings instead of reading them as dates
  schema?: 'core'
}

const schemaFor = (opts?: Options) =>
  opts?.schema === 'core' ? { schema: yaml.CORE_SCHEMA } : {}

// Always dumps with the default schema, which quotes date-like strings, so Python's YAML
// (quilt3) reads them back as strings too.
export function stringify(inputObj?: Types.JsonRecord): string {
  // https://github.com/nodeca/js-yaml/issues/694
  if (inputObj && !Object.keys(inputObj).length) return ''
  return yaml.dump(inputObj)
}

// eslint-disable-next-line consistent-return
export function parse(inputStr?: string) {
  if (!inputStr) return undefined
  try {
    return yaml.load(inputStr)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error)
  }
}

export function validate(inputStr?: string) {
  if (!inputStr) return undefined
  try {
    yaml.load(inputStr)
    return undefined
  } catch (error) {
    return error
  }
}

// Like `parse`, but returns the parse error instead of swallowing it.
export function parseStrict<T = unknown>(
  inputStr?: string,
  opts?: Options,
): T | undefined | Error {
  if (!inputStr) return undefined
  try {
    return yaml.load(inputStr, schemaFor(opts)) as T
  } catch (error) {
    return error as Error
  }
}
