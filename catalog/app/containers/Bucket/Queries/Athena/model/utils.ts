export type InitState = { _tag: 'init' }
export const Init: InitState = { _tag: 'init' }

export type PendingState = { _tag: 'loading' }
export const Pending: PendingState = { _tag: 'loading' }

export type ErrState = { _tag: 'error'; error: Error }
export const Err = (error: unknown): ErrState => ({
  _tag: 'error',
  error: error instanceof Error ? error : new Error(`${error}`),
})

export type NoneState = { _tag: 'none' }
export const None: NoneState = { _tag: 'none' }

export type PayloadState<T> = { _tag: 'data'; data: T }
export const Payload = <T>(data: T): PayloadState<T> => ({ _tag: 'data', data })

export type Data<T> = PayloadState<T> | InitState | PendingState | ErrState

export interface DataController<T> {
  data: Data<T>
  loadMore: () => void
}

export function wrapData<T>(data: Data<T>, setPrev: (d: T) => void): DataController<T> {
  return {
    data,
    loadMore: () => isDataState(data) && setPrev(data.data),
  }
}

export interface List<T> {
  list: T[]
  next?: string
}

export type Value<T> = Data<T> | NoneState

// Ready values (excluding loading states)
export type ValueReady<T> = Exclude<Value<T>, InitState | PendingState | ErrState>

export interface ValueController<T> {
  value: Value<T>
  setValue: (v: ValueReady<T>) => void
}

export function wrapValue<T>(
  value: Value<T>,
  setValue: (d: ValueReady<T>) => void,
): ValueController<T> {
  return {
    value,
    setValue,
  }
}

/** Check if value is DataState */
export function isDataState<T>(value: Data<T>): value is PayloadState<T> {
  return (value as any)?._tag === 'data'
}

/** Data is loaded - for Data<T> use isDataState, for Value<T> this checks if it's actual data */
export function hasData<T>(value: Value<T>): value is PayloadState<T> {
  return isDataState(value as Data<T>)
}

/** No value yet: value or data was just initialized */
export function isInit<T>(value: Value<T>): value is InitState {
  return (value as any)?._tag === 'init'
}

/** User explicitly set no value */
export function isNone<T>(value: Value<T>): value is NoneState {
  return (value as any)?._tag === 'none'
}

/** Data is loading, or value is waiting for data */
export function isLoading<T>(value: Value<T>): value is PendingState {
  return (value as any)?._tag === 'loading'
}

export function isError<T>(value: Value<T>): value is ErrState {
  return (value as any)?._tag === 'error'
}

/** Value is selected with some or no value, or resolved with error, or data is loaded (successfully or not) */
export function isReady<T>(
  value: Value<T>,
): value is PayloadState<T> | NoneState | ErrState {
  if (isInit(value) || isLoading(value)) {
    return false
  }
  return true
}

/** Value is selected with some or no value, or data is loaded successfully */
export function hasValue<T>(value: Value<T>): value is PayloadState<T> | NoneState {
  if (isInit(value) || isLoading(value) || isError(value)) {
    return false
  }
  return true
}

/** User explicitly set no value */
export function isNoneSelected<T>(value: Value<T>): value is NoneState {
  return isNone(value)
}
