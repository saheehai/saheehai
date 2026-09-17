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
    default:
      return new Error(err?.message || 'Something went wrong. Please try again.');
  }
}

/** Create an account. Requires a Turnstile challenge. */
export function signUp(email, password) {
  return solveChallenge().then(
    (turnstileToken) =>
      new Promise((resolve, reject) => {
        const attributes = [
          new CognitoUserAttribute({ Name: 'email', Value: email.trim().toLowerCase() }),
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
          // The PreSignUp trigger reads the token from here and rejects the
          // sign-up if it does not verify.
          { turnstile_token: turnstileToken }
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
