// @flow

import dropWhile from 'lodash/dropWhile';
import pipe from 'lodash/flow';
import initial from 'lodash/initial';
import last from 'lodash/last';
import memoize from 'lodash/memoize';
import startCase from 'lodash/startCase';
import takeWhile from 'lodash/takeWhile';
import invoke from 'lodash/fp/invokeArgs';
import reduce from 'lodash/fp/reduce';

import constructor from './constructor';

const scope = 'testing/feature';
// const After = Symbol(`${scope}/After`);
const After = `${scope}/After`;

// TODO: invariants

type TestStep = {|
  type: 'setup' | 'assertion',
  word: 'when' | 'given' | 'then',
  text: string,
  args: any[],
|};

type BackStep = {|
  type: 'back',
  back: number,
|};

type BranchStep = {|
  type: 'branch',
  steps: Step[],
|};

type TapStep = {|
  type: 'tap',
  fn: StepFn,
|};

type Step =
  | TestStep
  | BackStep
  | BranchStep
  | TapStep;

type Scenario = {|
  name: string,
  steps?: Step[],
|};

type StepFn = (ctx: Context, ...args: any) => ?Context;

type StepDef = {|
  re: RegExp,
  fn: StepFn,
  after?: StepFn,
|};

type FeatureState = {|
  name: string,
  background: Step[],
  scenarios: Scenario[],
  stepDefs: StepDef[],
|};

type RunStep = (ctx: Context, text: string, ...args: any) => Context | Promise<Context>;

type Context = {
  step: RunStep,
};

type GetContext = () => Context;

type Next = (getCtx: GetContext) => void;

const mkTestStepCreator = (word: $PropertyType<TestStep, 'word'>) =>
  (
    text: $PropertyType<TestStep, 'text'>,
    ...args: $PropertyType<TestStep, 'args'>
  ): TestStep =>
    ({ type: word === 'then' ? 'assertion' : 'setup', word, text, args });

const mkBackStep = (back: $PropertyType<BackStep, 'back'> = 1): BackStep =>
  ({ type: 'back', back });

const mkBranchStep = (steps: $PropertyType<BranchStep, 'steps'>): BranchStep =>
  ({ type: 'branch', steps });

const mkTapStep = (fn: $PropertyType<TapStep, 'fn'>): TapStep =>
  ({ type: 'tap', fn });

const addBackgroundStep = ({ background = [], ...opts }: FeatureState) =>
  (step: Step): FeatureState =>
    ({
      ...opts,
      background: [...background, step],
    });

const addScenarioStep = ({ scenarios = [], ...opts }: FeatureState) =>
  (step: Step): FeatureState => {
    const { steps = [], ...current } = last(scenarios);
    const rest = initial(scenarios);
    return {
      ...opts,
      scenarios: [...rest, { ...current, steps: [...steps, step] }],
    };
  };

const hasScenarios = (opts: FeatureState): bool =>
  Boolean(opts.scenarios && opts.scenarios.length);

// TODO: stricter args type?
const addStep = (createStep: (...args: any) => Step) =>
  (opts: FeatureState) =>
    pipe([
      createStep,
      hasScenarios(opts) ? addScenarioStep(opts) : addBackgroundStep(opts),
      mkFeature,
    ]);

const computeBranches = reduce((acc: Step[], step: Step): Step[] => {
  if (step.type === 'back') {
    let { back } = step;
    if (back <= 0) throw new Error('back must be >= 1');
    let idx;
    for (let i = acc.length - 1; i >= 0; i -= 1) {
      if (acc[i].type === 'setup') {
        back -= 1;
        if (back === 0) {
          idx = i;
          break;
        }
      }
    }
    if (idx == null) throw new Error('too many steps back');
    const trunkSteps = acc.slice(0, idx);
    const branchSteps = acc.slice(idx);
    return [...trunkSteps, mkBranchStep(branchSteps)];
  }
  return [...acc, step];
}, []);

const addStepDefs = ({ stepDefs = [], ...opts }: FeatureState) =>
  (addedStepDefs: StepDef | StepDef[]): Feature =>
    mkFeature({
      ...opts,
      stepDefs: stepDefs.concat(addedStepDefs),
    });

const mkStepDef = (
  re: $PropertyType<StepDef, 're'>,
  fn: $PropertyType<StepDef, 'fn'>,
  after: $PropertyType<StepDef, 'after'>,
): StepDef =>
  ({ re, fn, after });

export { mkStepDef as step };

const addStepDef = (opts: FeatureState) => pipe([mkStepDef, addStepDefs(opts)]);

const renderBranch = (
  [branch, ...rest]: Step[],
  getCtx: GetContext,
  next: ?Next,
): void => {
  // refinement for flow
  if (branch.type !== 'branch') throw new Error('shouldnt be there');
  const { steps } = branch;
  renderSteps(steps, getCtx);
  renderSteps(rest, getCtx, next);
};

