// @flow

import mapValues from 'lodash/mapValues';


type Method<State, Args, Out> = (state: State) => BoundMethod<Args, Out>;

type BoundMethod<Args, Out> = (...args: Args) => Out;

type MethodMap<State> = { [name: string]: Method<State, any, any> };

type ExtractMethod<State> = <Args, Out>(
  method: Method<State, Args, Out>
) => BoundMethod<Args, Out>;

type Instance<State, Methods: MethodMap<State>> = $ObjMap<Methods, ExtractMethod<State>>;

type Constructor<State, Methods: MethodMap<State>> =
  (state: State) => Instance<State, Methods>;

/**
 * Create a constructor.
 */
export default <State, Methods: MethodMap<State>>(
  /**
   * Instance methods of the constructed object.
   */
  methods: Methods,
): Constructor<State, Methods> =>
  (state) => mapValues(methods, (m) => m(state));
