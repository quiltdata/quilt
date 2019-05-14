/* sagas for SearchResults */
import { call, put, takeLatest } from 'redux-saga/effects';

import { apiRequest } from 'utils/APIConnector';
import { ErrorDisplay } from 'utils/error';
import { captureError } from 'utils/errorReporting';

import { getSearchError, getSearchSuccess } from './actions';
import { GET_SEARCH } from './constants';


export function* getSearch({ query }) {
  try {
    const data = yield call(apiRequest,
      `/search/?q=${encodeURIComponent(query)}`);
    yield put(getSearchSuccess(data));
  } catch (e) {
    yield put(getSearchError(new ErrorDisplay(
      'Search hiccup', `getSearch: ${e.message}`
    )));
    captureError(e);
  }
}

export default function* () {
  yield takeLatest(GET_SEARCH, getSearch);
}
