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

// enum implementation taken from https://github.com/gcanti/io-ts/pull/366
enum Enum {}

export class EnumType<E extends typeof Enum> extends IO.Type<E[keyof E]> {
  readonly _tag: 'EnumType' = 'EnumType'

  private readonly enum: E

  private readonly enumValues: Set<string | number>

  constructor(e: E, name: string) {
    super(
      name,
      (u): u is E[keyof E] => {
        if (!this.enumValues.has(u as any)) return false
        // Don't allow key names from number enum reverse mapping
        if (typeof (this.enum as any)[u as string] === 'number') return false
        return true
      },
      (u, c) => (this.is(u) ? IO.success(u) : IO.failure(u, c)),
      IO.identity,
    )
    this.enum = e
    this.enumValues = new Set(Object.values(e))
  }
}

export const enumType = <E extends typeof Enum>(e: E, name: string = 'enum') =>
  new EnumType<E>(e, name)

export { enumType as enum }

export type AtLeast<T, K extends keyof T> = Partial<T> & Pick<T, K>
