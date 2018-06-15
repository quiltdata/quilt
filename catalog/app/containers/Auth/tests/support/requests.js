import fetchMock from 'fetch-mock';

import defer from 'utils/defer';
import { step } from 'testing/feature';
import { flushPromises } from 'testing/util';

import { tokens, tokensRaw, tokensStale, user, api } from './fixtures';


const requests = {
  signUp: {
    setup: () => ['postOnce', '/register'],
    expect: (ctx) =>
      expect.objectContaining({
        body: JSON.stringify(ctx.credentials),
      }),
  },
  resetPassword: {
    setup: () => ['postOnce', '/reset_password'],
    expect: ({ email }) =>
      expect.objectContaining({
        body: JSON.stringify({ email }),
      }),
  },
  changePassword: {
    setup: () => ['postOnce', '/reset_password'],
    expect: ({ link, password }) =>
      expect.objectContaining({
        body: JSON.stringify({ link, password }),
      }),
  },
  getCode: {
    setup: () => ['getOnce', '/api/code'],
    expect: () =>
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${tokens.token}`,
        }),
      }),
    success: () => ({ code: 'the code' }),
  },
  refreshTokens: {
    setup: () => ['postOnce', '/api/refresh'],
    expect: () =>
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${tokensStale.token}`,
        }),
      }),
    success: () => tokensRaw,
  },
  signIn: {
    setup: () => ['postOnce', '/login'],
    expect: (ctx) =>
      expect.objectContaining({
        body: JSON.stringify(ctx.credentials),
      }),
    success: () => tokensRaw,
  },
  fetchUser: {
    setup: () => ['getOnce', '/api-root'],
    expect: () =>
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${tokens.token}`,
        }),
      }),
    success: () => user,
  },
  signOut: {
    setup: () => ['postOnce', '/logout'],
    expect: () =>
      expect.objectContaining({
        body: JSON.stringify({ token: tokens.token }),
        headers: expect.objectContaining({
          Authorization: `Bearer ${tokens.token}`,
        }),
      }),
  },
};


const defaultSuccess = () => ({ sendAsJson: false });

export default [
  step(/(.+) request is expected/, (ctx, name) => {
    const result = defer();
    const [method, endpoint] = requests[name].setup(ctx);
    fetchMock[method](`${api}${endpoint}`, result.promise, { name });
    return {
      ...ctx,
      requestResolvers: {
        ...ctx.requestResolvers,
        [name]: result.resolver.resolve,
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
