import { mount } from 'enzyme';

import { step } from 'testing/feature';

/**
 * Create a set of steps for testing react components.
 *
 * @param {object} options
 *
 * @param {function} options.setup
 *   A setup function, which receives the context and should return an object
 *   containing the `tree` prop. This object is merged into the context.
 *
 * @param {object} options.screens
 *   A map of assertion functions. Those functions receive rendered html and
 *   the context and should throw assertion error if the rendered tree
 *   doesn't satisfy expectations.
 *
 * @returns {feature.step[]}
 */
export default ({ setup, screens }) => [
  step(/the component tree is mounted/, (ctx) => {
    const { tree, ...rest } = setup(ctx);
    return { ...ctx, ...rest, mounted: mount(tree) };
  }),

  step(/the rendered markup should match the snapshot/, (ctx) => {
    expect(ctx.mounted.render()).toMatchSnapshot();
  }),

  step(/I should see the (.+) screen/, (ctx, screen) => {
    if (!(screen in screens)) throw new Error(`screen not found: '${screen}'`);
    screens[screen](ctx.mounted.render(), ctx);
  }),
];
