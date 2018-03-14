import { fromJS } from 'immutable';
import profileReducer from '../reducer';

jest.mock('constants/config', () => ({}));

describe('profileReducer', () => {
  it('returns the initial state', () => {
    expect(profileReducer(undefined, {})).toEqual(fromJS({}));
  });
});
