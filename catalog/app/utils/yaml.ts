import yaml from 'js-yaml'

import * as Types from 'utils/types'

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
