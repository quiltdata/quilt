import invariant from 'invariant';

const scope = 'utils/RequestTracker';

export const Pending = Symbol(`${scope}/Pending`);
export const Resolved = Symbol(`${scope}/Resolved`);
export const Rejected = Symbol(`${scope}/Rejected`);

export default (mockedRequest) => {
  const requests = [];

  const handleRequest = (url, opts = {}) => {
    const { method = 'GET' } = opts;

    let dfd;
    const result = new Promise((resolve, reject) => {
      dfd = { resolve, reject };
    });

    requests.push({
      method,
      url,
      opts,
      ...dfd,
      state: Pending,
    });

    return result;
  };

  mockedRequest.mockImplementation(handleRequest);

  const getFirstPendingRequest = (method, url) =>
    requests.find((r) =>
      r.state === Pending && r.method === method && r.url === url);

  const resolveRequest = (method, url, result) => {
    const innerScope = `${scope}/resolveRequest`;
    const r = getFirstPendingRequest(method, url);
    invariant(r, `${innerScope}: no matching pending requests for ${method} ${url}`);
    r.resolve(result);
    r.state = Resolved;
    return instance;
  };

  const rejectRequest = (method, url, error) => {
    const innerScope = `${scope}/rejectRequest`;
    const r = getFirstPendingRequest(method, url);
    invariant(r, `${innerScope}: no matching pending requests for ${method} ${url}`);
    r.reject(error);
    r.state = Rejected;
    return instance;
  };

  const findRequests = (method, url, predicate = () => true) =>
    requests.filter((r) =>
      r.method === method && r.url === url && predicate(r));

  const hasRequest = (...args) => findRequests(...args).length >= 1;

  const instance = {
    requests,
    findRequests,
    hasRequest,
    resolve: resolveRequest,
    reject: rejectRequest,
  };

  return instance;
};
