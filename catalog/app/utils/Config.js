import PT from 'prop-types'
import * as R from 'ramda'
import * as React from 'react'
import * as RC from 'recompose'

import AsyncResult from 'utils/AsyncResult'
import * as Cache from 'utils/ResourceCache'
import { BaseError } from 'utils/error'
import * as RT from 'utils/reactTools'
import { conforms, isNullable, isArrayOf } from 'utils/validate'

export class ConfigError extends BaseError {
  static displayName = 'ConfigError'
}

const parseJSON = (msg = 'invalid JSON') =>
  R.tryCatch(JSON.parse, (e, src) => {
    throw new ConfigError(`${msg}:\n${src}`, { src, originalError: e })
  })

const validateConfig = conforms({
  registryUrl: R.is(String),
  alwaysRequiresAuth: R.is(Boolean),
  sentryDSN: isNullable(String),
  intercomAppId: isNullable(String),
  mixpanelToken: isNullable(String),
  apiGatewayEndpoint: R.is(String),
  defaultBucket: R.is(String),
  signInRedirect: R.is(String),
  signOutRedirect: R.is(String),
  disableSignUp: isNullable(Boolean),
  guestCredentials: conforms({
    accessKeyId: R.is(String),
    secretAccessKey: R.is(String),
  }),
  suggestedBuckets: isArrayOf(R.is(String)),
  federations: isArrayOf(R.is(String)),
  enableMarketingPages: isNullable(Boolean),
})

const validateBucket = conforms({
  name: R.is(String),
  title: isNullable(String),
  icon: isNullable(String),
  description: isNullable(String),
  searchEndpoint: isNullable(String),
  apiGatewayEndpoint: isNullable(String),
})

const validateFederation = conforms({
  buckets: isArrayOf(R.either(R.is(String), validateBucket)),
})

const fetchConfig = async (path) => {
  try {
    const res = await fetch(path)
    const text = await res.text()
    if (!res.ok) {
      throw new ConfigError(
        `error fetching config from "${path}" (${res.status}):\n${text}`,
        { path, response: res, text },
      )
    }
    return R.pipe(
      parseJSON(`invalid config JSON at "${path}"`),
      R.unless(validateConfig, (json) => {
        throw new ConfigError(
          `invalid config format at "${path}":\n${JSON.stringify(json, null, 2)}`,
          { json },
        )
      }),
    )(text)
  } catch (e) {
    if (!(e instanceof ConfigError)) {
      throw new ConfigError('unexpected error', { originalError: e })
    }
    throw e
  }
}

const fetchBucket = async (b) => {
  try {
    const res = await fetch(b)
    const text = await res.text()
    if (!res.ok) {
      throw new ConfigError(
        `error fetching bucket config from "${b}" (${res.status}):\n${text}`,
        { path: b, response: res, text },
      )
    }
    return R.pipe(
      parseJSON(`invalid bucket config JSON at "${b}"`),
      R.unless(validateBucket, (json) => {
        throw new ConfigError(
          `invalid bucket config format at "${b}":\n${JSON.stringify(json, null, 2)}`,
          { json },
        )
      }),
    )(text)
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(`Error fetching bucket config from "${b}"`)
    // eslint-disable-next-line no-console
    console.error(e)
    return undefined
  }
}

const mergeFederations = R.pipe(
  R.flatten,
  R.reduce((buckets, bucket) => {
    if (!bucket) return buckets
    const idx = R.findIndex(R.propEq('name', bucket.name), buckets)
    return idx === -1
      ? buckets.concat(bucket)
      : R.adjust(idx, R.mergeLeft(bucket), buckets)
  }, []),
)

const fetchFederations = R.pipe(
  R.map(async (f) => {
    try {
      const res = await fetch(f)
      const text = await res.text()
      if (!res.ok) {
        throw new ConfigError(
          `error fetching federation config from "${f}" (${res.status}):\n${text}`,
          { path: f, response: res, text },
        )
      }
      const json = parseJSON(`invalid federation config JSON at "${f}"`)(text)
      if (!validateFederation(json)) {
        throw new ConfigError(
          // eslint-disable-next-line prefer-template
          `invalid federation config format at "${f}":\n` + JSON.stringify(json, null, 2),
          { json },
        )
      }
      return await Promise.all(json.buckets.map(R.when(R.is(String), fetchBucket)))
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`Error fetching federation config from "${f}"`)
      // eslint-disable-next-line no-console
      console.error(e)
      return []
    }
  }),
  Promise.all.bind(Promise),
  R.then(mergeFederations),
)

const ConfigResource = Cache.createResource({
  name: 'Config.config',
  fetch: fetchConfig,
})

const FederationsResource = Cache.createResource({
  name: 'Config.federations',
  fetch: fetchFederations,
})

const Ctx = React.createContext()

export const Provider = RT.composeComponent(
  'Config.Provider',
  RC.setPropTypes({
    path: PT.string.isRequired,
  }),
  ({ path, children }) => <Ctx.Provider value={path}>{children}</Ctx.Provider>,
)

export const useConfig = ({ suspend = true } = {}) =>
  Cache.useData(ConfigResource, React.useContext(Ctx), { suspend })

export const useFederations = () =>
  Cache.use().get(FederationsResource, useConfig().federations)

const useAll = () => ({
  ...useConfig(),
  federations: useFederations(),
})

export const use = useAll

export const Inject = ({ children }) => children(AsyncResult.Ok(use()))
