import { fromJS } from 'immutable';
import { composeHandlers } from 'utils/reduxTools';

import api from 'constants/api';

import { actions } from './constants';


const initial = {
  status: null,
  response: null,
};

export default composeHandlers(fromJS(initial), {
  [actions.GET]: {
    status: (p) => p.name ? api.WAITING : null,
    response: null,
  },

  [actions.GET_RESPONSE]: {
    status: (p) => p.status,
    response: (p) => fromJS(p.response),
  },
});
