/* App selectors */
import { Map } from 'immutable';
import { createSelector } from 'reselect';

import { REDUX_KEY } from './constants';

const emptyMap = Map({});

const selectAuth = (state) => state.getIn([REDUX_KEY, 'user', 'auth'], emptyMap);
const selectPackage = (state) => state.getIn([REDUX_KEY, 'package'], emptyMap);
const selectSearchText = (state) => state.getIn([REDUX_KEY, 'searchText'], '');
const selectUserName = (state) => state.getIn(
  [REDUX_KEY, 'user', 'auth', 'response', 'current_user'],
  ''
);
const selectEmail = (state) => state.getIn(
  [REDUX_KEY, 'user', 'auth', 'response', 'email'],
  ''
);

const makeSelectAuth = () => createSelector(
  selectAuth,
  (auth) => auth.toJS(),
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

export {
  makeSelectAuth,
  makeSelectEmail,
  makeSelectPackage,
  makeSelectPackageSummary,
  makeSelectSearchText,
  makeSelectSignedIn,
  makeSelectUserName,
};
