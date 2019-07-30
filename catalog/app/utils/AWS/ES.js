import AWS from 'aws-sdk/lib/core'
import * as React from 'react'
import * as R from 'ramda'

import { useConfig } from 'utils/Config'
import { mkSearch } from 'utils/NamedRoutes'

import * as Signer from './Signer'

const REQUEST_TIMEOUT = 120000
const DEFAULT_SEARCH_SIZE = 1000

const getRegion = R.pipe(
  R.prop('hostname'),
  R.match(/\.([a-z]{2}-[a-z]+-\d)\.es\.amazonaws\.com$/),
  R.nth(1),
  R.defaultTo('us-east-1'),
)

const noop = () => {}

export const useES = ({ endpoint: ep, bucket }) => {
  const { shouldSign } = useConfig()
  const requestSigner = Signer.useRequestSigner()
  const signRequest = shouldSign(bucket) ? requestSigner : noop

  const endpoint = React.useMemo(() => new AWS.Endpoint(ep), [ep])
  const region = React.useMemo(() => getRegion(endpoint), [ep])

  const search = React.useCallback(
    (query, { _source, size = DEFAULT_SEARCH_SIZE }) => {
      const request = new AWS.HttpRequest(endpoint, region)
      delete request.headers['X-Amz-User-Agent']

      const path = `${bucket}/_doc/_search${mkSearch({ _source, size })}`

      request.method = 'GET'
      request.path += path
      request.headers.Host = endpoint.hostname
      request.headers['Content-Type'] = 'application/json'

      signRequest(request, 'es')

      delete request.headers.Host

      return new Promise((resolve, reject) => {
        let timedOut = false
        const timeoutId = setTimeout(() => {
          timedOut = true
          reject(new Error(`Timed out after ${REQUEST_TIMEOUT}ms`))
        }, REQUEST_TIMEOUT)

        AWS.HttpClient.getInstance().handleRequest(
          request,
          {},
          (response) => {
            let body = ''
            response.on('data', (chunk) => {
              if (timedOut) return
              body += chunk
            })
            response.on('end', () => {
              if (timedOut) return
              clearTimeout(timeoutId)
              if (response.statusCode !== 200) {
                reject(new Error(`ES Error: ${body}`))
                return
              }
              try {
                resolve(JSON.parse(body))
              } catch (e) {
                reject(e)
              }
            })
          },
          reject,
        )
      })
    },
    [endpoint, region, bucket],
  )

  return search
}

export const use = useES
