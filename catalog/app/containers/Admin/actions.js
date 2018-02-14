/*
 *
 * Admin actions
 *
 */

import api from 'constants/api';
import {
  GET_MEMBERS,
  GET_MEMBERS_RESPONSE,
  GET_PACKAGES,
  GET_PACKAGES_RESPONSE,
} from './constants';

export const getMembers = () => ({
  type: GET_MEMBERS,
});

export const getMembersResponse = (status, response) => ({
  type: GET_MEMBERS_RESPONSE,
  status,
  response,
});

export const getMembersSuccess = (response) => getMembersResponse(api.SUCCESS, response);
export const getMembersError = (response) => getMembersResponse(api.ERROR, response);

export const getPackages = () => ({
  type: GET_PACKAGES,
});

export const getPackagesResponse = (status, response) => ({
  type: GET_PACKAGES_RESPONSE,
  status,
  response,
});

export const getPackagesSuccess = (response) => getPackagesResponse(api.SUCCESS, response);
export const getPackagesError = (response) => getPackagesResponse(api.ERROR, response);
