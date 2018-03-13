import { Map } from 'immutable';
import { createSelector } from 'reselect';

import { REDUX_KEY } from './constants';

// Direct selector to the admin state domain
export const selectAdminDomain = (state) => state.get(REDUX_KEY, Map({}));

const invoke = (method, ...args) => (obj) =>
  obj && method in obj ? obj[method](...args) : obj;

const get = (key) => invoke('get', key);

// Default selector used by Admin
export default createSelector(
  selectAdminDomain,
  (substate) =>
    substate
      .updateIn(['members', 'response'], invoke('sortBy', get('name')))
      .updateIn(['memberAudit', 'response'], invoke('sortBy', (e) => -e.get('time')))
      .updateIn(['packages', 'response'], invoke('sortBy', get('handle')))
      .updateIn(['packageAudit', 'response'], invoke('sortBy', (e) => -e.get('time')))
      .toJS()
);
