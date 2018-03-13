/* Profile selectors */
import { Map } from 'immutable';
import { createSelector } from 'reselect';

import { REDUX_KEY } from './constants';

const selectProfile = (state) => state.get(REDUX_KEY, Map({}));

const makeSelectProfile = () => createSelector(
  selectProfile,
  (profile) => profile.toJS()
);

export {
  makeSelectProfile,
};