const isAssertion = ({ type }) => type === 'assertion';

const takeAssertions = (steps: Step[]): [TestStep[], Step[]] => [
  ((takeWhile(steps, isAssertion): any): TestStep[]),
  dropWhile(steps, isAssertion),
];

const renderTap = (
  [step, ...rest]: Step[],
  getCtx: GetContext,
  next: ?Next,
): void => {
  // refinement for flow
  if (step.type !== 'tap') throw new Error('shouldnt be there');
  let nextCtx;
  const getNextCtx = () => nextCtx || getCtx();
  beforeEach(async () => {
    nextCtx = await step.fn(getCtx());
  });

  renderSteps(rest, getNextCtx, next);
};

const renderAssertion = (steps: Step[], getCtx: GetContext, next: ?Next): void => {
  const [assertions, rest] = takeAssertions(steps);

  assertions.forEach(({ word, text, args = [] }) => {
    it(`${startCase(word)} ${text}`, async () => {
      const ctx = getCtx();
      const afterCtx = await ctx.step(ctx, text, ...args);
      await afterCtx[After]();
    });
  });

  renderSteps(rest, getCtx, next);
};

const renderSetup = (
  [step, ...rest]: Step[],
  getCtx: GetContext,
  next: ?Next,
): void => {
  // refinement for flow
  if (step.type !== 'setup') throw new Error('shouldnt be there');
  const { word, text, args = [] } = step;
  describe(`${startCase(word)} ${text}`, () => {
    let nextCtx;
    const getNextCtx = () => nextCtx;
    beforeEach(async () => {
      const ctx = getCtx();
      nextCtx = await ctx.step(ctx, text, ...args);
    });

    afterEach(async () => {
      await getNextCtx()[After]();
    });

    renderSteps(rest, getNextCtx, next);
  });
};

const renderSteps = (steps: Step[], getCtx: GetContext, next: ?Next): void => {
  if (!steps.length) {
    if (next) next(getCtx);
    return;
  }

  invoke(steps[0].type, [steps, getCtx, next], {
    setup: renderSetup,
    assertion: renderAssertion,
    branch: renderBranch,
    tap: renderTap,
    back: () => { throw new Error('back steps should have been removed'); },
  });
};

const renderBackground = (steps: Step[], getCtx: GetContext, next: ?Next) => {
  if (!steps) {
    if (next) next(getCtx);
    return;
  }

  describe('Background:', () => {
    renderSteps(computeBranches(steps), getCtx, next);
  });
};

const renderScenario = ({ name, steps }: Scenario, getCtx: GetContext): void => {
  describe(`Scenario: ${name}`, () => {
    if (!steps) return;
    renderSteps(computeBranches(steps), getCtx);
  });
};

const renderFeature = (
  { name, background = [], scenarios = [] }: $Rest<FeatureState, {| stepDefs: any |}>,
  getCtx: GetContext,
): void => {
  describe(`Feature: ${name}`, () => {
    renderBackground(background, getCtx, (getNextCtx) => {
      scenarios.forEach((s) => renderScenario(s, getNextCtx));
    });
  });
};

const run = ({ stepDefs = [], ...opts }: FeatureState) => (ctx = {}) => {
  const getStep = memoize((text: string) => {
    const stepDef = stepDefs.find(({ re }) => re.test(text));
    if (!stepDef) throw new Error(`Step "${text}" could not be matched!`);
    const { re, fn, after } = stepDef;
    const match = text.match(re);
    // refinement for flow
    if (!match) throw new Error('should not be there');
    return { fn, after, args: match.slice(1) };
  });

  const runStep = async (stepCtx: Context, text: string, ...runArgs: any) => {
    const { fn, after, args } = getStep(text);
    const newCtx = await fn(stepCtx, ...args, ...runArgs);
    const afterCtx = newCtx || stepCtx;
    return {
      ...afterCtx,
      [After]: after
        ? () => after(afterCtx, ...args, ...runArgs)
        : () => {},
    };
  };

  const getCtx = (): Context => ({
    step: runStep,
    ...ctx,
  });

  renderFeature(opts, getCtx);
};

const mkFeature = constructor({
  scenario: ({ scenarios = [], ...opts }: FeatureState) => (name: string): Feature =>
    mkFeature({
      ...opts,
      scenarios: [...scenarios, { name }],
    }),

  given: addStep(mkTestStepCreator('given')),
  when: addStep(mkTestStepCreator('when')),
  then: addStep(mkTestStepCreator('then')),

  back: addStep(mkBackStep),

  tap: addStep(mkTapStep),

  step: addStepDef,
  steps: addStepDefs,

  run,
});

type Feature = $Call<typeof mkFeature, FeatureState>;

/**
 * @name feature
 */
export default (
  name: string,
  opts: $Rest<FeatureState, {| name: string |}>,
): Feature =>
  mkFeature({ name, ...opts });
