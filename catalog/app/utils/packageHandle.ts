import lodashTemplate from 'lodash/template'
import * as R from 'ramda'

export interface PackageHandle {
  bucket: string
  name: string
  hash: string
}

export function shortenRevision(fullRevision: string): string {
  return R.take(10, fullRevision)
}

type Context = 'files' | 'packages'

export type NameTemplates = Partial<Record<Context, string>>

type Options = {
  username?: string
  directory?: string
}

export function execTemplateItem(template: string, options?: Options): string | null {
  try {
    return lodashTemplate(template)(options)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log('Template for default package name is invalid')
    // eslint-disable-next-line no-console
    console.error(error)
    return null
  }
}

export function execTemplate(
  templatesDict: NameTemplates,
  context: Context,
  options?: Options,
): string | null {
  if (!templatesDict || !templatesDict[context]) return null
  return execTemplateItem(templatesDict[context] || '', options)
}
