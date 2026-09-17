/**
 * Cognito accounts.
 *
 * Wraps amazon-cognito-identity-js so the rest of the app never touches the
 * callback-style SDK. Sign-in uses SRP, so the password is never sent to
 * Cognito in a form that could be replayed, and never passes through our own
 * backend at all.
 *
 * Tokens live in the SDK's own localStorage entries. The id token is what the
 * API accepts — API Gateway's JWT authorizer validates it against the user
 * pool before any request reaches the Lambda.
 */

import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserAttribute,
  CognitoUserPool,
} from 'amazon-cognito-identity-js';

import { LAST_UPDATED as POLICY_VERSION } from '../content/legal';
import { solveChallenge } from './turnstileService';

const USER_POOL_ID = process.env.REACT_APP_COGNITO_USER_POOL_ID || '';
const CLIENT_ID = process.env.REACT_APP_COGNITO_CLIENT_ID || '';

let pool = null;

function userPool() {
  if (!USER_POOL_ID || !CLIENT_ID) {
    throw new Error(
      'Cognito is not configured. Set REACT_APP_COGNITO_USER_POOL_ID and ' +
        'REACT_APP_COGNITO_CLIENT_ID in frontend/.env.local.'
    );
  }
  if (!pool) {
    pool = new CognitoUserPool({ UserPoolId: USER_POOL_ID, ClientId: CLIENT_ID });
  }
  return pool;
}

const userFor = (email) =>
  new CognitoUser({ Username: email.trim().toLowerCase(), Pool: userPool() });

/**
 * Turn a Cognito error into something worth showing a person.
 *
 * The SDK's own messages are uneven — some leak implementation detail, some
 * are simply unhelpful. Anything unrecognised falls through to its message
 * rather than a generic string, so real failures stay debuggable.
 */
function friendlyError(err) {
  const code = err?.code || err?.name;
  switch (code) {
    case 'NotAuthorizedException':
      return new Error('That email and password do not match.');
    case 'UserNotConfirmedException':
      return Object.assign(new Error('Please confirm your email first.'), {
        needsConfirmation: true,
      });
    case 'UsernameExistsException':
      return new Error('An account with that email already exists.');
    case 'CodeMismatchException':
      return new Error('That code is not right. Check it and try again.');
    case 'ExpiredCodeException':
      return new Error('That code has expired. Request a new one.');
    case 'LimitExceededException':
    case 'TooManyRequestsException':
      return new Error('Too many attempts. Please wait a little and try again.');
    case 'InvalidPasswordException':
      return new Error('Password must be at least 12 characters, with upper, lower and a number.');
    case 'UserNotFoundException':
      // Cognito's PreventUserExistenceErrors should mask this, but do not
      // rely on configuration to avoid confirming whether an account exists.
      return new Error('That email and password do not match.');
    case 'UserLambdaValidationException': {
      // The PreSignUp trigger's own words, minus the SDK's wrapper.
      const reason = (err?.message || '')
        .replace(/^PreSignUp failed with error /, '')
        .replace(/\.$/, '');
      return new Error(reason || 'Sign-up was refused.');
    }
    case 'AliasExistsException':
      return new Error('An account with that email already exists.');
    default:
      return new Error(err?.message || 'Something went wrong. Please try again.');
  }
}

/**
 * The signed-in person's CognitoUser with a live session attached.
 *
 * The SDK's account methods (changePassword, updateAttributes, deleteUser)
 * all need getSession to have run on the same object first. Rejects when
 * nobody is signed in.
 */
function currentUser() {
  return new Promise((resolve, reject) => {
    let user;
    try {
      user = userPool().getCurrentUser();
    } catch (err) {
      return reject(err);
    }
    if (!user) return reject(new Error('Your session has ended. Please sign in again.'));
    user.getSession((err, session) => {
      if (err || !session?.isValid()) {
        return reject(new Error('Your session has ended. Please sign in again.'));
      }
      resolve(user);
    });
  });
}

/** Email and whether it is verified, for the Account page. */
export async function getAccount() {
  const user = await currentUser();
  return new Promise((resolve, reject) => {
    user.getUserAttributes((err, attributes) => {
      if (err) return reject(friendlyError(err));
      const map = Object.fromEntries((attributes || []).map((a) => [a.getName(), a.getValue()]));
      resolve({ email: map.email || '', emailVerified: map.email_verified === 'true' });
    });
  });
}

/** Change the password of the signed-in person. Needs the current one. */
export async function changePassword(currentPassword, newPassword) {
  const user = await currentUser();
  return new Promise((resolve, reject) => {
    user.changePassword(currentPassword, newPassword, (err) => {
      if (!err) return resolve();
      const code = err?.code || err?.name;
      if (code === 'NotAuthorizedException') {
        return reject(new Error('Your current password is not right.'));
      }
      reject(friendlyError(err));
    });
  });
}

/**
 * Start an email change. Cognito emails a code to the new address; the old
 * one stays in force until confirmEmailChange succeeds, so a typo cannot
 * lock anyone out.
 */
