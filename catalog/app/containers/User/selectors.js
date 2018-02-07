import { Map } from 'immutable';
import { createSelector } from 'reselect';


const makeSelectPackages = () => createSelector(
  (state) => state.get('user', Map({})),
  (p) => p.toJS()
);

export {
  makeSelectPackages,
};
