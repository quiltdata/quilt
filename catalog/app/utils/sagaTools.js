import { select, take } from 'redux-saga/effects';

export function* waitTil(selector, predicate = Boolean) {
  while (true) {
    const state = yield select(selector);
    if (predicate(state)) return state;
    yield take('*');
  }
}
