/**
 * Extensible error class.
 */
export class BaseError {
  static displayName = 'BaseError'

  /**
   * @param {string} message Message to pass to the Error constructor.
   *
   * @param {Object} props Properties to assign to the created instance.
   */
  constructor(msg, props) {
    const e = new Error(msg)
    Object.setPrototypeOf(e, Object.getPrototypeOf(this))
    if (Error.captureStackTrace) Error.captureStackTrace(e, e.constructor)
    if (props) Object.assign(e, props)
    return e
  }
}

Object.setPrototypeOf(BaseError.prototype, Error.prototype)

Object.defineProperty(BaseError.prototype, 'name', {
  enumerable: false,
  get() {
    return this.constructor.displayName
  },
})

/**
 * Error class with fields designed to feed <Error /> via object rest spread.
 */
export class ErrorDisplay extends BaseError {
  static displayName = 'ErrorDisplay'

  /**
   * @param {string} headline
   *
   * @param {string} detail
   *
   * @param {Object} object
   */
  constructor(headline, detail, object) {
    super(headline, { headline, detail, object })
  }
}
