declare module 'redux-immutable' {
  import type { Reducer } from 'redux'

  export function combineReducers(
    reducers: { [key: string]: Reducer<any, any> },
    getDefaultState?: (...args: any[]) => any,
  ): Reducer<any, any>
}
