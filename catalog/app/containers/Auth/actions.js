import { actions } from './constants';


export const signIn = (tokens, /* istanbul ignore next */ { onSuccess, onError } = {}) => ({
  type: actions.SIGN_IN,
  payload: tokens,
  meta: { onSuccess, onError },
});

signIn.success = (user) => ({
  type: actions.SIGN_IN_SUCCESS,
  payload: user,
});

signIn.error = (e) => ({
  type: actions.SIGN_IN_ERROR,
  payload: e,
});

export const signOut = (onSuccess) => ({
  type: actions.SIGN_OUT,
  meta: { onSuccess },
});

export const check = ({ refetch = true, onComplete } = {}) => ({
  type: actions.CHECK,
  payload: { refetch },
  meta: { onComplete },
});

export const refresh = () => ({
  type: actions.REFRESH,
});

refresh.success = (tokens, user) => ({
  type: actions.REFRESH_SUCCESS,
  payload: {
    tokens,
    user,
  },
});

refresh.error = (e) => ({
  type: actions.REFRESH_ERROR,
  payload: e,
});

export const authLost = (e) => ({
  type: actions.AUTH_LOST,
  payload: e,
});
