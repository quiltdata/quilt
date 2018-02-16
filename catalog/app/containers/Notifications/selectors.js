import { fromJS } from 'immutable';
import { createSelector } from 'reselect';

export default createSelector(
  (state) => state.get('notifications', fromJS([])),
  (ns) => ({ notifications: ns.toJS() })
);
