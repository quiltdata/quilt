/**
 * Test store addons
 */

import { browserHistory } from 'react-router';
import configureStore from '../store';

describe('configureStore', () => {
  let store;

  beforeAll(() => {
    store = configureStore({}, browserHistory);
  });

  describe('injectReducer', () => {
    it('should contain a hook for `reducerRegistry.set`', () => {
      expect(typeof store.injectReducer).toBe('function');
    });
  });

  describe('runSaga', () => {
    it('should contain a hook for `sagaMiddleware.run`', () => {
      expect(typeof store.runSaga).toBe('function');
    });
  });
});
