import Ajv from 'ajv'
import invariant from 'invariant'

import { BaseError } from 'utils/error'
import { printObject } from 'utils/string'

import configSchema from '../../config-schema.json'

type Mode = 'OPEN' | 'PRODUCT' | 'LOCAL'
type AuthMethodConfig = 'ENABLED' | 'DISABLED' | 'SIGN_IN_ONLY'

// manually synced w/ config-schema.json
export interface ConfigJson {
  region: string

  mode: Mode
  alwaysRequiresAuth: boolean
  /** @deprecated */
  desktop?: boolean

  analyticsBucket?: string
  serviceBucket: string

  apiGatewayEndpoint: string
  registryUrl: string
  s3Proxy: string

  intercomAppId?: string
  mixpanelToken: string
  sentryDSN?: string

  legacyPackagesRedirect?: string

  linkedData?: {
    name?: string
    description?: string
  }

  noDownload?: boolean
  noOverviewImages?: boolean

  passwordAuth: AuthMethodConfig
  ssoAuth: AuthMethodConfig
  ssoProviders: string

  chunkedChecksums?: boolean

  qurator?: boolean

  build_version?: string // not sure where this comes from
  stackVersion: string
  packageRoot?: string
}

const ajv = new Ajv({ allErrors: true, removeAdditional: true })

ajv.addSchema(configSchema, 'Config')

export class ConfigError extends BaseError {
  static displayName = 'ConfigError'
}

function validateConfig(input: unknown): asserts input is ConfigJson {
  if (ajv.validate('Config', input)) return
  throw new ConfigError(
    [
      'invalid config format:',
      ajv.errorsText(),
      'Errors array:',
      printObject(ajv.errors),
      'Input:',
      printObject(input),
    ].join('\n'),
    { errors: ajv.errors, input },
  )
}

const AUTH_MAP = {
  ENABLED: true,
  DISABLED: false,
  SIGN_IN_ONLY: 'SIGN_IN_ONLY' as const,
}

const startWithOrigin = (s: string) => (s.startsWith('/') ? window.origin + s : s)

const transformConfig = (cfg: ConfigJson) => ({
  ...cfg,
  passwordAuth: AUTH_MAP[cfg.passwordAuth],
  ssoAuth: AUTH_MAP[cfg.ssoAuth],
  ssoProviders: cfg.ssoProviders.length ? cfg.ssoProviders.split(' ') : [],
  s3Proxy: startWithOrigin(cfg.s3Proxy),
  apiGatewayEndpoint: startWithOrigin(cfg.apiGatewayEndpoint),
  noDownload: !!cfg.noDownload,
  noOverviewImages: !!cfg.noOverviewImages,
  /** @deprecated */
  desktop: !!cfg.desktop,
  chunkedChecksums: !!cfg.chunkedChecksums,
  qurator: !!cfg.qurator,
})

export function prepareConfig(input: unknown) {
  try {
    validateConfig(input)
    return transformConfig(input)
  } catch (e) {
    if (e instanceof ConfigError) throw e
    throw new ConfigError('unexpected error', { originalError: e })
  }
}

export type Config = ReturnType<typeof prepareConfig>

let cachedConfig: Config | null = null
const configKey = 'QUILT_CATALOG_CONFIG'
export function getConfig() {
  if (!cachedConfig) {
    const rawConfig = (window as any)[configKey]
    invariant(rawConfig, `window.${configKey} must be defined`)
    cachedConfig = prepareConfig(rawConfig)
  }
  return cachedConfig
}
