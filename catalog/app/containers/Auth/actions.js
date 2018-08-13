// @flow

import {
  actionCreator,
  type Action,
} from 'utils/reduxTools';
import type { Resolver } from 'utils/defer';

import { actions } from './constants';
import type { Tokens, User } from './types';


// Sign Up
export type SignUpCredentials = {|
  username: string,
  email: string,
  password: string,
|};

export type SignUpAction = Action & {
  type: typeof actions.SIGN_UP,
  payload: SignUpCredentials,
  meta: Resolver<void>,
};

/**
 * Create a SIGN_UP action.
 */
export const signUp = actionCreator<SignUpAction>(actions.SIGN_UP, (
  credentials: SignUpCredentials,
  resolver: Resolver<void>,
) => ({
  payload: credentials,
  meta: { ...resolver },
}));


// Reset Password
export type ResetPasswordAction = Action & {
  type: typeof actions.RESET_PASSWORD,
  payload: string,
  meta: Resolver<void>,
};

/**
 * Create a RESET_PASSWORD action.
 */
export const resetPassword = actionCreator<ResetPasswordAction>(actions.RESET_PASSWORD, (
  email: string,
  resolver: Resolver<void>,
) => ({
  payload: email,
  meta: { ...resolver },
}));


// Change Password
export type ChangePasswordPayload = {|
  link: string,
  password: string,
|};

export type ChangePasswordAction = Action & {
  type: typeof actions.CHANGE_PASSWORD,
  payload: ChangePasswordPayload,
  meta: Resolver<void>,
};

/**
 * Create a CHANGE_PASSWORD action.
 */
export const changePassword = actionCreator<ChangePasswordAction>(actions.CHANGE_PASSWORD, (
  link: string,
  password: string,
  resolver: Resolver<void>,
) => ({
  payload: { link, password },
  meta: { ...resolver },
}));


// Get Code
export type GetCodeAction = Action & {
  type: typeof actions.GET_CODE,
  meta: Resolver<string>,
};

/**
 * Create a GET_CODE action.
 */
export const getCode = actionCreator<GetCodeAction>(actions.GET_CODE, (
  resolver: Resolver<string>,
) => ({
  meta: { ...resolver },
}));


// Sign In
export type SignInCredentials = {|
  username: string,
  password: string,
|};

export type SignInResult = {|
  tokens: Tokens,
  user: User,
|};

export type SignInAction = Action & {
  type: typeof actions.SIGN_IN,
  payload: SignInCredentials,
  meta: Resolver<SignInResult>,
};

export type SignInResultAction = Action & {
  type: typeof actions.SIGN_IN_RESULT,
  payload: SignInResult | Error,
};

/**
 * Create a SIGN_IN action.
 */
export const signIn = actionCreator<SignInAction>(actions.SIGN_IN, (
  credentials: SignInCredentials,
  resolver: Resolver<SignInResult>,
) => ({
  payload: credentials,
  meta: { ...resolver },
}));

/**
 * Create a SIGN_IN_RESULT action.
 */
signIn.resolve = actionCreator<SignInResultAction>(actions.SIGN_IN_RESULT, (
  payload: SignInResult | Error,
) => ({
  error: payload instanceof Error,
  payload,
}));


// Sign Out
export type SignOutAction = Action & {
  type: typeof actions.SIGN_OUT,
  meta: Resolver<void>,
};

export type SignOutResultAction = Action & {
  type: typeof actions.SIGN_OUT_RESULT,
  payload: ?Error,
};

/**
 * Create a SIGN_OUT action.
 */
export const signOut = actionCreator<SignOutAction>(actions.SIGN_OUT, (
  resolver: Resolver<void>,
) => ({
  meta: { ...resolver },
}));

/**
 * Create a SIGN_OUT_RESULT action.
 */
signOut.resolve = actionCreator<SignOutResultAction>(actions.SIGN_OUT_RESULT, (
  result: ?Error,
) => ({
  error: result instanceof Error,
  payload: result,
}));


// Check
export type CheckOptions = {|
  /**
   * If true, user data will be refetched after token refresh.
   */
  refetch: bool,
|};

export type CheckResult = {|
  tokens: Tokens,
  user: ?User,
|};

export type CheckAction = Action & {
  type: typeof actions.CHECK,
  payload: CheckOptions,
  meta: Resolver<?CheckResult>,
};

/**
 * Create a CHECK action.
 */
export const check = actionCreator<CheckAction>(actions.CHECK, (
  { refetch = true }: CheckOptions = {},
  resolver: Resolver<?CheckResult>,
) => ({
  payload: { refetch },
  meta: { ...resolver },
}));


// Refresh
export type RefreshAction = Action & {
  type: typeof actions.REFRESH,
};

export type RefreshResultAction = Action & {
  type: typeof actions.REFRESH_RESULT,
  payload: CheckResult | Error,
};

/**
 * Create a REFRESH action.
 */
export const refresh = actionCreator<RefreshAction>(actions.REFRESH);

/**
 * Create a REFRESH_RESULT action.
 */
refresh.resolve = actionCreator<RefreshResultAction>(actions.REFRESH_RESULT, (
  payload: CheckResult | Error,
) => ({
  error: payload instanceof Error,
  payload,
}));


// Auth Lost
export type AuthLostAction = Action & {
  type: typeof actions.AUTH_LOST,
  payload: Error,
};

/**
 * Create an AUTH_LOST action.
 */
export const authLost = actionCreator<AuthLostAction>(actions.AUTH_LOST, (
  /**
   * Error that caused authentication loss.
   */
  payload: Error
) => ({
  payload,
}));
