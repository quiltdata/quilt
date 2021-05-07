import lodashTemplate from 'lodash/template'

type Context = 'files' | 'packages'

export type Handles = Partial<Record<Context, string>>

type Options = {
  username?: string
  directory?: string
}

export function convertItem(template: string, options?: Options): string | null {
  try {
    return lodashTemplate(template)(options)
  } catch (error) {
    return null
  }
}

export function convert(
  handlesDict: Handles,
  context: Context,
  options?: Options,
): string {
  return convertItem(handlesDict[context] || '', options) || ''
}
