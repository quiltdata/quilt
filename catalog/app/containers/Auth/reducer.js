// @flow

import id from 'lodash/identity';
import { Map } from 'immutable';

import { get } from 'utils/immutableTools';
import {
  withInitialState,
  handleActions,
  handleResult,
  handleTransitions,
  combine,
  unset,
  noop,
  type ActionHandler,
} from 'utils/reduxTools';

import type { CheckResult, SignInResult } from './actions';
import { actions, type FSMState } from './constants';
import { InvalidToken } from './errors';
import type { Tokens, User } from './types';


export type State = {|
  state: FSMState,
  user?: User,
  tokens?: Tokens,
  error?: Error,
  signInRedirect?: string,
  signOutRedirect?: string,
|};

const initial: State = {
  state: 'SIGNED_OUT',
};

const handleInvalidToken = <T>(lost, error): ActionHandler<T> => (e) =>
  e instanceof InvalidToken ? lost : error;

export default withInitialState(Map((initial: any)), handleTransitions(get('state'), {
  SIGNED_OUT: handleActions({
    [actions.SIGN_IN]: combine<State>({
      state: 'SIGNING_IN',
      error: unset,
    }),
  }),
  SIGNING_IN: handleActions({
    [actions.SIGN_IN_RESULT]: handleResult({
      resolve: combine<State>({
        state: 'SIGNED_IN',
        user: (p: SignInResult) => p.user,
        tokens: (p: SignInResult) => p.tokens,
      }),
      reject: combine<State>({
        state: 'SIGNED_OUT',
      }),
    }),
  }),
  SIGNED_IN: handleActions({
    [actions.SIGN_OUT_RESULT]: combine<State>({
      state: 'SIGNED_OUT',
      tokens: unset,
      user: unset,
    }),
    [actions.REFRESH]: combine<State>({
      state: 'REFRESHING',
      error: unset,
    }),
    [actions.AUTH_LOST]: combine<State>({
      state: 'SIGNED_OUT',
      error: id,
      tokens: unset,
      user: unset,
    }),
  }),
  REFRESHING: handleActions({
    [actions.REFRESH_RESULT]: handleResult({
      resolve: combine<State>({
        state: 'SIGNED_IN',
        tokens: (p: CheckResult) => p.tokens,
        user: (p: CheckResult) => p.user || noop,
      }),
      reject: combine<State>({
        // if token is invalid, sign out and destroy auth data,
        // otherwise (backend malfunction or smth) just register error
        state: handleInvalidToken('SIGNED_OUT', 'SIGNED_IN'),
        error: id,
        tokens: handleInvalidToken(unset, noop),
        user: handleInvalidToken(unset, noop),
      }),
    }),
  }),
}));
