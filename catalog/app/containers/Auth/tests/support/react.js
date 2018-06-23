import { mount } from 'enzyme';

import { step } from 'testing/feature';

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
