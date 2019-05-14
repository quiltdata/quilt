import { step } from 'testing/feature';

/**
 * Create a set of steps for testing redux stuff.
 *
 * @param {object} options
 *
 * @param {object} options.dispatches
 *
 * @param {object} options.selector
 *
 * @param {object} options.states
 *
 * @returns {feature.step[]}
 */
export default ({ dispatches, selector, states }) => [
  step(/store should be in (.+) state(.*)$/, (ctx, state, suffix) => {
    const key = state + suffix;
    if (!(key in states)) {
      throw new Error(`State not found: '${key}'`);
    }
    expect(selector(ctx.store.getState())).toEqual(states[key]);
  }),

  step(/(.*) action is dispatched/, (ctx, type) => {
    const action = dispatches[type](ctx);
    ctx.store.dispatch(action);
    const actions = (ctx.actions || []).concat(action);
    return { ...ctx, actions, action };
  }),
];
