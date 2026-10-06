import * as React from 'react'

import { parse } from 'querystring'

import cfg from 'constants/config'
import { BaseError } from 'utils/error'

export class OIDCError extends BaseError {
  constructor(code, details) {
    super('Login failure', { code, details })
  }
}

// Shared with static/oauth-callback.html. localStorage, not sessionStorage: iOS
// may evict an installed app while the user switches to an MFA app.
const PENDING_KEY = 'QUILT_OIDC_REDIRECT'
const CALLBACK_KEY = 'QUILT_OIDC_CALLBACK'
const PENDING_TTL_MS = 10 * 60 * 1000

// An installed app (home-screen PWA) gets no usable `window.opener` back from a
// popup on iOS, so it signs in by top-level redirect instead.
export const isStandalone = () =>
  window.navigator.standalone === true ||
  !!window.matchMedia?.('(display-mode: standalone)').matches

const take = (key) => {
  const value = localStorage.getItem(key)
  localStorage.removeItem(key)
  return value
}

/**
 * Finish a redirect sign-in begun by `useOIDC` in an installed app.
 * Returns `null` when no callback is stored, else `{ next }` with either
 * `provider` and `code` or an `error`.
 */
export function takeRedirectResult() {
  let search
  let pending
  try {
    search = take(CALLBACK_KEY)
    if (!search) return null
    pending = JSON.parse(take(PENDING_KEY))
  } catch {
    // Unreadable storage: no callback, or a pending entry read as expired.
  }
  if (!search) return null
  if (!pending || !(Date.now() - pending.ts < PENDING_TTL_MS)) {
    return {
      error: new OIDCError('no_pending_sign_in', 'The sign-in expired. Try again.'),
    }
  }
  const { code, error, error_description: details, state } = parse(search.substring(1))
  const { provider, next } = pending
  if (state !== pending.state) {
    return {
      next,
      error: new OIDCError(
        'state_mismatch',
        "Response state doesn't match request state",
      ),
    }
  }
  if (error) return { next, error: new OIDCError(error, details) }
  return { provider, code, next }
}

export function useOIDC({ provider, popupParams }) {
  return React.useCallback(
    () =>
      new Promise((resolve, reject) => {
        const state = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
          b.toString(16).padStart(2, '0'),
        ).join('')
        const url = `${cfg.registryUrl}/oidc-authorize/${provider}?state=${state}`
        if (isStandalone()) {
          const { next } = parse(window.location.search.substring(1))
          localStorage.setItem(
            PENDING_KEY,
            JSON.stringify({ provider, state, next, ts: Date.now() }),
          )
          // The sign-in page completes the exchange (`takeRedirectResult`), so
          // this promise settles only if Back restores this page from bfcache.
          window.addEventListener(
            'pageshow',
            (e) => e.persisted && reject(new OIDCError('popup_closed_by_user')),
            { once: true },
          )
          window.location.assign(url)
          return
        }
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
