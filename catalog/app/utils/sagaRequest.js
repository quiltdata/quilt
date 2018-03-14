import { call } from 'redux-saga/effects';

import config from 'constants/config';
import { makeHeaders } from 'utils/auth';
import makeError from 'utils/error';
import { requestJSON } from 'utils/request';


export default function* (endpoint, { headers, ...opts } = {}) {
  const authHeaders = yield call(makeHeaders);
  const response = yield call(requestJSON, `${config.api}/api${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...headers,
    },
    ...opts,
  });
  if (response.message) {
    throw makeError(response.message);
  }
  return response;
}
