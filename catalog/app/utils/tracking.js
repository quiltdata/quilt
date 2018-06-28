import { takeEvery, select } from 'redux-saga/effects';

const loadMixpanel = (token) =>
  import('mixpanel-browser')
    .then((mp) => {
      mp.init(token);
      return mp;
    });

const consoleTracker = Promise.resolve({
  // eslint-disable-next-line no-console
  track: (evt, opts) => console.log(`track: ${evt}`, opts),
});

export const mkTracker = (token) => {
  const tracker = token ? loadMixpanel(token) : consoleTracker;

  return {
    nav: (loc, user) => tracker.then((inst) =>
    // use same distinct_id as registry for event attribution
    // else undefined to let mixpanel decide
      inst.track('WEB', {
        type: 'navigation',
        distinct_id: user || undefined,
        origin: window.location.origin,
        location: `${loc.pathname}${loc.search}${loc.hash}`,
        user,
      })),
  };
};

export default function* tracking({
  selectUsername,
  locationChangeAction,
  token,
}) {
  const tracker = mkTracker(token);
  yield takeEvery(locationChangeAction, function* onLocationChange({ payload: location }) {
    const user = yield select(selectUsername);
    tracker.nav(location, user);
  });
}
