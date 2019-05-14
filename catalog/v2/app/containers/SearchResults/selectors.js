/* selectors for Search Results */
import { Map } from 'immutable';
import { createSelector } from 'reselect';

import { REDUX_KEY } from './constants';

const selectSearch = (state) => state.get(REDUX_KEY, Map({}));

const makeSelectSearch = () => createSelector(
  selectSearch,
  (s) => s.toJS()
);

export {
  makeSelectSearch,
};
