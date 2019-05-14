import { mount } from 'enzyme';
import fetchMock from 'fetch-mock';
import createHistory from 'history/createMemoryHistory';
import { fromJS } from 'immutable';
import React from 'react';

import configureStore from 'store';
import { nest } from 'utils/reactTools';
import StoreProvider from 'utils/StoreProvider';

import { HTTPError, apiRequest, Provider as APIProvider } from './APIConnector';

jest.mock('constants/config');


describe('utils/APIConnector', () => {
  describe('HTTPError', () => {
    it('should be constructed properly', () => {
      const resp = {
        status: '401',
        statusText: 'UNAUTHORIZED',
      };
      const text = 'Unauthorized';
      const json = { message: 'Unauthorized' };
      const jsonText = JSON.stringify(json);

      const e1 = new HTTPError(resp, text);

      expect(e1.response).toBe(resp);
      expect(e1.status).toBe(resp.status);
      expect(e1.text).toBe(text);
      expect(e1.json).toBeUndefined();
      expect(e1.message).toBe(resp.statusText);

      const e2 = new HTTPError(resp, jsonText);

      expect(e2.response).toBe(resp);
      expect(e2.status).toBe(resp.status);
      expect(e2.text).toBe(jsonText);
      expect(e2.json).toEqual(json);
      expect(e2.message).toBe(json.message);
    });
  });

  describe('Provider', () => {
    const base = 'https://api';
    const json = { message: 'ok' };

    const setup = () => {
      const history = createHistory({ initialEntries: ['/'] });
      const store = configureStore(fromJS({}), history);
      const request = (opts) => store.runSaga(apiRequest, opts).done;
      const fetch = fetchMock.sandbox();
      const tree = nest(
        [StoreProvider, { store }],
        [APIProvider, { fetch, base }],
        () => <h1>sup</h1>,
      );

      return { request, fetch, tree };
    };

    const jsonHeaders = {
      'Content-Type': 'application/json',
      Accepts: 'application/json',
    };

    describe('apiRequest', () => {
      let request;
      let fetch;

      beforeEach(() => {
        const ctx = setup();
        mount(ctx.tree);
        ({ request, fetch } = ctx);
      });

      describe('when called with a string argument', () => {
        it('should treat that argument as the `endpoint` option (prepend `base`)', async () => {
          fetch.getOnce({
            matcher: `${base}/test`,
            response: json,
            method: 'GET',
            name: 'test',
          });
          const res = await request('/test');
          expect(fetch.called('test')).toBe(true);
          expect(res).toEqual(json);
        });
      });

      describe('when called with `url` option', () => {
        it('should make a request to the absolute URL specified by that option', async () => {
          const url = 'http://not-api/test';
          fetch.getOnce({
            matcher: url,
            response: json,
            method: 'POST',
            name: 'test',
          });
          const res = await request({ url, method: 'POST' });
          expect(fetch.called('test')).toBe(true);
          expect(res).toEqual(json);
        });
      });

      describe('when called with JSON processing enabled (default)', () => {
        beforeEach(() => {
          fetch.get({
            matcher: `${base}/test`,
            response: json,
            name: 'test',
          });
        });

        it('should add JSON headers to the request', () => {
          request('/test');
          const opts = fetch.lastOptions('test');
          expect(opts.headers).toEqual(expect.objectContaining(jsonHeaders));
        });

        it('should parse the response', async () => {
          const res = await request('/test');
          expect(res).toEqual(json);
        });

        it('should stringify body when necessary', () => {
          const bodies = {
            string: 'string',
            fd: new FormData(),
            obj: { query: 'test' },
          };

          request({ endpoint: '/test', body: bodies.string });
          expect(fetch.lastOptions('test').body).toBe(bodies.string);

          request({ endpoint: '/test', body: bodies.fd });
          expect(fetch.lastOptions('test').body).toBe(bodies.fd);

          request({ endpoint: '/test', body: bodies.obj });
          expect(fetch.lastOptions('test').body).toBe(JSON.stringify(bodies.obj));
        });
      });

      describe('when called with json processing disabled', () => {
        let res;

        beforeEach(async () => {
          fetch.get({
            matcher: `${base}/test`,
            response: json,
            name: 'test',
          });

          res = await request({ endpoint: '/test', json: false });
        });

        it('should not add JSON headers to the request', () => {
          expect(fetch.lastOptions('test'))
            .not.toEqual(expect.objectContaining(jsonHeaders));
        });

        it('should return the response as is', async () => {
          expect(res).toBeInstanceOf(fetchMock.config.Response);
          const text = await res.text();
          expect(text).toBe(JSON.stringify(json));
        });
      });

      describe('when the response has error', () => {
        it('should throw an HTTPError', async () => {
          const status = 400;

          fetch.get({
            matcher: `${base}/test`,
            response: { body: json, status },
            name: 'test',
          });

          try {
            await request({ endpoint: '/test' });
            throw new Error('shouldnt be there');
          } catch (e) {
            expect(e).toBeInstanceOf(HTTPError);
            expect(e.message).toBe(json.message);
            expect(e.json).toEqual(json);
            expect(e.text).toBe(JSON.stringify(json));
            expect(e.status).toBe(status);
          }
        });
      });
    });
  });
});
