import { Map } from 'immutable';
import id from 'lodash/identity';
import { createSelector } from 'reselect';

import { get, getIn, toJS } from 'utils/immutableTools';

import { REDUX_KEY, waitingStates } from './constants';

export const domain = createSelector(get(REDUX_KEY, Map({})), toJS());

export const state = createSelector(getIn([REDUX_KEY, 'state']), id);

export const waiting = createSelector(state, (s) => waitingStates.includes(s));

export const error = createSelector(getIn([REDUX_KEY, 'error']), id);

export const username = createSelector(getIn([REDUX_KEY, 'user', 'current_user']), id);

export const authenticated = createSelector(username, Boolean);

export const email = createSelector(getIn([REDUX_KEY, 'user', 'email']), id);

export const tokens = createSelector(getIn([REDUX_KEY, 'tokens'], Map({})), toJS());
