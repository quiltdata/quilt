import fetchMock from 'fetch-mock';

import defer from 'utils/defer';
import { step } from 'testing/feature';
import { flushPromises } from 'testing/util';


const defaultSuccess = () => ({ sendAsJson: false });

/**
 * Create a set of steps for testing API requests.
 *
 * @param {string} api The API root url.
 * @param {Object[]} requests Request definitions
 *
 * @returns {feature.step[]}
 */
export default (api, requests) => [
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

  step(/(.+) request should( not)? be made/, (ctx, name, not) => {
    expect(fetchMock.called(name)).toBe(!not);
    if (!not) {
      const expectation = requests[name].expect;
      if (expectation) {
        expect(fetchMock.lastOptions(name)).toEqual(expectation(ctx));
      }
    }
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

  step(/(.+) request fails with (\d+), (.+): "(.+)"/, async (ctx, name, statusStr, key, error) => {
    const status = parseInt(statusStr, 10);
    ctx.requestResolvers[name]({ status, body: { [key]: error } });
    await flushPromises();
  }),

  step(/(.+) request fails with (\d+), "(.+)"/, async (ctx, name, statusStr, body) => {
    const status = parseInt(statusStr, 10);
    ctx.requestResolvers[name]({ status, body });
    await flushPromises();
  }),
];
