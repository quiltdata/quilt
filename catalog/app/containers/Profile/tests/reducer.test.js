
import { fromJS } from 'immutable';
import profileReducer from '../reducer';

describe('profileReducer', () => {
  it('returns the initial state', () => {
    expect(profileReducer(undefined, {})).toEqual(fromJS({}));
  });
});
