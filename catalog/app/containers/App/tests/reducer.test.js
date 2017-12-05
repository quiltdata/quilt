
import { fromJS } from 'immutable';
import appReducer from '../reducer';

describe('testReducer', () => {
  it('returns the initial state', () => {
    expect(appReducer(undefined, {})).toEqual(fromJS({}));
  });
});
