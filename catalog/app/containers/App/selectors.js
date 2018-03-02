/* App selectors */
import { Map } from 'immutable';
import { createSelector } from 'reselect';

import { REDUX_KEY } from './constants';

const emptyMap = Map({});

const selectAuth = (state) => state.getIn([REDUX_KEY, 'user', 'auth'], emptyMap);
const selectLocation = (state) => state.getIn([REDUX_KEY, 'location'], emptyMap);
const selectPackage = (state) => state.getIn([REDUX_KEY, 'package'], emptyMap);
const selectSearchText = (state) => state.getIn([REDUX_KEY, 'searchText'], '');
// eslint-disable-next-line function-paren-newline
const selectUserName = (state) => state.getIn(
  [REDUX_KEY, 'user', 'auth', 'response', 'current_user'], ''
); // eslint-disable-line function-paren-newline
// eslint-disable-next-line function-paren-newline
const selectEmail = (state) => state.getIn(
  [REDUX_KEY, 'user', 'auth', 'response', 'email'], ''
); // eslint-disable-line function-paren-newline

const makeSelectAuth = () => createSelector(
  selectAuth,
  (auth) => auth.toJS(),
);

const makeSelectLocation = () => createSelector(
  selectLocation,
  (location) => location.toJS()
);

const makeSelectPackage = () => createSelector(
  selectPackage,
  (pkg) => pkg.toJS(),
);

const makeSelectPackageSummary = () => createSelector(
  selectPackage,
  (pkg) => ({
    owner: pkg.getIn(['response', 'created_by']),
    hash: pkg.getIn(['response', 'hash']),
    name: pkg.get('name'),
  })
);

const makeSelectSearchText = () => createSelector(
  selectSearchText,
  (txt) => txt,
);

const makeSelectSignedIn = () => createSelector(
  selectUserName,
  (name) => Boolean(name),
);

const makeSelectUserName = () => createSelector(
  selectUserName,
  (name) => name,
);

const makeSelectEmail = () => createSelector(
  selectEmail,
  (email) => email,
);

/* For routing changes */
const makeSelectLocationState = () => {
  let prevRoutingState;
  let prevRoutingStateJS;
  return (state) => {
    const routingState = state.get('route'); // or state.route
    if (!routingState.equals(prevRoutingState)) {
      prevRoutingState = routingState;
      prevRoutingStateJS = routingState.toJS();
    }
    /* although most of the store uses immutable objects, this selector
     * must return JS or routing will break */
    return prevRoutingStateJS;
  };
};

export {
  makeSelectAuth,
  makeSelectEmail,
  makeSelectLocation,
  makeSelectLocationState,
  makeSelectPackage,
  makeSelectPackageSummary,
  makeSelectSearchText,
  makeSelectSignedIn,
  makeSelectUserName,
};
