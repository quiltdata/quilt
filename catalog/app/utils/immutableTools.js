export const invoke = (method) => (...args) => (obj) =>
  obj && method in obj ? obj[method](...args) : obj;

// TODO: more helpers
export const get = invoke('get');
export const getIn = invoke('getIn');
export const update = invoke('update');
export const updateIn = invoke('updateIn');
export const sortBy = invoke('sortBy');
export const push = invoke('push');
export const toJS = invoke('toJS');
