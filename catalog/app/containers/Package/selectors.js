import flow from 'lodash/flow';
import { createSelector } from 'reselect';

import { get, getIn, update, sortBy, map, toJS } from 'utils/immutableTools';

import { REDUX_KEY } from './constants';

export const comments = createSelector(
  getIn([REDUX_KEY, 'comments']),
  flow(
    update('response', flow(
      map(update('created', (c) => new Date(c * 1000))),
      sortBy(get('created')),
    )),
    toJS(),
  ),
);
