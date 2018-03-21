import { call } from 'redux-saga/effects';

import config from 'constants/config';
import { makeHeaders } from 'utils/auth';
import { requestJSON } from 'utils/request';


export default function* (endpoint, { headers, ...opts } = {}) {
  const authHeaders = yield call(makeHeaders);
  return yield call(requestJSON, `${config.api}/api${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...headers,
    },
    ...opts,
  });
}
