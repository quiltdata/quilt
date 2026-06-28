import * as R from 'ramda'
import { ForkEffect, select, take, takeEvery, takeLatest } from 'redux-saga/effects'

// A tagged-union variant constructor (see utils/tagged): `is` doubles as a
// redux-saga action pattern and `unbox` extracts the wrapped value.
interface Variant {
  is: (inst: unknown) => boolean
  unbox: (inst: unknown) => unknown
}

type Worker = (...args: any[]) => any
type Taker = (pattern: any, worker: Worker, ...args: any[]) => ForkEffect<never>

const mapAction =
  (mapping: (value: unknown) => unknown, fn: Worker) =>
  (...args: unknown[]) =>
    fn(...R.adjust(-1, mapping, args))

const mkTaker =
  (taker: Taker) =>
  (variant: Variant, fn: Worker, ...args: unknown[]): ForkEffect<never> =>
    taker(variant.is, mapAction(variant.unbox, fn), ...args)

export const takeLatestTagged = mkTaker(takeLatest as unknown as Taker)

export const takeEveryTagged = mkTaker(takeEvery as unknown as Taker)

export function* waitTil<T>(
  selector: (...args: any[]) => T,
  predicate: (state: T) => boolean = Boolean,
): Generator<unknown, T, T> {
  while (true) {
    const state: T = yield select(selector)
    if (predicate(state)) return state
    yield take('*')
  }
}
