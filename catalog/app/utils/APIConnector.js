// @flow

import isArrayBuffer from 'lodash/isArrayBuffer';
import isBuffer from 'lodash/isBuffer';
import isNil from 'lodash/isNil';
import isString from 'lodash/isString';
import isTypedArray from 'lodash/isTypedArray';
import PT from 'prop-types';
import { setPropTypes } from 'recompose';
import { takeEvery, call, put } from 'redux-saga/effects';
import { type Saga } from 'redux-saga';

import defer, { type Resolver } from 'utils/defer';
import { BaseError } from 'utils/error';
import { composeComponent, RenderChildren } from 'utils/reactTools';
import { actionCreator, createActions, type Action } from 'utils/reduxTools';
import { injectSaga } from 'utils/SagaInjector';


const REDUX_KEY = 'app/util/APIConnector';

const actions = createActions(REDUX_KEY,
  'API_REQUEST',
  'API_RESPONSE',
); // eslint-disable-line function-paren-newline

type RequestAction = Action & {|
  payload: any,
  meta: Resolver<*>,
|};

/**
 * Action creator for API_REQUEST action.
 */
const request = actionCreator<RequestAction>(actions.API_REQUEST, (
  payload: mixed,
  resolver: Resolver<*>,
) => ({
  payload: typeof payload === 'string' ? { endpoint: payload } : payload,
  meta: { ...resolver },
}));

type ResponseAction = Action & {|
  payload: mixed,
  meta: mixed,
|};

/**
 * Action creator for API_RESPONSE action.
 */
const response = actionCreator<ResponseAction>(actions.API_RESPONSE, (
  payload: mixed,
  requestOpts: mixed,
) => ({
  payload,
  meta: { request: requestOpts },
}));

export class HTTPError extends BaseError {
  static displayName = 'HTTPError';

  constructor(resp: Response, text: string) {
    let json;
    // eslint-disable-next-line no-empty
    try { json = JSON.parse(text); } catch (e) {}

    super((json && json.message) || resp.statusText, {
      response: resp,
      status: resp.status,
      text,
      json,
    });
  }
}

type JSONValue =
  | JSONObject
  | JSONArray
  | string
  | number
  | bool;

type JSONArray = JSONValue[];

type JSONObject = { [key: string]: JSONValue };

type RequestMethod =
  | 'GET'
  | 'HEAD'
  | 'POST'
  | 'PUT'
  | 'DELETE'
  | 'OPTIONS'
  | 'PATCH';

type HeadersObject = { [string]: string };

type RequestHeaders = Headers | HeadersObject;

/**
 * Valid body type for fetch / Request.
 * Details: https://developer.mozilla.org/en-US/docs/Web/API/Request/Request
 */
type RequestBody =
  | string
  | ArrayBuffer
  | Buffer
  | $TypedArray
  | Blob
  | FormData
  | URLSearchParams
  | ReadableStream;

type RequestMode =
  | 'cors'
  | 'no-cors'
  | 'same-origin'
  | 'navigate';

type RequestCredentials =
  | 'omit'
  | 'same-origin'
  | 'include';

type RequestCache = any;

type RequestRedirect =
  | 'follow'
  | 'error'
  | 'manual';

type RequestReferrer =
  | 'no-referrer'
  | 'client'
  | string;

/**
 * An options object for the Request constructor / fetch containing any custom
 * settings that you want to apply to the request according to MDN:
 * https://developer.mozilla.org/en-US/docs/Web/API/Request/Request
 */
type RequestInit = {|
  /**
   * Request method, defaults to GET.
   */
  method?: RequestMethod,
  /**
   * Any headers you want to add to your request, contained within a Headers
   * object or an object literal with ByteString values.
   */
  headers?: RequestHeaders,
  /**
   * Any body that you want to add to your request: this can be a Blob,
   * BufferSource, FormData, URLSearchParams, USVString, or ReadableStream object.
   * Note that a request using the GET or HEAD method cannot have a body.
   */
  body?: RequestBody,
  /**
   * The mode you want to use for the request, e.g., cors, no-cors, same-origin,
   * or navigate. The default is cors. In Chrome the default is no-cors before
   * Chrome 47 and same-origin starting with Chrome 47.
   */
  mode?: RequestMode,
  /**
   * The request credentials you want to use for the request: omit, same-origin,
   * or include. The default is omit. In Chrome the default is same-origin
   * before Chrome 47 and include starting with Chrome 47.
   */
  credentials?: RequestCredentials,
  /**
   * The cache mode you want to use for the request.
   */
  cache?: RequestCache,
  /**
   * The redirect mode to use: follow, error, or manual. In Chrome the default
   * is follow (before Chrome 47 it defaulted to manual).
   */
  redirect?: RequestRedirect,
  /**
   * A USVString specifying no-referrer, client, or a URL. The default is client.
   */
  referrer?: RequestReferrer,
  /**
   * Contains the subresource integrity value of the request (e.g.,
   * sha256-BpfBw7ivV8q2jLiT13fxDYAe2tJllusRSZ273h2nFSE=).
   */
  integrity?: string,
|};

