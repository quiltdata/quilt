;(window as any).QUILT_CATALOG_CONFIG = {
  apiGatewayEndpoint: '',
  alwaysRequiresAuth: true,
  s3Proxy: '',
  registryUrl: '',
  ssoAuth: 'DISABLED',
  ssoProviders: '',
  analyticsBucket: '',
  serviceBucket: '',
  mode: 'PRODUCT',
  mixpanelToken: '',
  passwordAuth: 'ENABLED',
}

// It's required for jsdom
;(window as any).TextEncoder = require('util').TextEncoder
;(window as any).TextDecoder = require('util').TextDecoder
