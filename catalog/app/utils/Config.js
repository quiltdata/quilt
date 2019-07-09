import Ajv from 'ajv'
import PT from 'prop-types'
import * as R from 'ramda'
import * as React from 'react'
import * as RC from 'recompose'

import AsyncResult from 'utils/AsyncResult'
import * as Cache from 'utils/ResourceCache'
import { BaseError } from 'utils/error'
import * as RT from 'utils/reactTools'

import configSchema from '../../config-schema.json'
import federationSchema from '../../federation-schema.json'

const ajv = new Ajv({ allErrors: true, removeAdditional: true })

ajv.addSchema(configSchema, 'Config')
ajv.addSchema(federationSchema, 'Federation')

export class ConfigError extends BaseError {
  static displayName = 'ConfigError'
}

const pprint = (x) => JSON.stringify(x, null, 2)

const validate = (schema, msg) => (input) => {
  if (ajv.validate(schema, input)) return input
  const printErrors = `Errors array:\n${pprint(ajv.errors)}`
  const printInput = `Input:\n${pprint(input)}`
  throw new ConfigError(`${msg}:\n${ajv.errorsText()}\n${printErrors}\n${printInput}`, {
    errors: ajv.errors,
    input,
  })
}

const parseJSON = (msg = 'invalid JSON') =>
  R.tryCatch(JSON.parse, (e, src) => {
    throw new ConfigError(`${msg}:\n${src}`, { src, originalError: e })
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
      validate('Config', `invalid config format at "${path}"`),
    )(text)
  } catch (e) {
    if (!(e instanceof ConfigError)) {
      throw new ConfigError('unexpected error', { originalError: e })
    }
    throw e
  }
}

const AUTH_MAP = {
  ENABLED: true,
  DISABLED: false,
  SIGN_IN_ONLY: 'SIGN_IN_ONLY',
}

const transformConfig = (cfg) => ({
  ...cfg,
  shouldSign: (bucket) => [cfg.defaultBucket, cfg.analyticsBucket].includes(bucket),
  shouldProxy: (bucket) => ![cfg.defaultBucket, cfg.analyticsBucket].includes(bucket),
  passwordAuth: AUTH_MAP[cfg.passwordAuth],
  ssoAuth: AUTH_MAP[cfg.ssoAuth],
  ssoProviders: cfg.ssoProviders.length ? cfg.ssoProviders.split(' ') : [],
})

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
      validate(
        'Federation#/definitions/BucketConfig',
        `invalid bucket config format at "${b}"`,
      ),
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
      validate('Federation', `invalid federation config format at "${f}"`)
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
  fetch: R.pipeWith(R.then)([fetchConfig, transformConfig]),
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
