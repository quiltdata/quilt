import {
  GET_PACKAGES,
  GET_PACKAGES_ERROR,
  GET_PACKAGES_SUCCESS,
} from './constants';


export function getPackages(username) {
  return {
    type: GET_PACKAGES,
    username,
  };
}

export function getPackagesError(error) {
  return {
    type: GET_PACKAGES_ERROR,
    error,
  };
}

export function getPackagesSuccess(response) {
  return {
    type: GET_PACKAGES_SUCCESS,
    response,
  };
}
