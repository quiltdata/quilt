import isArrayBuffer from 'lodash/isArrayBuffer'
import isBuffer from 'lodash/isBuffer'
import isNil from 'lodash/isNil'
import isString from 'lodash/isString'
import isTypedArray from 'lodash/isTypedArray'
import PT from 'prop-types'
import * as R from 'ramda'
import * as React from 'react'
import { setPropTypes } from 'recompose'
import * as reduxHook from 'redux-react-hook'
import { takeEvery, call, put } from 'redux-saga/effects'

import * as Config from 'utils/Config'
import * as SagaInjector from 'utils/SagaInjector'
import defer from 'utils/defer'
import { BaseError } from 'utils/error'
import { composeComponent } from 'utils/reactTools'
import { actionCreator, createActions } from 'utils/reduxTools'

const REDUX_KEY = 'app/utils/APIConnector'

const actions = createActions(REDUX_KEY, 'API_REQUEST', 'API_RESPONSE') // eslint-disable-line function-paren-newline

/**
 * Options object for creating Requests, with some minor additions:
 *   - accepts either `endpoint` or `url` property (to keep all the required
 *     options in one object).
 *
 *   - accepts `json` property (to add appropriate Content-Type header and
 *     parse the response body).
 *
 *   - may accept arbitrary properties which can be accessed inside a
 *     middleware.
 *
 * The rest of the props are passed to the `fetch` call (identical to the
 * `Request` constructor) as they are. See for details:
 * https://developer.mozilla.org/en-US/docs/Web/API/Request/Request
 *
 * @typedef {Object} RequestOptions
 *
 * @property {string} endpoint
 *   An endpoint for request (appended to configured base URL).
 *
 * @property {string} url
 *   An absolute URL for the request.
 *
 * @property {boolean} json
 *   Whether to add JSON-related headers and parse the response body.
 *   Defaults to true.
 */

/**
 * Action creator for API_REQUEST action.
 *
 * @param {RequestOptions|string} options
 *   When string, it is considered an endpoint.
 *
 * @param {utils/defer.Resolver} resolver
 *
 * @returns {redux.Action}
 */
const request = actionCreator(actions.API_REQUEST, (payload, resolver) => ({
  payload: typeof payload === 'string' ? { endpoint: payload } : payload,
  meta: { ...resolver },
}))

/**
 * Action creator for API_RESPONSE action.
 *
 * @param {any} response
 *
 * @params {RequestOptions} requestOpts
 *
 * @returns {redux.Action}
 */
const response = actionCreator(actions.API_RESPONSE, (payload, requestOpts) => ({
  payload,
  meta: { ...requestOpts },
}))

const test = R.ifElse(R.is(RegExp), R.test, R.equals)

export class HTTPError extends BaseError {
  static displayName = 'HTTPError'

  static is = (e, status, msg) => {
    if (!(e instanceof HTTPError)) return false
    if (status && e.status !== status) return false
    if (msg && !(e.json && test(msg)(e.json.message))) return false
    return true
  }

  constructor(resp, text) {
    let json
    try {
      json = JSON.parse(text)
    } catch (e) {} // eslint-disable-line no-empty

    super((json && json.message) || resp.statusText, {
      response: resp,
      status: resp.status,
      text,
      json,
    })
  }
}

/**
 * Request middleware saga.
 *
 * @typedef {function} Middleware
 *
 * @param {any} input
 *
 * @param {function} next
 *   Next middleware in chain (should be invoked with `yield call()`).
 *
 * @returns {any}
 *
 * @example
 * function* exampleMiddleware(opts, next) {
 *   // pre-processing: for example, we can intercept and adjust request options
 *   const newOpts = { ...opts, headers: { 'Content-Type': 'application/json' } };
 *   const resp = yield call(next, newOpts);
 *   // post-processing
 *   if (!resp.ok) throw new Error(resp.status);
 *   return yield resp.json();
 * }
 */

/**
 * Compose middleware sagas.
 *
 * @param {...Middleware} middleware
 *
 * @returns {function} Result of middleware composition.
 */
const composeMiddleware = (handler, ...rest) =>
  // TODO: optimize
  function* composed(arg) {
    return yield call(handler, arg, composeMiddleware(...rest))
  }

/**
 * Middleware for handling HTTP errors.
 *
 * @type {Middleware}
 *
 * @throws {HTTPError}
 */
function* errorMiddleware(opts, next) {
  const resp = yield call(next, opts)
  if (!resp.ok) {
    const text = yield resp.text()
    throw new HTTPError(resp, text)
  }
  return resp
}

