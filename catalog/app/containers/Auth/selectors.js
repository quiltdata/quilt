// @flow

import { Map } from 'immutable';
import id from 'lodash/identity';
import { createSelector } from 'reselect';

import { get, getIn, toJS } from 'utils/immutableTools';
import type { Selector } from 'utils/reduxTools';

import { REDUX_KEY, waitingStates, type FSMState } from './constants';
import type { State } from './reducer';
import type { User, Tokens } from './types';


export const domain: Selector<State> =
  createSelector(get(REDUX_KEY, Map({})), toJS());

export const state: Selector<FSMState> =
  createSelector(getIn([REDUX_KEY, 'state']), id);

export const waiting: Selector<bool> =
  createSelector(state, (s) => waitingStates.includes(s));

export const error: Selector<?Error> =
  createSelector(getIn([REDUX_KEY, 'error']), id);

export const username: Selector<?string> =
  createSelector(getIn([REDUX_KEY, 'user']), (u: ?User) => u && u.current_user);

export const authenticated: Selector<bool> =
  createSelector(username, Boolean);

export const email: Selector<?string> =
  createSelector(getIn([REDUX_KEY, 'user']), (u: ?User) => u && u.email);

export const tokens: Selector<?Tokens> =
  createSelector(getIn([REDUX_KEY, 'tokens']), id);

export const signInRedirect: Selector<?string> =
  createSelector(getIn([REDUX_KEY, 'signInRedirect']), id);

export const signOutRedirect: Selector<?string> =
  createSelector(getIn([REDUX_KEY, 'signOutRedirect']), id);
