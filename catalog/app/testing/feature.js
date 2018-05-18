import dropWhile from 'lodash/dropWhile';
import pipe from 'lodash/flow';
import initial from 'lodash/initial';
import last from 'lodash/last';
import mapValues from 'lodash/mapValues';
import memoize from 'lodash/memoize';
import takeWhile from 'lodash/takeWhile';

const scope = 'testing/feature';
const When = Symbol(`${scope}/When`);
const Given = Symbol(`${scope}/Given`);
const Then = Symbol(`${scope}/Then`);
const And = Symbol(`${scope}/And`);
const But = Symbol(`${scope}/But`);

const UNION_DISPLAY = {
  [When]: 'When',
  [Given]: 'Given',
  [Then]: 'Then',
  [And]: 'And',
  [But]: 'But',
};

const displayUnion = (u) => UNION_DISPLAY[u];

// TODO: invariants

/* example opts object
const opts = {
  name: 'SignOut component',
  background: [
    { type: Given, text: 'step 1' },
    { type: And, text: 'step 2', args: ['test'] },
  ],
  scenarios: [
    {
      name: 'Mounting the component when auth data is absent',
      steps: [
        { type: Given, text: 'absent auth data' },
        { type: When, text: 'the component is mounted' },
        { type: Then, text: 'location should match the post-signout url' },
        { type: And, text: 'selected state should match the snapshot' },
        { type: And, text: 'rendered html should match the snapshot' },
      ],
    },
  ],
  stepDefs: [
    { re: /absent auth data/, fn: (ctx) => {} },
  ],
};
*/

const mkStep = (type) => (text, ...args) => ({ type, text, args });

const addBackgroundStep = ({ background = [], ...opts }) => (step) => ({
  ...opts,
  background: [...background, step],
});

const addScenarioStep = ({ scenarios = [], ...opts }) => (step) => {
  const { steps = [], ...current } = last(scenarios);
  const rest = initial(scenarios);
  return {
    ...opts,
    scenarios: [...rest, { ...current, steps: [...steps, step] }],
  };
};

const hasScenarios = (opts) => opts.scenarios && opts.scenarios.length;

const addStep = (type) => (opts, cons) =>
  pipe(
    mkStep(type),
    hasScenarios(opts) ? addScenarioStep(opts) : addBackgroundStep(opts),
    cons,
  );

const addScenario = ({ scenarios = [], ...opts }, cons) => (name) =>
  cons({
    ...opts,
    scenarios: [...scenarios, { name }],
  });

const addStepDefs = ({ stepDefs = [], ...opts }, cons) => (addedStepDefs) =>
  cons({
    ...opts,
    stepDefs: stepDefs.concat(addedStepDefs),
  });

const mkStepDef = (re, fn) => ({ re, fn });

export { mkStepDef as step };

const addStepDef = (opts, cons) => pipe(mkStepDef, addStepDefs(opts, cons));

const renderSteps = (steps, getCtx, next) => {
  if (!steps.length) {
    if (next) next(getCtx);
    return;
  }

  if (steps[0].type === Then) {
    const isNotWhen = ({ type }) => type !== When;
    const thens = takeWhile(steps, isNotWhen);
    const rest = dropWhile(steps, isNotWhen);

    thens.forEach(({ type, text, args = [] }) => {
      it(`${displayUnion(type)} ${text}`, async () => {
        const ctx = getCtx();
        await ctx.step(ctx, text, ...args);
      });
    });

    renderSteps(rest, getCtx, next);
    return;
  }

  const [step, ...rest] = steps;
  const { type, text, args = [] } = step;

  describe(`${displayUnion(type)} ${text}`, () => {
    let nextCtx;
    const getNextCtx = () => nextCtx || getCtx();
    beforeEach(async () => {
      const ctx = getCtx();
      nextCtx = await ctx.step(ctx, text, ...args);
    });

    renderSteps(rest, getNextCtx, next);
  });
};

const renderBackground = (steps, getCtx, next) => {
  if (!steps) {
    if (next) next(getCtx);
    return;
  }

  describe('Background:', () => {
    renderSteps(steps, getCtx, next);
  });
};

const renderScenario = ({ name, steps }, getCtx) => {
  describe(`Scenario: ${name}`, () => renderSteps(steps, getCtx));
};

const renderFeature = ({ name, background = [], scenarios = [] }, getCtx) => {
  describe(`Feature: ${name}`, () => {
    renderBackground(background, getCtx, (getNextCtx) => {
      scenarios.forEach((s) => renderScenario(s, getNextCtx));
    });
  });
};

const run = ({ stepDefs = [], ...opts }) => (ctx = {}) => {
  const getStep = memoize((text) => {
    const stepDef = stepDefs.find(({ re }) => re.test(text));
    if (!stepDef) throw new Error(`Step "${text}" could not be matched!`);
    const { re, fn } = stepDef;
    const args = text.match(re).slice(1);
    return { fn, args };
  });

  const runStep = (stepCtx, text, ...runArgs) => {
    const { fn, args } = getStep(text);
    return fn(stepCtx, ...args, ...runArgs);
  };

  const getCtx = () => ({
    step: runStep,
    ...ctx,
  });

  renderFeature(opts, getCtx);
};

const methods = {
  scenario: addScenario,
  given: addStep(Given),
  when: addStep(When),
  then: addStep(Then),
  and: addStep(And),
  but: addStep(But),
  step: addStepDef,
  steps: addStepDefs,
  run,
};

const construct = (opts) =>
  mapValues(methods, (m) => m(opts, construct));

// entry point
export default (name, opts) => construct({ name, ...opts });
