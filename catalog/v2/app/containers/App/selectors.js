/* App selectors */
import { Map } from 'immutable';
import { createSelector, createStructuredSelector } from 'reselect';

import { getIn, toJS } from 'utils/immutableTools';
import { REDUX_KEY } from './constants';

export const selectPackage = createSelector(
  getIn([REDUX_KEY, 'package'], Map({})),
  toJS(),
);

export const selectPackageSummary = createStructuredSelector({
  owner: getIn([REDUX_KEY, 'package', 'response', 'created_by']),
  hash: getIn([REDUX_KEY, 'package', 'response', 'hash']),
  name: getIn([REDUX_KEY, 'package', 'name']),
});

const frequencies = {
  week: 1000 * 60 * 60 * 24 * 7,
};

const selectTrafficType = (type) => createSelector(
  getIn([REDUX_KEY, 'package', 'traffic', 'response']),
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

export const selectPackageTraffic = createStructuredSelector({
  installs: selectTrafficType('installs'),
  views: selectTrafficType('views'),
});

export const selectSearchText = createSelector(
  getIn([REDUX_KEY, 'searchText'], ''),
  (txt) => txt,
);