/**
 * Request middleware saga.
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
type Middleware<I, O> = (
  input: I,
  /**
   * Next middleware in chain (should be invoked with `yield call()`).
   */
  next: ?Middleware<any, any>,
) => Saga<O>;

// TODO: figure out proper flow types for middleware
/**
 * Compose middleware sagas.
 */
const composeMiddleware = (
  handler: Middleware<*, *>,
  ...rest: Middleware<*, *>[]
): Middleware<*, *> =>
  // TODO: optimize
  function* composed(arg) {
    return rest.length
      ? yield call(handler, arg, composeMiddleware(...rest))
      : yield call(handler, arg);
  };

/**
 * Middleware for handling HTTP errors.
 *
 * @throws {HTTPError}
 */
function* errorMiddleware<I>(opts: I, next: ?Middleware<I, Response>): Saga<Response> {
  if (!next) throw new Error('error middleware: next required');
  const resp = yield call(next, opts);
  if (!resp.ok) {
    const text = yield resp.text();
    throw new HTTPError(resp, text);
  }
  return resp;
}

const isInstance = <C>(cls: Class<C>) => (b: mixed): bool =>
  cls ? b instanceof cls : false;

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
];

const isValidBody = (b: mixed) => validBodyTests.some((t) => t && t(b));

/**
 * Stringify body if it's not of a type accepted by fetch / Request.
 */
const stringifyBody = (body: mixed): RequestBody =>
  isValidBody(body) ? (body: any) : JSON.stringify(body);

type JSONMWOptions = {|
  /**
   * Whether to add JSON-related headers and parse the response body.
   * Defaults to true.
   */
  json?: bool,
|};

type JSONRequestOptions = {
  headers?: HeadersObject,
  body: any,
};

/**
 * Middleware for working with JSON endpoints:
 *   - adds JSON-related headers
 *   - parses the response body
 */
function* jsonMiddleware<I: JSONRequestOptions>(
  allOpts: { ...JSONMWOptions, ...I },
  next: ?Middleware<I, Response>,
): Saga<JSONValue | Response> {
  if (!next) throw new Error('json middleware: next required');
  const { json = true, ...rest } = allOpts;
  const opts = rest;
  if (!json) return yield call(next, opts);

  const jsonHeaders = {
    'Content-Type': 'application/json',
    Accepts: 'application/json',
  };
  const nextOpts = {
    ...opts,
    headers: { ...jsonHeaders, ...opts.headers },
    body: stringifyBody(opts.body),
  };
  const resp: Response = yield call(next, nextOpts);
  return yield resp.json();
}


type FetchMWOptions = {|
  ...RequestInit,
  /**
   * An endpoint for request (appended to configured base URL).
   * Either this or `url` must be specified.
   */
  endpoint?: string,
  /**
   * An absolute URL for the request.
   * Either this or `endpoint` must be specified.
   */
  url?: string,
|};

type Fetch = (
  input: Request | string,
  init: ?RequestInit,
) => Promise<Response>;

const getUrl = (base: string, url: ?string, endpoint: ?string): string => {
  if (url) return url;
  if (endpoint) return base + endpoint;
  throw new Error('fetch middleware: either url or endpoint required');
};

/**
 * Create fetch middleware.
 */
const mkFetchMiddleware = ({ fetch, base }: {
  fetch: Fetch,
  base: string,
}) =>
  function* fetchMiddleware({ url, endpoint, ...init }: FetchMWOptions): Saga<Response> {
    return yield call(fetch, getUrl(base, url, endpoint), init);
  };

/**
 * The saga that listens for API_REQUEST actions and executes the requests.
 */
function* apiSaga({
  fetch,
  base = '',
  middleware = [],
}: {
  /**
   * `fetch` implementation to use.
   */
  fetch: Fetch,
  /**
   * API base URL, prepended to the `endpoint` for every request.
   */
  base: string,
  /**
   * Middleware chain.
   */
  middleware: Middleware<any, any>[],
}): Saga<void> {
  const execRequest = composeMiddleware(
    ...middleware,
    jsonMiddleware,
    errorMiddleware,
    mkFetchMiddleware({ fetch, base }),
  );

  yield takeEvery(request.type,
    function* handleRequest({
      payload: opts,
      meta: { resolve, reject },
    }: RequestAction): Saga<void> {
      try {
        const result = yield call(execRequest, opts);
        yield put(response(result, opts));
        yield call(resolve, result);
      } catch (e) {
        yield put(response(e, opts));
        yield call(reject, e);
      }
    });
}

/**
 * Make an API request.
 */
export function* apiRequest<T>(opts: mixed): Saga<T> {
  const dfd = defer();
  yield put(request(opts, dfd.resolver));
  return yield dfd.promise;
}

export const Provider = composeComponent('APIConnectorProvider',
  setPropTypes({
    fetch: PT.func.isRequired,
    base: PT.string,
    middleware: PT.arrayOf(PT.func.isRequired),
  }),
  injectSaga(REDUX_KEY, apiSaga),
  RenderChildren);
