/**
 * Terms of Use, Privacy Policy and the Cloudflare Turnstile addendum.
 *
 * Plain Markdown strings, rendered by LegalPage. Kept as content rather than
 * JSX so a wording change is a wording change, and so the same text can be
 * lifted into a PDF or a filing without untangling markup.
 *
 * Change LAST_UPDATED whenever any of the text below changes: it is the date
 * people are told these terms took effect.
 */

import { CONTACT_HREF, CONTACT_LABEL, ORG_NAME } from './site';

export const LAST_UPDATED = '2026-09-17';

export { ORG_NAME };

// Where privacy requests and legal notices go: the inbox in content/site.js
// when one exists, otherwise the public issue tracker, which is the one
// channel that is always answered.
export const CONTACT_URL = CONTACT_HREF;

export const TERMS = `
## 1. Who we are and what these Terms cover

${ORG_NAME} ("we", "us", "our") is a nonprofit organization based in Texas.
We have applied to the Internal Revenue Service for recognition as a
501(c)(3) public charity.

Our website at saheeh.ai (the "Site") is mostly informational: who we are,
what we are working on, crisis and support lines, and plain-language guides
to paying for care and to mental health. Under "Experiments" the Site also
offers beta features, currently an AI wellness companion (chat) and a
private journal (the "Experiments"). The Site and the Experiments together
are the "Service".

These Terms of Use (the "Terms") are a binding agreement between you and us.
By creating an account, ticking the acknowledgement before your first chat,
or otherwise using the Service, you agree to these Terms and to our
[Privacy Policy](#privacy). If you do not agree, please do not use the Service.

## 2. The Experiments are beta

Everything under Experiments is a work in progress and is labelled beta for
a reason. Features may change, break, pause or disappear without notice,
and data in them may be lost. The Experiments are a secondary part of what we
do, offered so we can learn what helps; they are not the product, and we
make no promise about their availability or fitness for any purpose.

## 3. The Service is not medical or mental health care

**The Service does not provide medical advice, diagnosis, treatment, therapy,
counseling or crisis intervention.** The wellness companion is software. It
is not a physician, psychologist, therapist, counselor or other licensed
professional, and nothing it says is professional advice. Its responses are
generated automatically and may be incomplete, inaccurate or wrong. The
general wellness information on the Site is educational and is not advice
about your situation.

Using the Service does not create a doctor-patient, therapist-client or any
other professional or fiduciary relationship between you and us. Never
disregard, delay or stop professional care because of something you read on
the Service. If you have a health question, ask a qualified professional.

We do not verify the credentials of any physician, therapist or other
provider you may be connected with or referred to through the Service, and we
are not responsible for their care.

## 4. Emergencies

**The Service is not monitored in real time and cannot help in an emergency.**
If you are thinking about harming yourself or someone else, or you are in any
other crisis, stop using the Service and get help now:

- Call or text **988** (Suicide and Crisis Lifeline, United States)
- Text **HOME** to **741741** (Crisis Text Line)
- Call **911** or your local emergency number

## 5. You are talking to an AI

When you use the wellness companion you are interacting with an artificial
intelligence system, not a human. We tell you this before your first chat and
we repeat it here so there is no doubt.

The companion is built on a general-purpose large language model provided by
a third party and guided by instructions we write. We use it only to offer
supportive, general wellness conversation. We do not design or use it to
manipulate anyone into self-harm, harm to others or unlawful conduct; to
discriminate against anyone on the basis of a protected characteristic; to
identify people by their biometrics; or to make decisions about anyone's
access to health care, housing, employment, credit or benefits. If you think
the companion has behaved in one of those ways, [tell us](${CONTACT_URL}) and
we will investigate. Texas residents may also contact the Office of the
Texas Attorney General, which enforces the Texas Responsible Artificial
Intelligence Governance Act.

Language models can be confidently wrong, can misunderstand you, and can
reflect biases in the data they were trained on. You are responsible for how
you use anything the companion says. Do not rely on it for medical, legal,
financial or safety decisions.

## 6. Where the Experiments are available

Some places prohibit or restrict AI-delivered mental health services. Where
that is the case we do not offer the Experiments at all: the chat and the
journal are refused from those locations, and you will see a message saying
so. The informational parts of the Site remain available everywhere. We
determine your location from your network connection at the time of each
request, we keep that list under regular review as the law changes, and we
may add or remove places from it without notice. You agree not to use a VPN,
proxy or other means to get around this.

## 7. Who may use the Service

You must be at least 18 years old and able to enter into a binding contract
to use the Experiments. The Service is not directed to children, and we do
not knowingly collect information from anyone under 18. If you believe a
child has created an account, [contact us](${CONTACT_URL}) and we will delete
it.

## 8. Your account

You need an account to use the Experiments. You agree to give us an email
address you control, to keep your password private, and to tell us promptly
if you think your account has been used without your permission. You are
responsible for what happens under your account. For your protection, you
are signed out automatically after a period of inactivity.

## 9. Acceptable use

The Service is offered free of charge by a small nonprofit, and abuse costs
real money that would otherwise go to the people we serve. You agree not to:

- use the Service for anything unlawful, harmful or harassing;
- attempt to make the companion produce content that is dangerous, illegal
  or intended to hurt someone;
- try to manipulate, "jailbreak" or reverse engineer the companion or its
  instructions;
- create accounts by automated means, share accounts, or work around the
  daily usage limits;
- scrape, probe, overload or interfere with the Service or its
  infrastructure, or access it in any way other than through the interface we
  provide;
- upload anything that infringes someone else's rights or that you do not
  have the right to share;
- use a profile picture or nickname that is graphic, sexual, violent,
  hateful or harassing, that shows a child, or that shows someone else
  without their permission. Your picture is shown only to you, but this
  rule still applies.

We may limit, suspend or close accounts that violate these Terms. An
account with a picture or name that breaks the rule above will be closed.

## 10. Your content

You keep ownership of what you write in the chat and the journal, and of
the nickname and picture you put on your profile ("Your
Content"). You give us a limited, non-exclusive license to store, process,
transmit and display Your Content solely to operate, secure and improve the
Service. We do not sell Your Content, we do not use it for advertising, and
we do not use it to train AI models. How we handle it is described in the
[Privacy Policy](#privacy).

## 11. Our content and open source

The name Saheeh AI, our logo and the text and design of the Site belong to
us. The software that runs the Service is published under an open-source
license in our [public repository](https://github.com/saheehai/saheehai);
that license, not these Terms, governs your use of the code.

## 12. No warranty

**The Service is provided "as is" and "as available", without warranty of any
kind.** To the fullest extent permitted by law, we disclaim all warranties,
express or implied, including any warranty of merchantability, fitness for a
particular purpose, accuracy, non-infringement, and uninterrupted or
error-free operation. We do not promise that the Service will meet your needs,
that its content is correct, or that Your Content will never be lost.

## 13. Limitation of liability

**To the fullest extent permitted by law, ${ORG_NAME} and its directors,
officers, volunteers, employees, contractors and agents will not be liable
for any indirect, incidental, special, consequential, exemplary or punitive
damages, or for any loss of data, health outcome, or personal injury, arising
out of or related to the Service or these Terms**, however caused and under
any theory of liability, even if we were told such damages were possible.

Our total liability for all claims relating to the Service will not exceed
one hundred US dollars (US$100). Some jurisdictions do not allow some of
these limits, so some of them may not apply to you. Nothing in these Terms
limits liability that cannot be limited by law.

The people who run ${ORG_NAME} are volunteers and officers of a nonprofit.
To the extent Texas law, including the Charitable Immunity and Liability Act
of 1987 (Texas Civil Practice and Remedies Code, Chapter 84), protects them
from personal liability, these Terms do not waive that protection.

## 14. Indemnification

You agree to defend, indemnify and hold harmless ${ORG_NAME} and its directors,
officers, volunteers, employees and agents from any claim, loss, liability or
expense (including reasonable attorneys' fees) arising from Your Content, your
use of the Service, or your breach of these Terms.

## 15. Ending your use

You can stop using the Service at any time, and you can ask us to delete your
account and data (see the [Privacy Policy](#privacy)). We may suspend or end
the Service or any Experiment, or your access to it, at any time, with or
without notice, including if we believe you have broken these Terms.
Sections 3, 4, 5, 10, 12, 13, 14 and 17 survive.

## 16. Changes to the Service and these Terms

The Service is a work in progress and will change. We may update these Terms
from time to time. When we do, we will change the "last updated" date at the
top of this page and, for significant changes, post a note in our
[News](/news). Continuing to use the Service after a change means you accept
the new Terms.

## 17. Governing law and disputes

These Terms are governed by the laws of the State of Texas and applicable
United States federal law, without regard to conflict-of-law rules. Any
dispute that cannot be resolved informally will be brought exclusively in the
state or federal courts located in Texas, and you consent to their
jurisdiction. Before filing a claim, you agree to [contact us](${CONTACT_URL})
and try in good faith to resolve it with us for at least thirty days.

If any part of these Terms is found unenforceable, the rest remains in effect.
Our failure to enforce a provision is not a waiver of it. These Terms and the
Privacy Policy are the entire agreement between you and us about the Service.

## 18. Contact

Questions about these Terms: [${CONTACT_LABEL}](${CONTACT_URL}).
`;

