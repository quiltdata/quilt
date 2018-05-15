/* App selectors */
import { Map } from 'immutable';
import { createSelector, createStructuredSelector } from 'reselect';

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

const frequencies = {
  week: 1000 * 60 * 60 * 24 * 7,
};

const selectTrafficType = (type) => createSelector(
  (s) => s.getIn([REDUX_KEY, 'package', 'traffic', 'response']),
  (response) => {
    if (response instanceof Error) return response;
    if (!response) return null;

    const data = response.toJS()[type];
    if (!data) return null;

    const { startDate, frequency, timeSeries, total } = data;

    const step = frequencies[frequency];
    if (!step) return null;

    const weekly = timeSeries.map((value, i) => ({
      from: new Date((startDate * 1000) + (step * i)),
      to: new Date((startDate * 1000) + (step * (i + 1))),
      value,
    }));

    return { weekly, total };
  }
);

const selectPackageTraffic = createStructuredSelector({
  installs: selectTrafficType('installs'),
  views: selectTrafficType('views'),
});

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
  selectPackageTraffic,
  makeSelectSearchText,
  makeSelectSignedIn,
  makeSelectUserName,
};
