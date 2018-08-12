// @flow

import {
  fromJS as iFromJS,
  type KeyedCollection,
} from 'immutable';

type FnMap = { [method: string]: (...args: any) => any };

export const invoke = (method: string) => (...args: any) =>
  (obj: ?(KeyedCollection<string, any> & FnMap)): any => {
    if (obj == null) return undefined;
    if (obj[method] && typeof obj[method] === 'function') {
      return obj[method](...args);
    }
    return undefined;
  };

// TODO: more helpers
export const get = invoke('get');
export const getIn = invoke('getIn');
export const update = invoke('update');
export const updateIn = invoke('updateIn');
export const remove = invoke('remove');
export const removeIn = invoke('removeIn');
export const sortBy = invoke('sortBy');
export const push = invoke('push');
export const map = invoke('map');
export const toJS = invoke('toJS');
export const fromJS = (...args: any) => (obj: mixed) => iFromJS(obj, ...args);
