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

const ajv = new Ajv({ allErrors: true, removeAdditional: true })

ajv.addSchema(configSchema, 'Config')

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

const ConfigResource = Cache.createResource({
  name: 'Config.config',
  fetch: R.pipeWith(R.then)([fetchConfig, transformConfig]),
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

export const use = useConfig

export const Inject = ({ children }) => children(AsyncResult.Ok(use()))
