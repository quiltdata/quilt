import { Map } from 'immutable';
import { createSelector } from 'reselect';

// Direct selector to the admin state domain
export const selectAdminDomain = (state) => state.get('admin', Map({}));

// Default selector used by Admin
export default createSelector(
  selectAdminDomain,
  (substate) =>
    substate
      .updateIn(['members', 'response'], (members) =>
        members && members.filter
          ? members
            .sortBy((m) => m.get('name'))
          : members
      ) // eslint-disable-line function-paren-newline
      .updateIn(['packages', 'response'], (packages) =>
        packages && packages.filter
          ? packages
            .sortBy((m) => m.get('handle'))
          : packages
      ) // eslint-disable-line function-paren-newline
      .toJS()
);