export const PRIVACY = `
This policy explains what ${ORG_NAME} collects when you use saheeh.ai, why,
who sees it, and what you can do about it. It is written to be read. If
anything is unclear, [ask us](${CONTACT_URL}).

The short version: **we collect only what the Service needs to work, we do
not sell it, we set no cookies and run no analytics or tracking, everything
is stored in the United States on AWS, and your journal and chat are visible
only to you and to the systems that store and answer them.**

Reading the informational parts of the Site needs no account and sends us
nothing beyond the ordinary web request that fetches the page. The rest of
this policy is mostly about the beta Experiments (the wellness companion and
the journal), which do need an account.

## 1. What we collect

**Account information.** Your email address and a password. The password is
never sent to us in a readable form: sign-in uses a challenge-response
protocol (SRP) handled by Amazon Cognito, and only a salted hash is stored.
We also record that you confirmed you are 18 or older, and the date of the
Terms and this policy that you accepted when you created the account.

**Profile (optional).** A nickname and a small picture, if you choose to add
them on the Account page. They are shown only to you. The nickname is also
given to the companion so it can address you by it. Your browser shrinks
the picture to a small square before sending it, which removes any
information the original file carried, such as where a photo was taken.

**Chat messages (Experiments, beta).** What you write to the companion and
what it writes back, together with a conversation identifier so a
conversation can continue. The companion may respond to what you share,
including health information, so please share only what you are comfortable
having stored.

**Journal entries (Experiments, beta).** The text of each entry, the mood
you pick (if any), and the date. Entries are tied to your account and are
never shown to any other user.

**Usage and technical data.** When your browser talks to our servers, the
request is logged with your IP address, browser type, the time, the route
called, and an internal account identifier. We use these logs to keep the
Service running and to investigate abuse. They do not contain the text of
your messages or entries and are deleted after 30 days.

**Bot-check signals at sign-up.** Creating an account runs a Cloudflare
Turnstile check to stop automated account creation. Cloudflare receives
signals such as your IP address and browser characteristics for that purpose
only. See the [Cloudflare Turnstile Privacy Addendum](#turnstile) below.

**Newsletter sign-ups.** If you ask for our email updates: your email
address, which page you signed up from, and when. Nothing is sent until you
click the confirmation link we email you, every message we send carries an
unsubscribe link, and we send nothing but our own updates. Unsubscribing
deletes the address within 30 days.

**Data kept on your device.** Your browser keeps your sign-in session, a
copy of the current chat, an unsent journal draft, a local usage counter, the
time you were last active (for the automatic sign-out), and a flag recording
that you acknowledged the notice before your first chat. These live in your
browser's local storage, not in a cookie, and are cleared when you sign out.

**Cookies: none.** The Site does not set cookies of any kind, and there is no
analytics, advertising or tracking code on it. The only third-party code that
runs is Cloudflare's bot check on the sign-up form, and Cloudflare may set
its own cookies on its own domain as part of that check (see the addendum
below). If we ever add cookies or analytics, we will update this policy first
and, where the law requires it, ask for your consent.

## 2. How we use it

- To provide the Service: authenticate you, answer your messages, and save
  and show your journal.
- To keep the Service safe and fair: enforce daily limits, detect abuse and
  protect other users.
- To send you the email updates you asked for, and nothing else by email.
- To improve the Service, using aggregate information that does not identify
  anyone.
- To meet legal obligations and to protect our rights and yours.

We do not use your chat or journal content to train any AI model, and we do
not permit our providers to do so. We do not use your information for
advertising, and we do not sell or rent it.

## 3. Where it lives and who processes it

Everything is stored and processed in the United States, in Amazon Web
Services' us-east-1 region. We run the Service on infrastructure provided by
third parties who process data on our behalf and under our instructions:

- **Amazon Web Services (AWS)** hosts everything: accounts (Cognito), the
  database (DynamoDB), the application (Lambda and API Gateway), the website
  (S3 and CloudFront), the newsletter list and its email (DynamoDB and SES)
  and the language model (Amazon Bedrock). Your messages
  are sent to Bedrock to generate a reply. AWS states that Bedrock does not
  store or log prompts and responses, does not use them to train any model,
  and does not share them with third parties.
- **Cloudflare, Inc.** provides the Turnstile bot check at sign-up only. No
  chat or journal content passes through Cloudflare.

We do not share personal information with anyone else, except: (a) if the law
requires it or a valid legal process compels it; (b) to protect the safety of
a person or the security of the Service; or (c) with your direction or
consent. If ${ORG_NAME} is ever merged into or succeeded by another
organization, your data would move with it under this policy.

## 4. How long we keep it

Your account, chat history, journal and profile are kept for as long as
your account exists. Server logs are kept for 30 days. Deleting your
account from the Account page removes your account, chat history, journal
entries and profile straight away. If you ask us to do it instead, we do
it within 30 days. Either way, copies may remain briefly in backups, or
where we must keep them to meet a legal obligation. A newsletter address is kept until you
unsubscribe, and deleted within 30 days after.

## 5. Security

All traffic between your browser and the Service is encrypted in transit
(TLS). Data is encrypted at rest by AWS. Every request to our servers is
checked against your signed-in session before any application code runs, and
data is looked up only by the identity of the person asking, never by an
identifier the browser supplies. Access to the production systems is limited
to the people who need it to run the Service.

No system is perfectly secure. If we learn of a breach that affects you, we
will tell you without unreasonable delay and as the law requires.

## 6. Health information and HIPAA

Things you tell the companion or write in your journal may be sensitive
health information. We protect it as described above regardless of how the
law classifies it.

${ORG_NAME} is not currently a "covered entity" under the Health Insurance
Portability and Accountability Act (HIPAA), and the Service is offered to you
directly rather than through a doctor or health plan. That means HIPAA
itself does not govern most of the information you give us; this policy does.
Where we work with a physician, therapist or other covered entity under a
business associate agreement, information we receive from them is handled as
that agreement and HIPAA require. We follow HIPAA's security safeguards as a
baseline for the whole Service either way.

## 7. Your choices and rights

These rights are yours wherever you live. We give them to everyone rather
than only where a particular law requires it, so that they do not depend on
which law applies to you. Whatever your location, you can:

- **See** what we hold about you, and get a copy;
- **Correct** your email address;
- **Delete** your account and everything in it;
- **Object** to or restrict a particular use of your information;
- **Complain** to a supervisory authority where you live.

The first three are on the Account page when you are signed in: download a
copy of your data, change your email address, delete your chats and journal,
or delete the whole account. For anything else, or if you would rather we
did it, [contact us](${CONTACT_URL}) from the email address on your account,
or tell us another way to confirm it is you. We will answer within 45 days.

**Texas.** Texas residents have the rights above under the Texas Data
Privacy and Security Act. We do not sell personal data, do not use it for
targeted advertising, and do not profile anyone.

**European Economic Area, United Kingdom and Switzerland.** The Service is
offered from the United States and is not currently directed at people in
these places. If you use it from there anyway, our legal bases are performing
our agreement with you (the Terms of Use) and our legitimate interests in
keeping the Service secure and improving it, and your data is transferred to
and stored in the United States. You may lodge a complaint with your local
supervisory authority.

**California and other US states.** Residents of states with consumer privacy
laws have the rights above. We do not sell or share personal information for
cross-context behavioral advertising, so there is nothing to opt out of.

We will not treat you differently for exercising any of these rights.

## 8. Children

The Service is for adults. We do not knowingly collect information from
anyone under 18, and never from a child under 13. If you believe we have,
[tell us](${CONTACT_URL}) and we will delete it.

## 9. Changes

We will update this policy as the Service changes. The "last updated" date
at the top of the page tells you when. Significant changes will also be
posted in our [News](/news).

## 10. Contact

Privacy questions and requests: [${CONTACT_LABEL}](${CONTACT_URL}).
`;

