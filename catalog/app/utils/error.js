/* Quilt Error constructor with fields designed to to feed <Error />
 * via object rest spread */
export default function makeError(primary, secondary = '', response = {}) {
  const error = new Error(primary);
  // need to do this explicitly so that object rest spread will catch it
  // when it goes into <Error />
  error.headline = primary;
  error.detail = secondary;
  // Response objects do not work with JSON.stringify() so we copy
  // some fields into a fresh Object
  error.object = {
    ok: response.ok,
    redirected: response.redirected,
    status: response.status,
    statusText: response.statusText,
    type: response.type,
    url: response.url,
  };

  return error;
}

/**
 * Extensible error class
 */
export class BaseError {
  static displayName = 'BaseError';

  constructor(msg, props) {
    const e = new Error(msg);
    Object.setPrototypeOf(e, Object.getPrototypeOf(this));
    if (Error.captureStackTrace) Error.captureStackTrace(e, e.constructor);
    if (props) Object.assign(e, props);
    return e;
  }
}

Object.setPrototypeOf(BaseError.prototype, Error.prototype);

Object.defineProperty(BaseError.prototype, 'name', {
  enumerable: false,
  get() { return this.constructor.displayName; },
});
