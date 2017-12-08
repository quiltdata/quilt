/* sagas for SearchResults */
import { call, put, takeLatest } from 'redux-saga/effects';

import { makeHeaders } from 'utils/auth';
import config from 'constants/config';
import makeError from 'utils/error';
import request from 'utils/request';

import { getSearchError, getSearchSuccess } from './actions';
import { GET_SEARCH } from './constants';

export function* doGetSearch(action) {
  const { query } = action;
  const { api: server } = config;
  const headers = yield call(makeHeaders);
  const endpoint = `${server}/api/search/?q=${encodeURIComponent(query)}`;
  try {
    const response = yield call(request, endpoint, { method: 'GET', headers });
    const data = yield response.json();
    if (response.ok && response.status === 200 && data) {
      yield put(getSearchSuccess(data));
    } else {
      throw makeError('Search hiccup', data.message, response);
    }
  } catch (error) {
    if (!error.headline) {
      error.headline = 'Search hiccup';
      error.detail = `doGetSearch: ${error.message}`;
    }
    yield put(getSearchError(error));
  }
}

export function* watchGetSearch() {
  yield takeLatest(GET_SEARCH, doGetSearch);
}

export default [
  watchGetSearch,
];

