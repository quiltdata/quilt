// import { withInitialState } from 'utils/reduxTools';

import tagged from './tagged'

describe('tagged', () => {
  describe('case', () => {
    const Result = tagged(['Ok', 'Err'])
    const ok = Result.Ok('ok')
    const err = Result.Err('err')

    describe('exhaustive', () => {
      const match = Result.case({
        Ok: (v) => `ok: ${v}`,
        Err: (e) => `err: ${e}`,
      })

      it('should work', () => {
        expect(match(ok)).toBe('ok: ok')
        expect(match(err)).toBe('err: err')
      })

      it('should throw on invalid type', () => {
        expect(() => {
          match('sup')
        }).toThrow(/must be called with an instance/)
      })
    })

    describe('non-exhaustive', () => {
      it('should throw', () => {
        expect(() => {
          Result.case({
            Ok: (v) => v,
          })
        }).toThrow(/non-exhaustive/)
      })
    })

    describe('with catch-all (_)', () => {
      const match = Result.case({
        Ok: (v) => v,
        _: () => 'catch-all',
      })

      it('should work', () => {
        expect(match(ok)).toBe('ok')
        expect(match(err)).toBe('catch-all')
      })
    })

    describe('with invalid type handler (__)', () => {
      const match = Result.case({
        _: () => 'catch-all',
        __: (v) => `invalid: ${v}`,
      })

      it('should work', () => {
        expect(match(ok)).toBe('catch-all')
        expect(match(err)).toBe('catch-all')
        expect(match('test')).toBe('invalid: test')
      })
    })

    describe('with extra arguments', () => {
      const cases = {
        Ok: (val, ...rest) => [val, ...rest],
        _: () => 'catch-all',
      }

      const args = [1, 2]

      const expected = ['ok', ...args]

      it('should work', () => {
        expect(Result.case(cases, ok, ...args)).toEqual(expected)
        expect(Result.case(cases)(ok, ...args)).toEqual(expected)
      })
    })
  })

  /*
  describe('reducer example', () => {
    const Action = tagged([
      'SignIn', // { credentials, resolver }
      'SignInResult', // Result<AuthData, Any>
      'SignOut', // null
      'AuthLost', // error
    ]);

    const State = tagged([
      'SignedOut', // { error }
      'SigningIn', // { credentials }
      'SignedIn', // AuthData
    ]);

    const initial = State.SignedOut();

    const reducer = withInitialState(initial, (s, a) => Action.case({
      SignIn: ({ credentials }) => State.case({
        SignedOut: () => State.SigningIn({ credentials }),
        _: invalidTransition,
      }),
      SignInResult: (res) => State.case({
        SigningIn: () => Result.case({
          Ok: (data) => State.SignedIn(data),
          Err: (error) => State.SignedOut({ error }),
        }),
        _: invalidTransition,
      }),
      SignOut: () => State.case({
        SignedIn: () => State.SignedOut(),
        _: invalidTransition,
      }),
      AuthLost: (error) => State.case({
        SignedIn: () => State.SignedOut({ error }),
        _: invalidTransition,
      }),
      __: id
    }, a, s));

    const reducer = withInitialState(initial, Action.switch({
      SignIn: State.transition({
        SignedOut: ({ credentials }) => State.SigningIn({ credentials }),
      }),
      SignInResult: State.transition({
        SigningIn: Result.case({
          Ok: (data) => State.SignedIn(data),
          Err: (error) => State.SignedOut({ error }),
        }),
      }),
      SignOut: State.transition({
        SignedIn: () => State.SignedOut(),
      }),
      AuthLost: State.transition({
        SignedIn: (error) => State.SignedOut({ error }),
      }),
    }));

    const reducer = withInitialState(initial, matchMultiple([
      [State.SignedOut, Action.SignIn, (s, { credentials }) =>
        State.SigningIn({ credentials })],
      [State.SigningIn, Action.SignInResult, (s) => Result.case({
        Ok: (data) => State.SignedIn(data),
        Err: (error) => State.SignedOut({ error }),
      })],
      [State.SignedIn, Action.SignOut, (s, a) => State.SignedOut()],
      [State.SignedIn, Action.AuthLost, (s, error) => State.SignedOut({ error })],
      [State, Action, (s, a) => s], // invalid transition
      [Any, Any, (s, a) => s],
    ]));

    // Type.is(obj) => bool
    // Type.when(guard) => Type
    // Type.Variant.is(obj) => bool
    // Type.Variant.unbox(obj) => Any
    // Type.Variant.when(guard) => Type.Variant

    it('should work', () => {
      const state = reducer(undefined, 'init');

      reducer(state, Action.SignIn({ credentials }));
    });
  });
  */
})
