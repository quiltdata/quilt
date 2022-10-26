import Ajv from 'ajv'
import invariant from 'invariant'

import { BaseError } from 'utils/error'

import configSchema from '../../config-schema.json'

type Mode = 'MARKETING' | 'OPEN' | 'PRODUCT' | 'LOCAL'
type AuthMethodConfig = 'ENABLED' | 'DISABLED' | 'SIGN_IN_ONLY'

// manually synced w/ config-schema.json
export interface ConfigJson {
  alwaysRequiresAuth: boolean
  analyticsBucket?: string
  apiGatewayEndpoint: string
  binaryApiGatewayEndpoint: string
  calendlyLink?: string
  googleClientId?: string
  oktaClientId?: string
  oktaBaseUrl?: string
  intercomAppId?: string
  mode: Mode
  legacyPackagesRedirect?: string
  linkedData?: {
    name?: string
    description?: string
  }
  mixpanelToken: string
  noDownload?: boolean
  noOverviewImages?: boolean
  passwordAuth: AuthMethodConfig
  registryUrl: string
  s3Proxy: string
  sentryDSN?: string
  serviceBucket: string
  ssoAuth: AuthMethodConfig
  ssoProviders: string
  build_version?: string // not sure where this comes from
}

const ajv = new Ajv({ allErrors: true, removeAdditional: true })

ajv.addSchema(configSchema, 'Config')

export class ConfigError extends BaseError {
  static displayName = 'ConfigError'
}

const pprint = (x: unknown) => JSON.stringify(x, null, 2)

function validateConfig(input: unknown): asserts input is ConfigJson {
  if (ajv.validate('Config', input)) return
  const printErrors = `Errors array:\n${pprint(ajv.errors)}`
  const printInput = `Input:\n${pprint(input)}`
  throw new ConfigError(
    `invalid config format:\n${ajv.errorsText()}\n${printErrors}\n${printInput}`,
    {
      errors: ajv.errors,
      input,
    },
  )
}

const AUTH_MAP = {
  ENABLED: true,
  DISABLED: false,
  SIGN_IN_ONLY: 'SIGN_IN_ONLY',
}

const startWithOrigin = (s: string) => (s.startsWith('/') ? window.origin + s : s)

const transformConfig = (cfg: ConfigJson) => ({
  ...cfg,
  passwordAuth: AUTH_MAP[cfg.passwordAuth],
  ssoAuth: AUTH_MAP[cfg.ssoAuth],
  ssoProviders: cfg.ssoProviders.length ? cfg.ssoProviders.split(' ') : [],
  enableMarketingPages: cfg.mode === 'PRODUCT' || cfg.mode === 'MARKETING',
  disableNavigator: cfg.mode === 'MARKETING',
  s3Proxy: startWithOrigin(cfg.s3Proxy),
  apiGatewayEndpoint: startWithOrigin(cfg.apiGatewayEndpoint),
  binaryApiGatewayEndpoint: startWithOrigin(cfg.binaryApiGatewayEndpoint),
  noDownload: !!cfg.noDownload,
  noOverviewImages: !!cfg.noOverviewImages,
  // XXX: there's no such field in the schema, so it will be stripped from the config when present
  desktop: !!(cfg as any).desktop,
})

const getConfig = (input: unknown) => {
  try {
    validateConfig(input)
    return transformConfig(input)
  } catch (e) {
    if (e instanceof ConfigError) throw e
    throw new ConfigError('unexpected error', { originalError: e })
  }
}

export type Config = ReturnType<typeof getConfig>

invariant(
  (window as any).QUILT_CATALOG_CONFIG,
  'window.QUILT_CATALOG_CONFIG must be defined',
)
const CONFIG = getConfig((window as any).QUILT_CATALOG_CONFIG)

export default CONFIG

export function useConfig(opts: { suspend: false }): { promise: Promise<Config> }
export function useConfig(): Config
/** @deprecated Config is now synchronous -- just import Config module directly */
export function useConfig(opts?: { suspend?: boolean }) {
  if (opts?.suspend === false) return { promise: Promise.resolve(CONFIG) }
  return CONFIG
}

export { useConfig as use }