const isInstance = (cls) => (b) => (cls ? b instanceof cls : false)

const validBodyTests = [
  isNil,
  isArrayBuffer,
  isBuffer,
  isTypedArray,
  isString,
  isInstance(global.Blob),
  isInstance(global.FormData),
  isInstance(global.URLSearchParams),
  isInstance(global.ReadableStream),
]

const isValidBody = (b) => validBodyTests.some((t) => t && t(b))

/**
 * Valid body type for fetch / Request. One of:
 *
 *   - ArrayBuffer
 *   - Buffer
 *   - TypedArray
 *   - String
 *   - Blob
 *   - FormData
 *   - URLSearchParams
 *   - ReadableStream
 *
 * Details: https://developer.mozilla.org/en-US/docs/Web/API/Request/Request
 *
 * @typedef {ArrayBuffer|Buffer|TypedArray|String|Blob|FormData|URLSearchParams|ReadableStream} Body
 */

/**
 * Stringify body if it's not of a type accepted by fetch / Request.
 *
 * @param {any} body
 *
 * @returns {Body}
 */
const stringifyBody = (body) => (isValidBody(body) ? body : JSON.stringify(body))

const jsonContentType = {
  'Content-Type': 'application/json',
}

const jsonAccepts = {
  Accepts: 'application/json',
}

/**
 * Middleware for working with JSON endpoints:
 *   - adds JSON-related headers
 *   - parses the response body
 *
 * @type {Middleware}
 *
 * @param {boolean} options.json Use JSON handling.
 */
function* jsonMiddleware({ json = true, ...opts }, next) {
  if (!json) return yield call(next, opts)

  const { stringify = true, parse = true, contentType = true, accepts = true } =
    json === true ? {} : json

  if (!stringify && !parse && !contentType && !accepts) {
    return yield call(next, opts)
  }

  const nextOpts = {
    ...opts,
    headers: {
      ...(contentType ? jsonContentType : {}),
      ...(accepts ? jsonAccepts : {}),
      ...opts.headers,
    },
    body: stringify ? stringifyBody(opts.body) : opts.body,
  }
  const resp = yield call(next, nextOpts)
  return parse ? yield resp.json() : resp
}

/**
 * Create fetch middleware.
 *
 * @param {Object} options
 *
 * @param {function} options.fetch
 *
 * @param {string} options.base
 *
 * @returns {Middleware}
 */
const mkFetchMiddleware = ({ fetch, base }) =>
  function* fetchMiddleware({ url, endpoint, ...init }) {
    return yield call(fetch, url || base + endpoint, init)
  }

/**
 * The saga that listens for API_REQUEST actions and executes the requests.
 *
 * @param {Object} options
 *
 * @param {function} options.fetch `fetch` implementation to use.
 *
 * @param {string} options.base
 *   API base URL, prepended to the `endpoint` for every request.
 *
 * @param {[Middleware]} options.middleware Middleware chain.
 */
function* apiSaga({ fetch, base = '', middleware = [] }) {
  const execRequest = composeMiddleware(
    ...middleware,
    jsonMiddleware,
    errorMiddleware,
    mkFetchMiddleware({ fetch, base }),
  )

  yield takeEvery(request.type, function* handleRequest({
    payload: opts,
    meta: { resolve, reject },
  }) {
    try {
      const result = yield call(execRequest, opts)
      yield put(response(result, opts))
      yield call(resolve, result)
    } catch (e) {
      yield put(response(e, opts))
      yield call(reject, e)
    }
  })
}

/**
 * Make an API request.
 *
 * @param {Object} options
 *
 * @returns {any}
 */
export function* apiRequest(opts) {
  const dfd = defer()
  yield put(request(opts, dfd.resolver))
  return yield dfd.promise
}

const Ctx = React.createContext()

export const useApi = () => React.useContext(Ctx)

export const use = useApi

export const Provider = composeComponent(
  'APIConnector.Provider',
  setPropTypes({
    fetch: PT.func.isRequired,
    middleware: PT.arrayOf(PT.func.isRequired),
  }),
  ({ fetch, middleware, children }) => {
    const base = `${Config.useConfig().registryUrl}/api`
    SagaInjector.useSaga(apiSaga, { fetch, base, middleware })

    const dispatch = reduxHook.useDispatch()
    const req = React.useCallback(
      (opts) => {
        const dfd = defer()
        dispatch(request(opts, dfd.resolver))
        return dfd.promise
      },
      [dispatch],
    )

    return <Ctx.Provider value={req}>{children}</Ctx.Provider>
  },
)
