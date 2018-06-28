import { step } from 'testing/feature';

import {
  tokens,
  user,
  dataSets,
} from './fixtures';


export default [
  step(/storage has (current|stale|empty) auth data/, (ctx, dataSet) => ({
    ...ctx,
    storage: {
      set: jest.fn(),
      remove: jest.fn(),
      load: jest.fn(() => dataSets[dataSet]),
    },
  })),

  step(/tokens should be stored/, (ctx) => {
    expect(ctx.storage.set).toBeCalledWith('tokens', tokens);
  }),

  step(/user data should be stored/, (ctx) => {
    expect(ctx.storage.set).toBeCalledWith('user', user);
  }),

  step(/tokens should be destroyed/, (ctx) => {
    expect(ctx.storage.remove).toBeCalledWith('tokens');
  }),

  step(/user data should be destroyed/, (ctx) => {
    expect(ctx.storage.remove).toBeCalledWith('user');
  }),
];
