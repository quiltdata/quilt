/* App selectors */
import { Map } from 'immutable';
import { createSelector } from 'reselect';

const emptyMap = Map({});

const selectAuth = (state) => state.getIn(['app', 'user', 'auth'], emptyMap);
const selectLocation = (state) => state.getIn(['app', 'location'], emptyMap);
const selectPackage = (state) => state.getIn(['app', 'package'], emptyMap);
const selectSearchText = (state) => state.getIn(['app', 'searchText'], '');
const selectUserName = (state) => state.getIn(
  ['app', 'user', 'auth', 'response', 'current_user'], ''
);
const selectEmail = (state) => state.getIn(
  ['app', 'user', 'auth', 'response', 'email'], ''
);

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

const makeSelectReadMe = () => createSelector(
  selectPackage,
  (pkg) => pkg.get('readme', emptyMap).toJS()
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
  makeSelectReadMe,
  makeSelectSearchText,
  makeSelectSignedIn,
  makeSelectUserName,
};
