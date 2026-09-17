/**
 * Crisis lines and places to find care. Rendered on /help, quoted in the
 * footer, and the same list the companion is told to refer people to
 * (backend/system_prompt.txt). When one changes, change it in both places.
 *
 * Everything here is free to call unless the note says otherwise. Numbers
 * are United States unless the entry says where else it works.
 */

export const CRISIS_LINES = [
  {
    name: '988 Suicide and Crisis Lifeline',
    how: 'Call or text 988',
    href: 'tel:988',
    url: 'https://988lifeline.org',
    note: 'Free, confidential, 24 hours a day. You can also chat at 988lifeline.org. Veterans: press 1.',
  },
  {
    name: 'Crisis Text Line',
    how: 'Text HOME to 741741',
    href: 'sms:741741?&body=HOME',
    url: 'https://www.crisistextline.org',
    note: 'Free, 24 hours a day, by text. A trained volunteer answers.',
  },
  {
    name: 'Emergency services',
    how: 'Call 911',
    href: 'tel:911',
    note: 'If you or someone else is in immediate danger.',
  },
  {
    name: 'Outside the United States',
    how: 'findahelpline.com',
    url: 'https://findahelpline.com',
    note: 'Crisis lines by country, kept up to date by the people who run them.',
  },
];

export const SUPPORT_LINES = [
  {
    name: 'SAMHSA National Helpline',
    how: 'Call 1-800-662-4357',
    href: 'tel:18006624357',
    url: 'https://www.samhsa.gov/find-help/helplines/national-helpline',
    note: 'Free, confidential, 24 hours a day, in English and Spanish. Information and referrals for mental health and substance use.',
  },
  {
    name: 'National Domestic Violence Hotline',
    how: 'Call 1-800-799-7233 or text START to 88788',
    href: 'tel:18007997233',
    url: 'https://www.thehotline.org',
    note: 'Free, confidential, 24 hours a day.',
  },
  {
    name: 'The Trevor Project',
    how: 'Call 1-866-488-7386 or text START to 678678',
    href: 'tel:18664887386',
    url: 'https://www.thetrevorproject.org/get-help/',
    note: 'For LGBTQ+ young people. Free, confidential, 24 hours a day.',
  },
  {
    name: 'NAMI HelpLine',
    how: 'Call 1-800-950-6264 or text "HelpLine" to 62640',
    href: 'tel:18009506264',
    url: 'https://www.nami.org/help',
    note: 'Weekdays, 10am to 10pm Eastern. Information, resources and referrals from people with lived experience.',
  },
  {
    name: '211',
    how: 'Call 211',
    href: 'tel:211',
    url: 'https://www.211.org',
    note: 'Local help with food, housing, utility bills, and finding low-cost health care.',
  },
];

export const FIND_CARE = [
  {
    name: 'FindTreatment.gov',
    url: 'https://findtreatment.gov',
    note: 'The federal locator for mental health and substance use treatment. Filter by whether a provider takes Medicaid, offers a sliding scale, or treats people who cannot pay.',
  },
  {
    name: 'Find a Health Center',
    url: 'https://findahealthcenter.hrsa.gov',
    note: 'Community health centers charge based on what you can afford, whether or not you have insurance. Many offer counseling as well as primary care.',
  },
  {
    name: 'Open Path Collective',
    url: 'https://openpathcollective.org',
    note: 'A nonprofit network of therapists who offer reduced-fee sessions to people without adequate insurance.',
  },
  {
    name: 'Psychology Today therapist directory',
    url: 'https://www.psychologytoday.com/us/therapists',
    note: 'Search by location, insurance, specialty and fee. Many listings say whether a sliding scale is available.',
  },
  {
    name: 'Mental Health America screening tools',
    url: 'https://screening.mhanational.org',
    note: 'Free, anonymous, validated self-checks. A screening is a first step, not a diagnosis.',
  },
];
