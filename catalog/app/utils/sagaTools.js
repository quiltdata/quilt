// @flow

import { select, take } from 'redux-saga/effects';
import type { Saga } from 'redux-saga';

export function* waitTil<T>(
  selector: (state: any) => T,
  predicate: (x: T) => bool = Boolean,
): Saga<?T> {
  while (true) {
    const state = yield select(selector);
    if (predicate(state)) return state;
    yield take('*');
  }
}
