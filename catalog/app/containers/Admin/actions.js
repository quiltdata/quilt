/*
 *
 * Admin actions
 *
 */

import api from 'constants/api';
import {
  ADD_MEMBER,
  ADD_MEMBER_RESPONSE,
  GET_MEMBERS,
  GET_MEMBERS_RESPONSE,
  GET_MEMBER_AUDIT,
  GET_MEMBER_AUDIT_RESPONSE,
  REMOVE_MEMBER,
  REMOVE_MEMBER_RESPONSE,
  RESET_MEMBER_PASSWORD,
  RESET_MEMBER_PASSWORD_RESPONSE,
  GET_PACKAGES,
  GET_PACKAGES_RESPONSE,
  GET_PACKAGE_AUDIT,
  GET_PACKAGE_AUDIT_RESPONSE,
  REMOVE_PACKAGE,
  REMOVE_PACKAGE_RESPONSE,
} from './constants';


// add member
export const addMember = (name, email) => ({
  type: ADD_MEMBER,
  name,
  email,
});

export const addMemberResponse = (status, response) => ({
  type: ADD_MEMBER_RESPONSE,
  status,
  response,
});

export const addMemberSuccess = (response) => addMemberResponse(api.SUCCESS, response);
export const addmemberError = (response) => addMemberResponse(api.ERROR, response);


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


// remove member
export const removeMember = (name) => ({
  type: REMOVE_MEMBER,
  name,
});

export const removeMemberResponse = (name, status, response) => ({
  type: REMOVE_MEMBER_RESPONSE,
  name,
  status,
  response,
});

export const removeMemberSuccess = (name, response) =>
  removeMemberResponse(name, api.SUCCESS, response);
export const removeMemberError = (name, response) =>
  removeMemberResponse(name, api.ERROR, response);


// reset member password
export const resetMemberPassword = (name) => ({
  type: RESET_MEMBER_PASSWORD,
  name,
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


// remove package
export const removePackage = (handle) => ({
  type: REMOVE_PACKAGE,
  handle,
});

export const removePackageResponse = (handle, status, response) => ({
  type: REMOVE_PACKAGE_RESPONSE,
  handle,
  status,
  response,
});

export const removePackageSuccess = (handle, response) =>
  removePackageResponse(handle, api.SUCCESS, response);

export const removePackageError = (handle, response) =>
  removePackageResponse(handle, api.ERROR, response);
