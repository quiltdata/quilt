import fetchMock from 'fetch-mock';

import defer from 'utils/defer';
import { step } from 'testing/feature';
import { flushPromises } from 'testing/util';

import { api } from './fixtures';


const defaultSuccess = () => ({ sendAsJson: false });

export default (requests) => [
  step(/(.+) request is expected/, (ctx, name) => {
    const results = [];
    const resolve = (res) =>
      results[results.length - 1].resolver.resolve(res);
    const respond = () => {
      const result = defer();
      results.push(result);
      return result.promise;
    };

    const [method, endpoint, opts] = requests[name].setup(ctx);
    fetchMock[method](`${api}${endpoint}`, respond, { name, ...opts });

    return {
      ...ctx,
      requestResolvers: {
        ...ctx.requestResolvers,
        [name]: resolve,
      },
      requests: (ctx.requests || 0) + 1,
    };
  }, (ctx) => {
    if (ctx.requests === 1) fetchMock.restore();
  }),

  step(/(.+) request should be made/, (ctx, name) => {
    expect(fetchMock.called(name)).toBe(true);
    expect(fetchMock.lastOptions(name)).toEqual(requests[name].expect(ctx));
  }),

  step(/(.+) request succeeds/, async (ctx, name) => {
    const result = (requests[name].success || defaultSuccess)(ctx);
    ctx.requestResolvers[name](result);
    await flushPromises();
    return {
      ...ctx,
      requestResults: {
        ...ctx.requestResults,
        [name]: result,
      },
    };
  }),

  step(/(.+) request fails with (\d+)$/, async (ctx, name, statusStr) => {
    const status = parseInt(statusStr, 10);
    ctx.requestResolvers[name]({ status, body: '' });
    await flushPromises();
  }),

  step(/(.+) request fails with (\d+), error: "(.+)"/, async (ctx, name, statusStr, error) => {
    const status = parseInt(statusStr, 10);
    ctx.requestResolvers[name]({ status, body: { error } });
    await flushPromises();
  }),

  step(/(.+) request fails with (\d+), "(.+)"/, async (ctx, name, statusStr, body) => {
    const status = parseInt(statusStr, 10);
    ctx.requestResolvers[name]({ status, body });
    await flushPromises();
  }),
];
