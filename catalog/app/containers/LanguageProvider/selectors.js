import { createSelector } from 'reselect';

import { REDUX_KEY } from './constants';

/**
 * Direct selector to the languageToggle state domain
 */
const selectLanguage = (state) => state.get(REDUX_KEY);

/**
 * Select the language locale
 */

const makeSelectLocale = () => createSelector(
  selectLanguage,
  (languageState) => languageState.get('locale')
);

export {
  selectLanguage,
  makeSelectLocale,
};
