/* Profile constants */
export const GET_PROFILE = 'app/Profile/GET_PROFILE';
export const GET_PROFILE_ERROR = 'app/Profile/GET_PROFILE_ERROR';
export const GET_PROFILE_SUCCESS = 'app/Profile/GET_PROFILE_SUCCESS';

export const UPDATE_PAYMENT = 'app/Profile/UPDATE_PAYMENT';
export const UPDATE_PAYMENT_ERROR = 'app/Profile/UPDATE_PAYMENT_ERROR';
export const UPDATE_PAYMENT_SUCCESS = 'app/Profile/UPDATE_PAYMENT_SUCCESS';

export const UPDATE_PLAN = 'app/Profile/UPDATE_PLAN';
export const UPDATE_PLAN_ERROR = 'app/Profile/UPDATE_PLAN_ERROR';
export const UPDATE_PLAN_SUCCESS = 'app/Profile/UPDATE_PLAN_SUCCESS';

export const PLANS = {
  free: {
    cost: 0,
    menu: 'Free',
    rank: 0,
  },
  individual_monthly_7: {
    cost: 700,
    menu: 'Individual',
    rank: 1,
  },
  business_monthly_490: {
    cost: 49000,
    menu: 'Business (Contact Us)',
    rank: 2,
  },
};
Object.freeze(PLANS);
