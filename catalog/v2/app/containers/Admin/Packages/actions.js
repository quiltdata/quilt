import api from 'constants/api';

import { actions } from './constants';


export const get = () => ({
  type: actions.GET,
});

export const getResponse = (status, response) => ({
  type: actions.GET_RESPONSE,
  payload: { status, response },
});

export const getSuccess = (response) => getResponse(api.SUCCESS, response);
export const getError = (response) => getResponse(api.ERROR, response);
