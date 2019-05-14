/* App selectors */
import { Map } from 'immutable';
import { createSelector } from 'reselect';

import { REDUX_KEY } from './constants';


const selectLatest = (state) => state.getIn([REDUX_KEY, 'response'], Map({}));

const makeSelectLatest = () => createSelector(
  selectLatest,
  (resp) => {
    const obj = resp.toJS();
    return obj.packages || [];
  },
);

export {
  makeSelectLatest,
};
