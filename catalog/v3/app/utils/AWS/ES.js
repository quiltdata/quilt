import { stringify } from 'querystring'

import AWS from 'aws-sdk/lib/core'
import es from 'elasticsearch-browser'
import invariant from 'invariant'
import * as R from 'ramda'

import useMemoEq from 'utils/useMemoEq'

import * as Config from './Config'
import * as Signer from './Signer'

const getRegion = R.pipe(
  R.prop('hostname'),
  R.match(/\.([a-z]{2}-[a-z]+-\d)\.es\.amazonaws\.com$/),
  R.nth(1),
  R.defaultTo('us-east-1'),
)

// TODO: use injected `fetch` instead of xhr
class SignedConnector extends es.ConnectionPool.connectionClasses.xhr {
  constructor(host, config) {
    super(host, config)
    invariant(
      config.signRequest,
      'SignedConnector: config must include signRequest method',
    )
    invariant(config.awsConfig, 'SignedConnector: config must include awsConfig object')
    this.sign = (req) => config.signRequest(req, 'es')
    this.awsConfig = config.awsConfig
    this.endpoint = new AWS.Endpoint(host.host)
    if (host.protocol) this.endpoint.protocol = host.protocol.replace(/:?$/, ':')
    if (host.port) this.endpoint.port = host.port
    this.httpOptions = config.httpOptions || this.awsConfig.httpOptions
  }

  request(params, cb) {
    const request = new AWS.HttpRequest(this.endpoint, getRegion(this.endpoint))

    if (params.body) {
      request.body = params.body
    }

    request.headers = {
      ...request.headers,
      ...params.headers,
      Host: this.endpoint.host,
    }
    delete request.headers['X-Amz-User-Agent']
    request.method = params.method
    request.path = params.path
    const qs = stringify(params.query)
    if (qs) request.path += `?${qs}`

    this.sign(request)

    delete request.headers.Host

    const patchedParams = {
      method: request.method,
      path: request.path,
      headers: request.headers,
      body: request.body,
    }

    return super.request(patchedParams, cb)
  }
}

export const useES = (props) => {
  const awsConfig = Config.use()
  const signRequest = Signer.useRequestSigner()
  return useMemoEq(
    { awsConfig, signRequest, ...props },
    (cfg) =>
      new es.Client({
        ...cfg,
        connectionClass: SignedConnector,
      }),
  )
}

export const use = useES
