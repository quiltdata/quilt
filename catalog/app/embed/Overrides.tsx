import template from 'lodash/template'
import * as R from 'ramda'
import * as React from 'react'

// XXX: consider using io-ts
interface S3ObjectLinkOverride {
  title?: React.ReactNode
  href?: (ctx: {
    url: string
    s3HttpsUri: string
    bucket: string
    // TODO: add encoded key?
    key: string
    version: string
  }) => string
  notification?: React.ReactNode
  emit?: 'notify' | 'override'
}

interface Overrides {
  s3ObjectLink?: S3ObjectLinkOverride
}

export const Context = React.createContext<Overrides>({})
Context.displayName = 'Overrides'

export const { Provider } = Context

function merge<L extends any, R extends any>(l: L, r: R) {
  return l ?? r
}

export function useOverrides(defaults?: Overrides): Overrides {
  const overrides = React.useContext(Context)
  return React.useMemo(
    () => compile(R.mergeDeepWith(merge, overrides, defaults || {})),
    [defaults, overrides],
  )
}

export { useOverrides as use }

function assertIsObject(scope: string, obj: unknown): asserts obj is object {
  if (obj != null && typeof obj !== 'object') {
    throw new Error(`${scope} must be an object if present`)
  }
}

const compileTemplate = (scope?: string) => (str?: unknown) => {
  try {
    return typeof str === 'string'
      ? template(str)
      : (str as NonNullable<Overrides['s3ObjectLink']>['href'])
  } catch (e) {
    if (scope) {
      throw new Error(`${scope} must be a valid template string: ${e.message}`)
    }
    throw e
  }
}

function validateEmit(v: unknown) {
  if (!v) return undefined
  if (v !== 'notify' && v !== 'override') {
    throw new Error(
      '.overrides.s3ObjectLink.emit must be either "notify" or "override" or some falsy value',
    )
  }
  return v
}

const compile = R.evolve({
  s3ObjectLink: { href: compileTemplate(), emit: validateEmit },
})

export function validate(input: unknown) {
  assertIsObject('.overrides', input)
  assertIsObject('.overrides.s3ObjectLink', (input as any)?.s3ObjectLink)
  R.evolve({
    s3ObjectLink: {
      href: compileTemplate('.overrides.s3ObjectLink.href'),
      emit: validateEmit,
    },
  })(input)
}
