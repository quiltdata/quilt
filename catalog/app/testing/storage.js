import { step } from 'testing/feature';

export default (datasets, objects) => [
  step(/storage has (.+) data/, (ctx, name) => ({
    ...ctx,
    storage: {
      set: jest.fn(),
      remove: jest.fn(),
      load: jest.fn(() => datasets[name]),
    },
  })),

  step(/(.+) should be stored/, (ctx, name) => {
    const { key, value } = objects[name];
    expect(ctx.storage.set).toBeCalledWith(key, value);
  }),

  step(/(.+) should be removed from storage/, (ctx, name) => {
    const { key } = objects[name];
    expect(ctx.storage.remove).toBeCalledWith(key);
  }),
];
