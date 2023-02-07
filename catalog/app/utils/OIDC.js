import * as React from 'react'

import { parse } from 'querystring'

import cfg from 'constants/config'
import * as NamedRoutes from 'utils/NamedRoutes'
import { BaseError } from 'utils/error'

export class OIDCError extends BaseError {
  constructor(code, details) {
    super('Login failure', { code, details })
  }
}

export function useOIDC({ provider, popupParams }) {
  return React.useCallback(
    () =>
      new Promise((resolve, reject) => {
        const state = Math.random().toString(36).substring(2)
        const query = NamedRoutes.mkSearch({
          redirect_uri: `${window.location.origin}/oauth-callback`,
          response_type: 'code',
          scope: 'openid email',
          state,
        })
        const url = `${cfg.registryUrl}/oidc-authorize/${provider}${query}`
        const popup = window.open(url, `quilt_${provider}_popup`, popupParams)
        const timer = setInterval(() => {
          if (popup.closed) {
            window.removeEventListener('message', handleMessage)
            clearInterval(timer)
            reject(new OIDCError('popup_closed_by_user'))
          }
        }, 500)
        const handleMessage = ({ source, origin, data }) => {
          if (source !== popup || origin !== window.location.origin) return
          try {
            const { type } = data
            if (type !== 'callback') return

            const {
              code,
              error,
              error_description: details,
              state: respState,
            } = parse(source.window.location.search.substring(1))
            if (respState !== state) {
              throw new OIDCError(
                'state_mismatch',
                "Response state doesn't match request state",
              )
            }
            if (error) {
              throw new OIDCError(error, details)
            }
            resolve(code)
          } catch (e) {
            reject(e)
          } finally {
            window.removeEventListener('message', handleMessage)
            clearInterval(timer)
            popup.close()
          }
        }
        window.addEventListener('message', handleMessage)
        popup.focus()
      }),
    [provider, popupParams],
  )
}

export { useOIDC as use }
