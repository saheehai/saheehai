import React from 'react';
import { Link } from 'react-router-dom';
import { Code2, HeartHandshake, Languages, Stethoscope } from 'lucide-react';
import SiteNav from './SiteNav';
import SiteFooter from './SiteFooter';
import NewsletterForm from './NewsletterForm';
import { usePageMeta } from '../hooks/usePageMeta';
import { CONTACT_HREF, CONTACT_LABEL, ORG_NAME, REPO_URL } from '../content/site';
import pages from '../content/pages.json';

/**
 * Support us. No donate button yet, on purpose: until the IRS determination
 * arrives we cannot promise a gift is deductible, so we ask for an email
 * address and for time instead. The wording about status is the one the
 * IRS expects from an organization whose application is pending.
 */

const VOLUNTEER = [
  {
    Icon: Stethoscope,
    title: 'Clinicians and social workers',
    body: 'Review a resource article for accuracy before it goes up. An hour a month is enough. Every article carries the name of the person who reviewed it.',
  },
  {
    Icon: Languages,
    title: 'Translators',
    body: 'Help us put the guides in more languages. Tell us which ones you speak. Everything here should be readable by the people who need it most.',
  },
  {
    Icon: Code2,
    title: 'Engineers and designers',
    body: 'The whole site is open source. Pick up an issue, or open one. React, Python and AWS.',
  },
  {
    Icon: HeartHandshake,
    title: 'People who have been through it',
    body: 'If you have fought a hospital bill, found a sliding-scale clinic, or navigated a first therapy appointment, your notes could become a guide for the next person.',
  },
];

function SupportPage({ signedIn, onSignOut }) {
  usePageMeta({ ...pages['/support'], path: '/support' });

  return (
    <div className="flex flex-col min-h-screen h-full w-full paper-texture">
      <SiteNav signedIn={signedIn} onSignOut={onSignOut} />

      <main className="news support">
        <header className="news__intro">
          <h1>Support our work</h1>
          <p>
            {ORG_NAME} has no investors, no ads, and no paid staff. It runs on volunteer time and,
            soon, on gifts. Here is how to help right now.
          </p>
        </header>

        <section className="help-section" aria-labelledby="support-gifts">
          <h2 id="support-gifts">About donations</h2>
          <p>
            {ORG_NAME} is a Texas nonprofit corporation that has applied to the Internal Revenue
            Service for recognition as a 501(c)(3) public charity. Until that recognition
            arrives, we cannot promise that a gift is tax-deductible, so we are not accepting
            donations yet. If recognition is granted it applies retroactively to the date we were
            formed, and we will open a donation page the same day and say so in our{' '}
            <Link to="/news">News</Link>.
          </p>
          <NewsletterForm
            source="support"
            heading="Be the first to know"
            blurb="Leave your email and we will tell you when gifts become deductible, and when there is something new worth reading."
          />
        </section>

        <section className="help-section" aria-labelledby="support-volunteer">
          <h2 id="support-volunteer">Volunteer</h2>
          <p className="help-section__lede">
            What we need most is not money. It is a few hours from people who know things.
          </p>
          <div className="about-grid">
            {VOLUNTEER.map(({ Icon, title, body }) => (
              <div className="about-card" key={title}>
                <Icon size={26} className="about-card__icon" aria-hidden="true" />
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
          <p className="support-how">
            To volunteer, write to us at{' '}
            <a href={CONTACT_HREF} target="_blank" rel="noopener noreferrer">
              {CONTACT_LABEL}
            </a>{' '}
            and say what you would like to do and roughly how much time you have. Engineers can go
            straight to{' '}
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
              the repository
            </a>
            .
          </p>
        </section>

        <section className="help-section" aria-labelledby="support-spread">
          <h2 id="support-spread">Pass it on</h2>
          <p>
            If one of our guides helped you, send it to someone. The <Link to="/help">Get help</Link>{' '}
            page is written to be shared with a person who needs it today.
          </p>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

export default SupportPage;
