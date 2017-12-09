/* selectors for Search Results */
import { Map } from 'immutable';
import { createSelector } from 'reselect';

const emptyMap = Map({});

const selectSearch = (state) => state.getIn(['search'], emptyMap);

const makeSelectSearch = () => createSelector(
  selectSearch,
  (s) => s.toJS()
);

export {
  makeSelectSearch,
};
