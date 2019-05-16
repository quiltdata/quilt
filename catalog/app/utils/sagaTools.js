import * as R from 'ramda'
import { select, take, takeEvery, takeLatest } from 'redux-saga/effects'

const mapAction = (mapping, fn) => (...args) => fn(...R.adjust(-1, mapping, args))

const mkTaker = (taker) => (variant, fn, ...args) =>
  taker(variant.is, mapAction(variant.unbox, fn), ...args)

export const takeLatestTagged = mkTaker(takeLatest)

export const takeEveryTagged = mkTaker(takeEvery)

export function* waitTil(selector, predicate = Boolean) {
  while (true) {
    const state = yield select(selector)
    if (predicate(state)) return state
    yield take('*')
  }
}
