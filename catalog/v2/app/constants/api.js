import PT from 'prop-types';


/* constants for API calls */
const status = {
  ERROR: 'API_ERROR',
  SUCCESS: 'API_SUCCESS',
  WAITING: 'API_WAITING',
};

Object.freeze(status);

export default status;

export const apiStatus = PT.oneOf(Object.values(status));
