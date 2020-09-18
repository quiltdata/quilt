import * as React from 'react'

import { parse } from 'querystring'

import * as NamedRoutes from 'utils/NamedRoutes'
import { BaseError } from 'utils/error'

// import oauthHelper from './oauth-helper.html'

export class OneLoginError extends BaseError {
  constructor(code, details) {
    super('OneLogin login failure', { code, details })
  }
}

export function useOneLogin({ clientId, baseUrl }) {
  return React.useCallback(
    () =>
      new Promise((resolve, reject) => {
        const nonce = Math.random().toString(36).substr(2)
        const state = Math.random().toString(36).substr(2)
        const query = NamedRoutes.mkSearch({
          client_id: clientId,
          redirect_uri: `${window.location.origin}/oauth-callback`,
          response_mode: 'fragment',
          response_type: 'id_token',
          scope: 'openid email',
          nonce,
          state,
        })
        const url = `${baseUrl}/auth${query}`
        const popup = window.open(url, 'quilt_onelogin_popup', 'width=300,height=400')
        const timer = setInterval(() => {
          if (popup.closed) {
            window.removeEventListener('message', handleMessage)
            clearInterval(timer)
            reject(new OneLoginError('popup_closed_by_user'))
          }
        }, 500)
        const handleMessage = ({ source, origin, data }) => {
          if (source !== popup || origin !== window.location.origin) return
          try {
            const { type, fragment } = data
            if (type !== 'callback') return

            const {
              id_token: idToken,
              error,
              error_description: details,
              state: respState,
            } = parse(fragment.substr(1))
            if (respState !== state) {
              throw new OneLoginError(
                'state_mismatch',
                "Response state doesn't match request state",
              )
            }
            if (error) {
              throw new OneLoginError(error, details)
            }
            const { nonce: respNonce } = JSON.parse(atob(idToken.split('.')[1]))
            if (respNonce !== nonce) {
              throw new OneLoginError(
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

export { useOneLogin as use }
