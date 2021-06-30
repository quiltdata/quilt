import * as FP from 'fp-ts'
import * as IO from 'io-ts'
import { formatValidationErrors } from 'io-ts-reporters'
import * as R from 'ramda'

import { BaseError } from 'utils/error'

export * from 'io-ts-types'

export class ValidationError extends BaseError {
  constructor(e: IO.Errors) {
    const formatted = formatValidationErrors(e).join('\n')
    super(`ValidationError\n${formatted}`)
  }
}

export const decode = <T>(codec: IO.Type<T, any, any>) =>
  R.pipe(
    codec.decode,
    FP.either.fold(
      (e) => {
        throw new ValidationError(e)
      },
      (a) => a,
    ),
  ) as (i: unknown) => T

export interface NullableC<C extends IO.Mixed>
  extends IO.Type<IO.TypeOf<C> | null, IO.OutputOf<C> | null, unknown> {}

export type Nullable<T> = T | null

export const nullable = <C extends IO.Mixed>(
  codec: C,
  name: string = `Nullable<${codec.name}>`,
) =>
  new IO.Type(
    name,
    (i): i is Nullable<IO.TypeOf<C>> => i === null || codec.is(i),
    (u, c) => (u == null ? IO.success(null) : codec.validate(u, c)),
    (a) => a,
  ) as NullableC<C>
