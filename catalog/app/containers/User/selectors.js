import { Map } from 'immutable';
import { createSelector } from 'reselect';

import { REDUX_KEY } from './constants';


const makeSelectPackages = () => createSelector(
  (state) => state.get(REDUX_KEY, Map({})),
  (p) => p.toJS()
);

export {
  makeSelectPackages,
};
