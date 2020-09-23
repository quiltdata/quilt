import * as React from 'react'

import * as NamedRoutes from 'utils/NamedRoutes'
import { BaseError } from 'utils/error'

export class OktaError extends BaseError {
  constructor(code, details) {
    super('Okta login failure', { code, details })
  }
}

export function useOkta({ clientId, baseUrl }) {
  return React.useCallback(
    () =>
      new Promise((resolve, reject) => {
        const nonce = Math.random().toString(36).substr(2)
        const state = Math.random().toString(36).substr(2)
        const query = NamedRoutes.mkSearch({
          client_id: clientId,
          redirect_uri: window.location.origin,
          response_mode: 'okta_post_message',
          response_type: 'id_token',
          scope: 'openid email',
          nonce,
          state,
        })
        const url = `${baseUrl}/v1/authorize${query}`
        const popup = window.open(url, 'quilt_okta_popup', 'width=300,height=400')
        const timer = setInterval(() => {
          if (popup.closed) {
            window.removeEventListener('message', handleMessage)
            clearInterval(timer)
            reject(new OktaError('popup_closed_by_user'))
          }
        }, 500)
        const handleMessage = ({ source, origin, data }) => {
          if (source !== popup || !url.startsWith(`${origin}/`)) return
          try {
            const {
              id_token: idToken,
              error,
              error_description: details,
              state: respState,
            } = data
            if (respState !== state) {
              throw new OktaError(
                'state_mismatch',
                "Response state doesn't match request state",
              )
            }
            if (error) {
              throw new OktaError(error, details)
            }
            const { nonce: respNonce } = JSON.parse(atob(idToken.split('.')[1]))
            if (respNonce !== nonce) {
              throw new OktaError(
                'nonce_mismatch',
                "Response nonce doesn't match request nonce",
              )
            }
            resolve(idToken)
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
    [baseUrl, clientId, window.location.origin],
  )
}

export { useOkta as use }
