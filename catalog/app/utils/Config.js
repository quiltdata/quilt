import Ajv from 'ajv'
import * as R from 'ramda'
import * as React from 'react'

import AsyncResult from 'utils/AsyncResult'
import * as Cache from 'utils/ResourceCache'
import { BaseError } from 'utils/error'

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

const fetchConfig = async ({ path, opts = {} }) => {
  try {
    if (opts.desktop) return opts

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
      R.merge(opts),
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

const startWithOrigin = (s) => (s.startsWith('/') ? window.origin + s : s)

const transformConfig = (cfg) => ({
  ...cfg,
  passwordAuth: AUTH_MAP[cfg.passwordAuth],
  ssoAuth: AUTH_MAP[cfg.ssoAuth],
  ssoProviders: cfg.ssoProviders.length ? cfg.ssoProviders.split(' ') : [],
  enableMarketingPages: cfg.mode === 'PRODUCT' || cfg.mode === 'MARKETING',
  disableNavigator: cfg.mode === 'MARKETING',
  s3Proxy: startWithOrigin(cfg.s3Proxy),
  apiGatewayEndpoint: startWithOrigin(cfg.apiGatewayEndpoint),
  binaryApiGatewayEndpoint: startWithOrigin(cfg.binaryApiGatewayEndpoint),
})

const ConfigResource = Cache.createResource({
  name: 'Config.config',
  fetch: R.pipeWith(R.andThen)([fetchConfig, transformConfig]),
})

const Ctx = React.createContext()

export function ConfigProvider({ path, opts, children }) {
  return <Ctx.Provider value={{ path, opts }}>{children}</Ctx.Provider>
}

export function useConfig({ suspend = true } = {}) {
  return Cache.useData(ConfigResource, React.useContext(Ctx), { suspend })
}

export const Inject = function InjectConfig({ children }) {
  return children(AsyncResult.Ok(useConfig()))
}

export { ConfigProvider as Provider, useConfig as use }