export async function requestEmailChange(newEmail) {
  const user = await currentUser();
  return new Promise((resolve, reject) => {
    user.updateAttributes(
      [new CognitoUserAttribute({ Name: 'email', Value: newEmail.trim().toLowerCase() })],
      (err) => (err ? reject(friendlyError(err)) : resolve())
    );
  });
}

export async function resendEmailChangeCode() {
  const user = await currentUser();
  return new Promise((resolve, reject) => {
    user.getAttributeVerificationCode('email', {
      onSuccess: () => resolve(),
      onFailure: (err) => reject(friendlyError(err)),
    });
  });
}

/**
 * Finish an email change with the emailed code, then refresh the session so
 * the id token carries the new address.
 */
export async function confirmEmailChange(code) {
  const user = await currentUser();
  await new Promise((resolve, reject) => {
    user.verifyAttribute('email', code.trim(), {
      onSuccess: () => resolve(),
      onFailure: (err) => reject(friendlyError(err)),
    });
  });
  await new Promise((resolve) => {
    user.getSession((err, session) => {
      if (err || !session) return resolve();
      user.refreshSession(session.getRefreshToken(), () => resolve());
    });
  });
}

/**
 * Delete the signed-in person's Cognito account, with their own session.
 *
 * Called by the Account page after the API has removed their rows, so the
 * account goes last and nothing is stranded. Tokens are cleared locally too.
 */
export async function deleteAccount() {
  const user = await currentUser();
  await new Promise((resolve, reject) => {
    user.deleteUser((err) => (err ? reject(friendlyError(err)) : resolve()));
  });
  try {
    user.signOut();
  } catch {
    /* the account is already gone */
  }
}

/**
 * Create an account. Requires a Turnstile challenge and both consent boxes.
 *
 * Consent is recorded twice on purpose. The custom attributes stay on the
 * account, so a data export shows what was agreed and to which version of
 * the policies. The clientMetadata copy is what the PreSignUp trigger checks,
 * because a script can call Cognito without ever seeing the form.
 */
export function signUp(email, password, consent = {}) {
  if (!consent.over18 || !consent.readPolicies) {
    return Promise.reject(new Error('Please tick both boxes to create an account.'));
  }
  return solveChallenge().then(
    (turnstileToken) =>
      new Promise((resolve, reject) => {
        const attributes = [
          new CognitoUserAttribute({ Name: 'email', Value: email.trim().toLowerCase() }),
          new CognitoUserAttribute({ Name: 'custom:age_attested', Value: 'true' }),
          new CognitoUserAttribute({ Name: 'custom:policies_accepted', Value: POLICY_VERSION }),
        ];

        userPool().signUp(
          email.trim().toLowerCase(),
          password,
          attributes,
          null,
          (err, result) => {
            if (err) return reject(friendlyError(err));
            resolve({ email: result.user.getUsername(), confirmed: result.userConfirmed });
          },
          // The PreSignUp trigger reads these and rejects the sign-up if the
          // token does not verify or either consent is missing.
          {
            turnstile_token: turnstileToken,
            age_attested: '18+',
            policies_accepted: POLICY_VERSION,
          }
        );
      })
  );
}

export function confirmSignUp(email, code) {
  return new Promise((resolve, reject) => {
    userFor(email).confirmRegistration(code.trim(), true, (err) =>
      err ? reject(friendlyError(err)) : resolve()
    );
  });
}

export function resendConfirmationCode(email) {
  return new Promise((resolve, reject) => {
    userFor(email).resendConfirmationCode((err) =>
      err ? reject(friendlyError(err)) : resolve()
    );
  });
}

export function signIn(email, password) {
  return new Promise((resolve, reject) => {
    const user = userFor(email);
    user.authenticateUser(
      new AuthenticationDetails({
        Username: email.trim().toLowerCase(),
        Password: password,
      }),
      {
        onSuccess: (session) =>
          resolve({
            email: user.getUsername(),
            idToken: session.getIdToken().getJwtToken(),
          }),
        onFailure: (err) => reject(friendlyError(err)),
      }
    );
  });
}

export function signOut() {
  const user = userPool().getCurrentUser();
  if (user) user.signOut();
}

export function forgotPassword(email) {
  return new Promise((resolve, reject) => {
    userFor(email).forgotPassword({
      onSuccess: () => resolve(),
      onFailure: (err) => reject(friendlyError(err)),
    });
  });
}

export function confirmNewPassword(email, code, newPassword) {
  return new Promise((resolve, reject) => {
    userFor(email).confirmPassword(code.trim(), newPassword, {
      onSuccess: () => resolve(),
      onFailure: (err) => reject(friendlyError(err)),
    });
  });
}

/**
 * Current id token, refreshed if it has expired.
 *
 * Resolves null rather than rejecting when nobody is signed in: "signed out"
 * is an ordinary state, not an error.
 */
export function getIdToken() {
  return new Promise((resolve) => {
    let user;
    try {
      user = userPool().getCurrentUser();
    } catch {
      return resolve(null);
    }
    if (!user) return resolve(null);

    // getSession refreshes with the refresh token when the id token is stale.
    user.getSession((err, session) => {
      if (err || !session?.isValid()) return resolve(null);
      resolve(session.getIdToken().getJwtToken());
    });
  });
}

export const isConfigured = () => Boolean(USER_POOL_ID && CLIENT_ID);
