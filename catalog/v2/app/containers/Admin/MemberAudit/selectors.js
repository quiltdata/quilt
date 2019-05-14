import flow from 'lodash/flow';
import { createSelector } from 'reselect';

import { get, update, sortBy, toJS } from 'utils/immutableTools';

import { REDUX_KEY } from './constants';

export default () => createSelector(
  get(REDUX_KEY),
  flow(
    update('response', sortBy((e) => -e.get('time'))),
    toJS(),
  ),
);
