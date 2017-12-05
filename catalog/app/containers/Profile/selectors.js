/* Profile selectors */
import { Map } from 'immutable';
import { createSelector } from 'reselect';

const emptyMap = Map({});

const selectProfile = (state) => state.getIn(['profile'], emptyMap);

const makeSelectProfile = () => createSelector(
  selectProfile,
  (profile) => profile.toJS()
);

export {
  makeSelectProfile,
};
