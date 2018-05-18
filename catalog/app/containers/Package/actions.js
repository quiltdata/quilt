import api from 'constants/api';

import { actions } from './constants';


// comments: get
export const getComments = (owner, name) => ({
  type: actions.GET_COMMENTS,
  payload: { owner, name },
});

export const getCommentsResponse = (status, response) => ({
  type: actions.GET_COMMENTS_RESPONSE,
  payload: { status, response },
});

export const getCommentsSuccess = (response) =>
  getCommentsResponse(api.SUCCESS, response);

export const getCommentsError = (response) =>
  getCommentsResponse(api.ERROR, response);


// comments: add
export const addComment = ({ owner, name, contents }, { resolve, reject }) => ({
  type: actions.ADD_COMMENT,
  payload: { owner, name, contents },
  meta: { resolve, reject },
});

export const commentAdded = (comment) => ({
  type: actions.COMMENT_ADDED,
  payload: comment,
});
