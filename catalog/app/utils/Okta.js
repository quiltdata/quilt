import * as React from 'react'

import cfg from 'constants/config'
import * as NamedRoutes from 'utils/NamedRoutes'
import { BaseError } from 'utils/error'

export class OktaError extends BaseError {
  constructor(code, details) {
    super('Login failure', { code, details })
  }
}

export function useOkta() {
  return React.useCallback(
    () =>
      new Promise((resolve, reject) => {
        const state = Math.random().toString(36).substring(2)
        const query = NamedRoutes.mkSearch({
          redirect_uri: window.location.origin,
          response_mode: 'okta_post_message',
          response_type: 'code',
          scope: 'openid email offline_access',
          state,
        })
        const url = `${cfg.registryUrl}/oidc-authorize/okta${query}`
        const popup = window.open(url, 'quilt_okta_popup', 'width=400,height=600')
        const timer = setInterval(() => {
          if (popup.closed) {
            window.removeEventListener('message', handleMessage)
            clearInterval(timer)
            reject(new OktaError('popup_closed_by_user'))
          }
        }, 500)
        const handleMessage = ({ source, data }) => {
          if (source !== popup) return
          try {
            const { code, error, error_description: details, state: respState } = data
            if (respState !== state) {
              throw new OktaError(
                'state_mismatch',
                "Response state doesn't match request state",
              )
            }
            if (error) {
              throw new OktaError(error, details)
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
    [],
  )
}

export { useOkta as use }
