import type { ErrorObject } from 'ajv'
/**
 * Extensible error class.
 */
export class BaseError extends Error {
  /**
   * @param message - Message to pass to the Error constructor.
   *
   * @param props - Properties to assign to the created instance.
   */
  constructor(msg?: string, props?: {}) {
    super(msg)
    Object.setPrototypeOf(this, new.target.prototype)
    // XXX: do we still need this?
    if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor)
    if (props) Object.assign(this, props)
  }

  [k: string]: any
}

Object.defineProperty(BaseError.prototype, 'name', {
  enumerable: false,
  get() {
    return this.constructor.displayName || this.constructor.name
  },
})

/**
 * Error class with fields designed to feed <Error /> via object rest spread.
 */
export class ErrorDisplay extends BaseError {
  /**
   * @param headline
   *
   * @param detail
   *
   * @param object
   */
  constructor(headline: string, detail?: string, object?: {}) {
    super(headline, { headline, detail, object })
  }
}

export interface JsonInvalidAgainstSchemaProps {
  errors: ErrorObject[]
}

export class JsonInvalidAgainstSchema extends BaseError {
  static displayName = 'JsonInvalidAgainstSchema'

  constructor(props: JsonInvalidAgainstSchemaProps) {
    super(
      props.errors
        .map(({ instancePath, message, params, keyword }) => {
          switch (keyword) {
            case 'const':
              return `${instancePath}: ${message}: ${params.allowedValue}`
            case 'enum':
              return `${instancePath}: ${message}: ${params.allowedValues.join(', ')}`
          }
          return `${instancePath}: ${message}`
        })
        .join('.\n'),
      props,
    )

    this.validationErrors = props.errors
  }
}
