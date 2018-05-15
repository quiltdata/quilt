import { mount } from 'enzyme';
import invariant from 'invariant';

import { step } from 'testing/feature';

const scope = 'testing/steps/react';

export default [
  step(/the component tree is mounted/, (ctx) => {
    const innerScope = `${scope}: mount`;
    invariant(ctx.tree, `${innerScope}: expected context to have a "tree" prop`);

    return {
      ...ctx,
      mounted: mount(ctx.tree),
    };
  }),
];
