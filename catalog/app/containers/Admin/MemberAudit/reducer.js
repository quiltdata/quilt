import { fromJS } from 'immutable';
import { withInitialState, handleActions } from 'utils/reduxTools';

import api from 'constants/api';

import { actions } from './constants';


const initial = {
  status: null,
  response: null,
};

export default withInitialState(fromJS(initial), handleActions({
  [actions.GET]: {
    status: (p) => p.name ? api.WAITING : null,
    response: null,
  },

  [actions.GET_RESPONSE]: {
    status: (p) => p.status,
    response: (p) => fromJS(p.response),
  },
}));
