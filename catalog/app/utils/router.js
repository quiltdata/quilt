import { Map } from 'immutable';
import { ConnectedRouter, LOCATION_CHANGE } from 'react-router-redux';
import { combineReducers } from 'redux-immutable';
import { createSelector } from 'reselect';

import { get } from 'utils/immutableTools';
import { composeComponent } from 'utils/reactTools';
import { injectReducer } from 'utils/ReducerInjector';

/*
 * route reducer
 *
 * The reducer merges route location changes into our immutable state.
 * The change is necessitated by moving to react-router-redux@5
 *
 */

export const REDUX_KEY = 'router';

export const selectRouterDomain = (state) => state.get(REDUX_KEY, Map({}));

export const selectLocation = createSelector(selectRouterDomain, get('location', null));

export const reducer = combineReducers({
  location: (state = null, action) => {
    switch (action.type) {
      case LOCATION_CHANGE:
        return action.payload;
      default:
        return state;
    }
  },
});

export default composeComponent('RouterProvider',
  injectReducer(REDUX_KEY, reducer),
  ConnectedRouter);
