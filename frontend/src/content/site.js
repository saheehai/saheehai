/**
 * Facts about the organization that more than one page needs. Change them
 * here and every page follows.
 */

export const SITE_URL = 'https://saheeh.ai';

export const ORG_NAME = 'Saheeh AI';

// One line, used in the footer and the JSON-LD in index.html. Update it the
// day the IRS determination letter arrives, and add the EIN below.
export const ORG_STATUS = 'a Texas nonprofit corporation. 501(c)(3) recognition pending.';

// Employer Identification Number. Published in the footer once the
// determination letter arrives; empty until then.
export const EIN = '';

// A monitored inbox. Empty until one exists: the footer and the legal pages
// fall back to the public issue tracker, which is the one channel that is
// always answered.
export const CONTACT_EMAIL = '';

export const REPO_URL = 'https://github.com/saheehai/saheehai';
export const ISSUES_URL = `${REPO_URL}/issues`;

export const CONTACT_HREF = CONTACT_EMAIL ? `mailto:${CONTACT_EMAIL}` : ISSUES_URL;
export const CONTACT_LABEL = CONTACT_EMAIL || 'our public issue tracker';
