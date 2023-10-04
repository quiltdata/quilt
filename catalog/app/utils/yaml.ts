import yaml from 'js-yaml'

import * as Types from 'utils/types'

export function stringify(inputObj?: Types.JsonRecord): string {
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
