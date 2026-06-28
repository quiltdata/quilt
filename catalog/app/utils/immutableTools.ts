// TODO: deprecate
import { fromJS as iFromJS } from 'immutable'

/**
 * Create a point-free helper that invokes `method` on its eventual `obj`
 * argument, passing along any args. If `obj` is falsy or lacks the method it is
 * returned unchanged.
 */
export const invoke =
  (method: string) =>
  (...args: any[]) =>
  (obj: any): any =>
    obj && method in obj ? obj[method](...args) : obj

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
export const fromJS =
  (...args: any[]) =>
  (obj: any): any =>
    iFromJS(obj, ...args)
