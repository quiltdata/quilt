/* actions for SearchResults */
import {
  GET_SEARCH,
  GET_SEARCH_ERROR,
  GET_SEARCH_SUCCESS,
} from './constants';

export function getSearch(query) {
  return {
    type: GET_SEARCH,
    query,
  };
}

export function getSearchError(error) {
  return {
    type: GET_SEARCH_ERROR,
    error,
  };
}

export function getSearchSuccess(response) {
  return {
    type: GET_SEARCH_SUCCESS,
    response,
  };
}
