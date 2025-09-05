type InitState = { _tag: 'init' }
export const Init: InitState = { _tag: 'init' }

type PendingState = { _tag: 'pending' }
export const Pending: PendingState = { _tag: 'pending' }

type ErrState = { _tag: 'error'; error: Error }
export const Err = (error: unknown): ErrState => ({
  _tag: 'error',
  error: error instanceof Error ? error : new Error(`${error}`),
})

type NoneState = { _tag: 'none'; data: null }
export const None: NoneState = { _tag: 'none', data: null }

type PayloadState<T> = { _tag: 'data'; data: T }
export const Payload = <T>(data: T): PayloadState<T> => ({ _tag: 'data', data })

export type Data<T> = PayloadState<T> | InitState | PendingState | ErrState

export interface DataController<T> {
  data: Data<T>
  loadMore: () => void
}

export function wrapData<T>(data: Data<T>, setPrev: (d: T) => void): DataController<T> {
  return {
    data,
    loadMore: () => data._tag === 'data' && setPrev(data.data),
  }
}

export interface List<T> {
  list: T[]
  next?: string
}

export type Value<T> = Data<T> | NoneState

type ValueOrNone<T> = Extract<Value<T>, { data: any }>

export interface ValueController<T> {
  value: Value<T>
  setValue: (v: ValueOrNone<T>) => void
}

export function wrapValue<T>(
  value: Value<T>,
  setValue: (d: ValueOrNone<T>) => void,
): ValueController<T> {
  return {
    value,
    setValue,
  }
}

/** Check if value is DataState */
// export function isDataState<T>(value: Data<T>): value is PayloadState<T> {
//   return value._tag === 'data'
// }

/** Data is loaded - for Data<T>, for Value<T> this checks if it's actual data and not `null` */
export function hasData<T>(value: Value<T>): value is PayloadState<T> {
  return value._tag === 'data'
}

/** No value yet: value or data was just initialized */
export function isInit<T>(value: Value<T>): value is InitState {
  return value._tag === 'init'
}

/** User explicitly set no value */
export function isNone<T>(value: Value<T>): value is NoneState {
  return value._tag === 'none'
}

/** Data is pending, or value is waiting for data */
// export function isPending<T>(value: Value<T>): value is PendingState {
//   return value._tag === 'pending'
// }

export function isError<T>(value: Value<T>): value is ErrState {
  return value._tag === 'error'
}

/** Value is selected with some or no value, or resolved with error, or data is loaded (successfully or not) */
export function isReady<T>(
  value: Value<T>,
): value is PayloadState<T> | NoneState | ErrState {
  return value._tag === 'none' || value._tag === 'data' || value._tag === 'error'
}

/** Value is selected with some or no value, or data is loaded successfully */
export function hasValue<T>(value: Value<T>): value is PayloadState<T> | NoneState {
  return value._tag === 'none' || value._tag === 'data'
}

/** User explicitly set no value */
// export function isNoneSelected<T>(value: Value<T>): value is NoneState {
//   return value._tag === 'none'
// }
