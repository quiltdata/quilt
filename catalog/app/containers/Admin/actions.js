/*
 *
 * Admin actions
 *
 */

import api from 'constants/api';
import {
  ADD_MEMBER,
  MEMBER_ADDED,
  GET_MEMBERS,
  GET_MEMBERS_RESPONSE,
  GET_MEMBER_AUDIT,
  GET_MEMBER_AUDIT_RESPONSE,
  DISABLE_MEMBER,
  DISABLE_MEMBER_RESPONSE,
  ENABLE_MEMBER,
  ENABLE_MEMBER_RESPONSE,
  RESET_MEMBER_PASSWORD,
  RESET_MEMBER_PASSWORD_RESPONSE,
  GET_PACKAGES,
  GET_PACKAGES_RESPONSE,
  GET_PACKAGE_AUDIT,
  GET_PACKAGE_AUDIT_RESPONSE,
} from './constants';


// add member
export const addMember = ({ username, email }, { resolve, reject }) => ({
  type: ADD_MEMBER,
  username,
  email,
  resolve,
  reject,
});

export const memberAdded = (member) => ({
  type: MEMBER_ADDED,
  member,
});


// members
export const getMembers = () => ({
  type: GET_MEMBERS,
});

export const getMembersResponse = (status, response) => ({
  type: GET_MEMBERS_RESPONSE,
  status,
  response,
});

export const getMembersSuccess = (response) => getMembersResponse(api.SUCCESS, response);
export const getMembersError = (response) => getMembersResponse(api.ERROR, response);


// member audit
export const getMemberAudit = (name) => ({
  type: GET_MEMBER_AUDIT,
  name,
});

export const getMemberAuditResponse = (status, response) => ({
  type: GET_MEMBER_AUDIT_RESPONSE,
  status,
  response,
});

export const getMemberAuditSuccess = (response) => getMemberAuditResponse(api.SUCCESS, response);
export const getMemberAuditError = (response) => getMemberAuditResponse(api.ERROR, response);


// disable member
export const disableMember = (name, { resolve, reject }) => ({
  type: DISABLE_MEMBER,
  name,
  resolve,
  reject,
});

export const disableMemberResponse = (name, status, response) => ({
  type: DISABLE_MEMBER_RESPONSE,
  name,
  status,
  response,
});

export const disableMemberSuccess = (name, response) =>
  disableMemberResponse(name, api.SUCCESS, response);
export const disableMemberError = (name, response) =>
  disableMemberResponse(name, api.ERROR, response);


// enable member
export const enableMember = (name, { resolve, reject }) => ({
  type: ENABLE_MEMBER,
  name,
  resolve,
  reject,
});

export const enableMemberResponse = (name, status, response) => ({
  type: ENABLE_MEMBER_RESPONSE,
  name,
  status,
  response,
});

export const enableMemberSuccess = (name, response) =>
  enableMemberResponse(name, api.SUCCESS, response);
export const enableMemberError = (name, response) =>
  enableMemberResponse(name, api.ERROR, response);


// reset member password
export const resetMemberPassword = (name, { resolve, reject }) => ({
  type: RESET_MEMBER_PASSWORD,
  name,
  resolve,
  reject,
});

export const resetMemberPasswordResponse = (name, status, response) => ({
  type: RESET_MEMBER_PASSWORD_RESPONSE,
  name,
  status,
  response,
});

export const resetMemberPasswordSuccess = (name, response) =>
  resetMemberPasswordResponse(name, api.SUCCESS, response);
export const resetMemberPasswordError = (name, response) =>
  resetMemberPasswordResponse(name, api.ERROR, response);


// packages
export const getPackages = () => ({
  type: GET_PACKAGES,
});

export const getPackagesResponse = (status, response) => ({
  type: GET_PACKAGES_RESPONSE,
  status,
  response,
});

export const getPackagesSuccess = (response) => getPackagesResponse(api.SUCCESS, response);
export const getPackagesError = (response) => getPackagesResponse(api.ERROR, response);


// package audit
export const getPackageAudit = (handle) => ({
  type: GET_PACKAGE_AUDIT,
  handle,
});

export const getPackageAuditResponse = (status, response) => ({
  type: GET_PACKAGE_AUDIT_RESPONSE,
  status,
  response,
});

export const getPackageAuditSuccess = (response) => getPackageAuditResponse(api.SUCCESS, response);
export const getPackageAuditError = (response) => getPackageAuditResponse(api.ERROR, response);
