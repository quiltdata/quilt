import { fromJS } from 'immutable';

import { REDUX_KEY } from '../constants';
import {
  selectLanguage,
} from '../selectors';

describe('selectLanguage', () => {
  it('should select the global state', () => {
    const globalState = fromJS({});
    const mockedState = fromJS({
      [REDUX_KEY]: globalState,
    });
    expect(selectLanguage(mockedState)).toEqual(globalState);
  });
});
