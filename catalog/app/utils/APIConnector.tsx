import isArrayBuffer from 'lodash/isArrayBuffer'
import isBuffer from 'lodash/isBuffer'
import isNil from 'lodash/isNil'
import isString from 'lodash/isString'
import isTypedArray from 'lodash/isTypedArray'
import * as R from 'ramda'
import * as React from 'react'
import * as redux from 'react-redux'
import { takeEvery, call, put } from 'redux-saga/effects'

import cfg from 'constants/config'
import * as SagaInjector from 'utils/SagaInjector'
import defer from 'utils/defer'
import { BaseError } from 'utils/error'
import { actionCreator, createActions } from 'utils/reduxTools'

const REDUX_KEY = 'app/utils/APIConnector'

const actions = createActions(REDUX_KEY, 'API_REQUEST', 'API_RESPONSE')

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
 */
export interface RequestOptions {
  /** An endpoint for request (appended to configured base URL). */
  endpoint?: string
  /** An absolute URL for the request. */
  url?: string
  /**
   * Whether to add JSON-related headers and parse the response body.
   * Defaults to true.
   */
  json?: boolean | JsonOptions
  // arbitrary properties consumed by middleware / passed to `fetch`
  [key: string]: any
}

interface JsonOptions {
  stringify?: boolean
  parse?: boolean
  contentType?: boolean
  accepts?: boolean
}

/**
 * Action creator for API_REQUEST action.
 *
 * When `options` is a string, it is considered an endpoint.
 */
const request = actionCreator(actions.API_REQUEST, (payload, resolver) => ({
  payload: typeof payload === 'string' ? { endpoint: payload } : payload,
  meta: { ...resolver },
}))

/**
 * Action creator for API_RESPONSE action.
 */
const response = actionCreator(actions.API_RESPONSE, (payload, requestOpts) => ({
  payload,
  meta: { ...requestOpts },
}))

const test = R.ifElse(R.is(RegExp), R.test, R.equals)

export class HTTPError extends BaseError {
  static displayName = 'HTTPError'

  status?: number

  text?: string

  json?: any

  response?: Response

  static is = (e: unknown, status?: number, msg?: string | RegExp) => {
    if (!(e instanceof HTTPError)) return false
    if (status && e.status !== status) return false
    if (msg && !(e.json && test(msg)(e.json.message))) return false
    return true
  }

  constructor(
    resp: Response,
    text?: string,
    { message, status }: { message?: string; status?: number } = {},
  ) {
    let json
    try {
      json = JSON.parse(text as string)
    } catch (e) {
      json = { message: message || text }
    }

    super(message || (json && (json.message || json.error)) || resp.statusText, {
      response: resp,
      status: status || resp.status,
      text,
      json,
    })
  }
}

/**
 * Request middleware saga.
 *
 * Invoked with the request input and `next` (the next middleware in chain,
 * which should be invoked with `yield call()`).
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
export type Middleware = (input: any, next: any) => Generator<any, any, any>

/**
 * Compose middleware sagas.
 */
const composeMiddleware = (...mws: Middleware[]) =>
  // TODO: optimize
  function* composed(arg: any): Generator<any, any, any> {
    const [handler, ...rest] = mws
    return yield call(handler, arg, composeMiddleware(...rest))
  }

/**
 * Middleware for handling HTTP errors.
 *
 * @throws {HTTPError}
 */
function* errorMiddleware(opts: any, next: any): Generator<any, any, any> {
  const resp = yield call(next, opts)
  if (!resp.ok) {
    const text = yield resp.text()
    throw new HTTPError(resp, text)
  }
  return resp
}

const isInstance =
  <T,>(cls: { new (...args: any[]): T } | undefined) =>
  (b: unknown) =>
    cls ? b instanceof cls : false

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

const isValidBody = (b: unknown) => validBodyTests.some((t) => t && t(b))

/**
 * Stringify body if it's not of a type accepted by fetch / Request.
 *
 * Valid body types: ArrayBuffer, Buffer, TypedArray, String, Blob, FormData,
 * URLSearchParams, ReadableStream.
 * Details: https://developer.mozilla.org/en-US/docs/Web/API/Request/Request
 */
const stringifyBody = (body: any) => (isValidBody(body) ? body : JSON.stringify(body))

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
 */
function* jsonMiddleware(
  { json = true, ...opts }: any,
  next: any,
): Generator<any, any, any> {
  if (!json) return yield call(next, opts)

  const {
    stringify = true,
    parse = true,
    contentType = true,
    accepts = true,
  } = json === true ? {} : json

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
 */
const mkFetchMiddleware = ({
  fetch,
  base,
}: {
  fetch: typeof window.fetch
  base: string
}) =>
  function* fetchMiddleware({ url, endpoint, ...init }: any): Generator<any, any, any> {
    return yield call(fetch, url || base + endpoint, init)
  }

interface ApiSagaOptions {
  fetch: typeof window.fetch
  base?: string
  middleware?: Middleware[]
}

/**
 * The saga that listens for API_REQUEST actions and executes the requests.
 */
function* apiSaga({
  fetch,
  base = '',
  middleware = [],
}: ApiSagaOptions): Generator<any, any, any> {
  const execRequest = composeMiddleware(
    ...middleware,
    jsonMiddleware,
    errorMiddleware,
    mkFetchMiddleware({ fetch, base }),
  )

  yield takeEvery(
    request.type,
    function* handleRequest({
      payload: opts,
      meta: { resolve, reject },
    }: any): Generator<any, any, any> {
      try {
        const result = yield call(execRequest, opts)
        yield put(response(result, opts))
        yield call(resolve, result)
      } catch (e) {
        yield put(response(e, opts))
        yield call(reject, e)
      }
    },
  )
}

/**
 * Make an API request.
 */
export function* apiRequest(opts: RequestOptions | string): Generator<any, any, any> {
  const dfd = defer()
  yield put(request(opts, dfd.resolver))
  return yield dfd.promise
}

export type ApiRequest = (opts: RequestOptions | string) => Promise<any>

const Ctx = React.createContext<ApiRequest>(undefined as unknown as ApiRequest)

export const useApi = (): ApiRequest => React.useContext(Ctx)

export const use = useApi

interface ProviderProps {
  fetch: typeof window.fetch
  middleware?: Middleware[]
  children?: React.ReactNode
}

export function Provider({ fetch, middleware, children }: ProviderProps) {
  const base = `${cfg.registryUrl}/api`
  SagaInjector.useSaga(apiSaga, { fetch, base, middleware })

  const dispatch = redux.useDispatch()
  const req = React.useCallback<ApiRequest>(
    (opts) => {
      const dfd = defer()
      dispatch(request(opts, dfd.resolver))
      return dfd.promise as Promise<any>
    },
    [dispatch],
  )

  return <Ctx.Provider value={req}>{children}</Ctx.Provider>
}
