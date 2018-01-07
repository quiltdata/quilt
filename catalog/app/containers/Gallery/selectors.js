/* App selectors */
import { Map } from 'immutable';
import { createSelector } from 'reselect';


const selectLatest = (state) => state.getIn(['gallery', 'response'], Map({}));

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
