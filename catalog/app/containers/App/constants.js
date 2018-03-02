/* App constants */
import { fromJS } from 'immutable';


export const authenticatedRoutes = [
  '/profile',
];
Object.freeze(authenticatedRoutes);

// user object prevents authBarSelector from failing on startup
export const initialState = fromJS({});

export const DEFAULT_LOCALE = 'en';

export const intercomAppId = 'eprutqnr';

// DEBUG - 10 second expiry
// export const LATENCY_SECONDS = 35990;
export const LATENCY_SECONDS = 20;

export const REDUX_KEY = 'app/App';

export const GET_AUTH = 'app/App/GET_AUTH';
export const GET_AUTH_ERROR = 'app/App/GET_AUTH_ERROR';
export const GET_AUTH_SUCCESS = 'app/App/GET_AUTH_SUCCESS';

export const GET_PACKAGE = 'app/App/GET_PACKAGE';
export const GET_PACKAGE_ERROR = 'app/App/GET_PACKAGE_ERROR';
export const GET_PACKAGE_SUCCESS = 'app/App/GET_PACKAGE_SUCCESS';

export const GET_MANIFEST = 'app/App/GET_MANIFEST';
export const GET_MANIFEST_ERROR = 'app/App/GET_MANIFEST_ERROR';
export const GET_MANIFEST_SUCCESS = 'app/App/GET_MANIFEST_SUCCESS';

export const NO_OP = 'app/App/NO_OP';
export const REFRESH_AUTH = 'app/App/REFRESH_AUTH';
export const ROUTER_START = 'app/App/ROUTER_START';
export const SET_SEARCH_TEXT = 'app/App/SET_SEARCH_TEXT';
export const SIGN_OUT = 'app/App/SIGN_OUT';
export const STORE_TOKENS = 'app/App/STORE_TOKENS';
