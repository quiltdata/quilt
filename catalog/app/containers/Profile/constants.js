/* Profile constants */
import config from 'constants/config';

export const REDUX_KEY = 'app/Profile';

export const GET_LOG = 'app/Profile/GET_LOG';
export const GET_LOG_ERROR = 'app/Profile/GET_LOG_ERROR';
export const GET_LOG_SUCCESS = 'app/Profile/GET_LOG_SUCCESS';

export const GET_PROFILE = 'app/Profile/GET_PROFILE';
export const GET_PROFILE_ERROR = 'app/Profile/GET_PROFILE_ERROR';
export const GET_PROFILE_SUCCESS = 'app/Profile/GET_PROFILE_SUCCESS';

export const UPDATE_PAYMENT = 'app/Profile/UPDATE_PAYMENT';
export const UPDATE_PAYMENT_ERROR = 'app/Profile/UPDATE_PAYMENT_ERROR';
export const UPDATE_PAYMENT_SUCCESS = 'app/Profile/UPDATE_PAYMENT_SUCCESS';

export const UPDATE_PLAN = 'app/Profile/UPDATE_PLAN';
export const UPDATE_PLAN_ERROR = 'app/Profile/UPDATE_PLAN_ERROR';
export const UPDATE_PLAN_SUCCESS = 'app/Profile/UPDATE_PLAN_SUCCESS';

// public cloud plans
export const PLANS = config.team ? {
  // team plans
  team_unpaid: {
    confirmTitle: 'Cancel team account?',
    confirmBody: 'Your team will lose access to all data.',
    cost: 0,
    menu: 'Team (30-day trial)',
    rank: 0,
    statusIcon: 'warning',
    statusMessage: 'Temporary Service plan. Upgrade for uninterrupted service.',
  },
  team_monthly_490: {
    cost: 49000,
    menu: 'Team',
    menuIcon: 'stars',
    rank: 1,
    statusIcon: 'verified_user',
    statusMessage: 'Active',
  },
} : {
  free: {
    confirmTitle: 'Downgrade to free?',
    confirmBody: 'You will no longer be able to create private packages.',
    cost: 0,
    menu: 'Free',
    rank: 0,
  },
  individual_monthly_7: {
    cost: 700,
    menu: 'Individual',
    rank: 1,
  },
};

Object.freeze(PLANS);