export const TURNSTILE_INTRO = `
Creating an account on saheeh.ai runs a Cloudflare Turnstile check. This is
the only place we use Cloudflare, and no chat or journal content passes
through it. Cloudflare asks websites that use Turnstile to make its Turnstile
Privacy Addendum available to visitors; it is reproduced below as published
by Cloudflare, Inc. on
[cloudflare.com](https://www.cloudflare.com/turnstile-privacy-policy/). It
supplements [Cloudflare's Privacy Policy](https://www.cloudflare.com/privacypolicy/).
In the text that follows, "we" and "our" mean Cloudflare, not ${ORG_NAME}.
`;

export const TURNSTILE_ADDENDUM = `
**Turnstile Privacy Addendum**
_Last updated: June 18, 2025_

### 1. Introduction

Turnstile, developed by Cloudflare, Inc. (Cloudflare), is a pro-privacy
website security tool that processes minimal Signals (as defined below)
solely to protect web properties against malicious activity by
distinguishing human users from bots and blocking bot traffic.

Cloudflare does not control whether a website chooses to use Turnstile;
instead, we make Turnstile available to any website that is looking for a way
to detect and block bot traffic.

### 2. Scope of this Addendum

This Turnstile Addendum is supplemental to Cloudflare's main Privacy Policy.
It provides additional information specific to your use and interaction with
Turnstile. This Addendum also applies to the personal data processed using
Cloudflare's Challenge Platform, and any reference to "Turnstile" in this
addendum applies equally to the Challenge Platform.

The Cloudflare Privacy Policy continues to apply to your use and interaction
with Turnstile, except where this Turnstile Addendum provides more specific
information. In those cases, the more specific information will apply
instead.

### 3. Information we collect

Cloudflare Turnstile processes a variety of client-side signals ("Signals")
such as client IP address, TLS Fingerprint, User-Agent Header and Sitekey and
associated origin. Cloudflare does not have the ability to directly identify
any individuals from any of the Signals Turnstile collects, including IP
addresses.

### 4. How we use information we collect

**(i) Bot detection and blocking**

Turnstile is a tool to protect web properties by distinguishing human users
from bots and blocking any detected bot traffic that could otherwise harm the
safety and security of that property.

It does so by evaluating the Signals listed above specific to both the
website visitor and the website visited. The purpose of collecting these
Signals is not to identify, profile or target any individuals but solely to
detect and block bots. The Signals collected by Turnstile are strictly
necessary for this purpose (i.e. detecting and blocking bots to enable
visitors to enjoy a safe and secure experience when visiting websites that
have implemented Turnstile).

Cloudflare is a data processor of Signals that we process to provide the
Turnstile service to our customers, that is, securing our customers'
websites. This means that we process Signals for this purpose on behalf of,
and pursuant to instructions issued by, our website operator customers (who
are the data controllers of any data processed for this purpose). If you have
questions, or wish to exercise any data protection rights, regarding
Cloudflare's processing of Turnstile data to provide our service, please
contact the relevant website operator.

**(ii) Improving Turnstile's bot detection capabilities**

Cloudflare also processes the Signals described in this Privacy Notice to
improve Turnstile. This is necessary to refine and improve our bot detection
algorithms in order to respond to evolving bot threats, and to maintain the
security of the web properties that website visitors choose to visit.

Cloudflare is a data controller of Signals that we process to improve
Turnstile's bot detection capabilities. This Turnstile Privacy Notice (in
conjunction with Cloudflare's main Privacy Policy) governs our processing of
Signals for this purpose.

### 5. Notice to EU and UK residents

To the extent that the data described in the Turnstile Privacy Notice
qualifies as personal data, then:

When processing this personal data as a processor to protect our customers'
websites, our customers, as controllers, determine the lawful basis of this
processing, and we process this data under their instruction and on their
behalf; and

When processing this personal data as a controller, we rely on our
legitimate interests in improving the effectiveness of Turnstile's bot
detection capabilities to process this Turnstile data.

### 6. Cookies

The Signals collected by Turnstile are strictly necessary for the purpose of
detecting and blocking bots to enable visitors to enjoy a safe and secure
experience when visiting websites that have implemented Turnstile.

For more information about the cookies used by Cloudflare, please check our
[Cookie Policy](https://www.cloudflare.com/cookie-policy/) and our
[Turnstile Developer Docs](https://developers.cloudflare.com/turnstile/).

### Contact for privacy concerns

If you have questions or concerns about this Turnstile Privacy Notice or your
personal data processed through Turnstile, please contact Cloudflare's Data
Protection Officer at dpo@cloudflare.com.
`;
