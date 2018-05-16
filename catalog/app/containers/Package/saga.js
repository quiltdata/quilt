import { call, put, takeLatest, takeEvery } from 'redux-saga/effects';

import { captureError } from 'utils/errorReporting';
import request from 'utils/sagaRequest';

import {
  commentAdded,
  getCommentsSuccess,
  getCommentsError,
} from './actions';
import { actions } from './constants';

function* getComments({ payload: { owner, name } }) {
  try {
    const { comments } = yield call(request, `/comments/${owner}/${name}/`);
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
    const { comment } = yield call(request, `/comments/${owner}/${name}/`, {
      method: 'POST',
      body: JSON.stringify({ contents }),
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
