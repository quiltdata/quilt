export const Loading = Symbol('loading')

export type Maybe<T> = T | null

// `T` is the value
// `undefined` is no value. It is not loaded or doesn't exist in loaded data
// `Loading` is loading
// `Error` is error
export type Data<T> = T | undefined | typeof Loading | Error

export interface DataController<T> {
  data: Data<T>
  loadMore: () => void
}

export interface List<T> {
  list: T[]
  next?: string
}

// `T` is the value
// `null` is no value, explicitly set by user
// `undefined` is no value. It is not loaded or doesn't exist in loaded data
// `Loading` is loading
// `Error` is error
export type Value<T> = Maybe<Data<T>>

export interface ValueController<T> {
  value: Value<T>
  setValue: (v: T | null) => void
}

// Data is loaded
// or value is set to actual value
export function hasData<T>(value: Value<T>): value is T {
  if (
    value === undefined ||
    value === Loading ||
    value instanceof Error ||
    value === null
  ) {
    return false
  }
  return true
}

// No value yet, value or data was just initialized
export function isNone<T>(value: Value<T>): value is undefined {
  return value === undefined
}

// Data is loading, or value is waiting for data
export function isLoading<T>(value: Value<T>): value is typeof Loading {
  return value === Loading
}

export function isError<T>(value: Value<T>): value is Error {
  return value instanceof Error
}

// Value is selected with some or no value, or resolved with error
// Or, data is loaded
export function isReady<T>(value: Value<T>): value is T | null | Error {
  if (value === undefined || value === Loading) {
    return false
  }
  return true
}

// Value is selected with some or no value
// Or, data is loaded successfully
export function hasValue<T>(value: Value<T>): value is T | null {
  if (value === undefined || value === Loading || value instanceof Error) {
    return false
  }
  return true
}

// User explicitly set no value
export function isNoneSelected<T>(value: Value<T>): value is null {
  return value === null
}
