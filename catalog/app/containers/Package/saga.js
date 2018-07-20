import { call, put, takeLatest, takeEvery } from 'redux-saga/effects';

import { apiRequest } from 'utils/APIConnector';
import { captureError } from 'utils/errorReporting';

import {
  commentAdded,
  getCommentsSuccess,
  getCommentsError,
} from './actions';
import { actions } from './constants';

function* getComments({ payload: { owner, name } }) {
  try {
    const { comments } = yield call(apiRequest, `/comments/${owner}/${name}/`);
    yield put(getCommentsSuccess(comments));
  } catch (err) {
    yield put(getCommentsError(err));
    captureError(err);
  }
}

function* addComment({
  payload: { owner, name, contents },
  meta: { resolve, reject },
}) {
  try {
    const { comment } = yield call(apiRequest, {
      endpoint: `/comments/${owner}/${name}/`,
      method: 'POST',
      body: { contents },
    });
    yield put(commentAdded(comment));
    yield call(resolve, comment);
  } catch (err) {
    yield call(reject, err);
    captureError(err);
  }
}

export default function* () {
  yield takeLatest(actions.GET_COMMENTS, getComments);
  yield takeEvery(actions.ADD_COMMENT, addComment);
}
