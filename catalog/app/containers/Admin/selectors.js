import { Map } from 'immutable';
import { createSelector } from 'reselect';

/**
 * Direct selector to the admin state domain
 */
export const selectAdminDomain = (state) => state.get('admin', Map({}));

/**
 * Other specific selectors
 */

/**
 * Default selector used by Admin
 */

export default createSelector(
  selectAdminDomain,
  (substate) =>
    substate
      .updateIn(['members', 'response'], (members) =>
        members && members.filter
          ? members
            .filter((m) => m.get('status') !== 'disabled')
            .sortBy((m) => m.get('name'))
          : members
      ) // eslint-disable-line function-paren-newline
      .toJS()
);
