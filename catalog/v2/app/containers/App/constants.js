/* App constants */
import { fromJS } from 'immutable';


// user object prevents authBarSelector from failing on startup
export const initialState = fromJS({});

export const DEFAULT_LOCALE = 'en';

// TODO: move to config
export const intercomAppId = 'eprutqnr';

export const REDUX_KEY = 'app/App';

export const GET_LOG = 'app/Profile/GET_LOG';
export const GET_LOG_ERROR = 'app/Profile/GET_LOG_ERROR';
export const GET_LOG_SUCCESS = 'app/Profile/GET_LOG_SUCCESS';

export const GET_PACKAGE = 'app/App/GET_PACKAGE';
export const GET_PACKAGE_ERROR = 'app/App/GET_PACKAGE_ERROR';
export const GET_PACKAGE_SUCCESS = 'app/App/GET_PACKAGE_SUCCESS';

export const GET_MANIFEST = 'app/App/GET_MANIFEST';
export const GET_MANIFEST_ERROR = 'app/App/GET_MANIFEST_ERROR';
export const GET_MANIFEST_SUCCESS = 'app/App/GET_MANIFEST_SUCCESS';

export const GET_TRAFFIC = 'app/App/GET_TRAFFIC';
export const GET_TRAFFIC_RESPONSE = 'app/App/GET_TRAFFIC_RESPONSE';

export const SET_SEARCH_TEXT = 'app/App/SET_SEARCH_TEXT';

export const START = 'app/App/START';
