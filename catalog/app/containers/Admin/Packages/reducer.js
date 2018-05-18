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
    status: api.WAITING,
    response: null,
  },

  [actions.GET_RESPONSE]: {
    status: (p) => p.status,
    response: (p) => fromJS(p.response),
  },
}));
