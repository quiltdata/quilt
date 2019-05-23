import { fromJS as iFromJS } from 'immutable'

export const invoke = (method) => (...args) => (obj) =>
  obj && method in obj ? obj[method](...args) : obj

// TODO: more helpers
export const get = invoke('get')
export const getIn = invoke('getIn')
export const update = invoke('update')
export const updateIn = invoke('updateIn')
export const remove = invoke('remove')
export const removeIn = invoke('removeIn')
export const sortBy = invoke('sortBy')
export const push = invoke('push')
export const map = invoke('map')
export const toJS = invoke('toJS')
export const fromJS = (...args) => (obj) => iFromJS(obj, ...args)
