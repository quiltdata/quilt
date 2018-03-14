import { fromJS } from 'immutable';
import id from 'lodash/identity';
import { composeHandlers } from 'utils/reduxTools';

import api from 'constants/api';
import { push } from 'utils/immutableTools';

import { actions } from './constants';


const initial = {
  status: null,
  response: null,
};

const updateMember = (name, k, v) => (members) => {
  if (!members.findIndex) return members;
  const idx = members.findIndex((m) => m.get('name') === name);
  if (idx === -1) return members;
  return members.setIn([idx, k], v);
};

export default composeHandlers(fromJS(initial), {
  [actions.ADDED]: {
    response: (p) => push(fromJS(p)),
  },

  [actions.GET]: {
    status: api.WAITING,
    response: null,
  },

  [actions.GET_RESPONSE]: {
    status: (p) => p.status,
    response: (p) => fromJS(p.response),
  },

  [actions.DISABLE_RESPONSE]: {
    response: (p) =>
      p.status === api.ERROR ? id : updateMember(p.name, 'status', 'disabled'),
  },

  [actions.ENABLE_RESPONSE]: {
    response: (p) =>
      p.status === api.ERROR ? id : updateMember(p.name, 'status', 'active'),
  },
});
