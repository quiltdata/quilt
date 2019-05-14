import get from 'lodash/get';

import { step } from 'testing/feature';

/**
 * Create a set of steps to test function calls.
 *
 * @param {object} argumentsMap
 *   A map of arguments assertion functions which receive the context as an
 *   argument and should return an array of expected call arguments.
 *
 * @returns {feature.step[]}
 */
export default (argumentsMap) => [
  step(/(.+) should be called$/, (ctx, path) => {
    expect(get(ctx, path)).toBeCalled();
  }),

  step(/(.+) should not be called$/, (ctx, path) => {
    expect(get(ctx, path)).not.toBeCalled();
  }),

  step(/(.+) should be called with (.*)$/, (ctx, path, name) => {
    if (!(name in argumentsMap)) {
      throw new Error(`Arguments not found for '${name}'`);
    }
    expect(get(ctx, path)).toBeCalledWith(...argumentsMap[name](ctx));
  }),
];
