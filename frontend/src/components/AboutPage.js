import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  FlaskConical,
  HeartHandshake,
  LifeBuoy,
  NotebookPen,
  Stethoscope,
  UserRound,
} from 'lucide-react';
import SiteNav from './SiteNav';
import SiteFooter from './SiteFooter';
import NewsletterForm from './NewsletterForm';
import { formatDate, useContentJson } from '../hooks/useContentJson';
import { usePageMeta } from '../hooks/usePageMeta';
import team from '../content/team.json';
import pages from '../content/pages.json';

/**
 * The front page, signed in or out. A nonprofit's "who we are" should not sit
 * behind a login, and it is where a first sign-in lands.
 *
 * Order matters: what a person can do right now, then why we exist, then
 * who we serve and how we work. The three buttons under the headline are
 * the three reasons someone arrives: they need help, they want to learn, or
 * they want to give.
 */

const ACTIONS = [
  {
    Icon: LifeBuoy,
    to: '/help',
    title: 'I need support now',
    body: 'Crisis lines and people to talk to, free, any hour.',
  },
  {
    Icon: BookOpen,
    to: '/resources',
    title: 'Explore resources',
    body: 'Plain-language guides to paying for care and getting started.',
  },
  {
    Icon: HeartHandshake,
    to: '/support',
    title: 'Support our work',
    body: 'Volunteer, contribute, or be told when gifts become deductible.',
  },
];

const LIVE = [
  {
    Icon: BookOpen,
    title: 'Resources',
    tag: null,
    body: 'Guides to hospital charity care, sliding-scale therapy, prescription help and what to expect from a first appointment. Free, no account.',
    to: '/resources',
    cta: 'Read the guides',
  },
  {
    Icon: NotebookPen,
    title: 'Journal',
    tag: 'beta',
    body: 'A private daily journal with a mood and tags, searchable by date. Only you can read it. Stored in the United States, never used to train anything.',
    to: '/journal',
    cta: 'Open the journal',
  },
  {
    Icon: FlaskConical,
    title: 'Chat',
    tag: 'beta',
    body: 'An AI wellness companion for reflection between the moments that matter. It is software, not a therapist, and it says so before you start.',
    to: '/chat',
    cta: 'Try the chat',
  },
];

const SERVE = [
  {
    Icon: Stethoscope,
    title: 'Physicians',
    body:
      'Less friction between spotting a need and connecting a patient with the right support, so care starts sooner and fewer people fall through the cracks.',
  },
  {
    Icon: HeartHandshake,
    title: 'Therapists',
    body:
      'A gentle companion for clients between sessions, and fewer barriers between you and the people who are looking for you.',
  },
  {
    Icon: UserRound,
    title: 'Patients',
    body:
      "Somewhere to talk and reflect at any hour, and a clearer path to professional care when you're ready for it. Your journal is private to you, and stays that way.",
  },
];

const HOW = [
  {
    title: 'Democratize access',
    body: 'We break down barriers to wellness support with technology that offers personalized, scalable guidance and meets people where they are.',
  },
  {
    title: 'Empower ownership',
    body: 'We help people take responsibility for their own wellbeing, with tools and insights that make informed decisions and sustainable growth possible.',
  },
  {
    title: 'Human and AI, together',
    body: 'Technology should amplify human connection, never replace it. Our tools exist to make good care more available, not to stand in for the people who provide it.',
  },
];

const VALUES = [
  {
    title: 'Inclusive',
    body: 'No one should be excluded from the opportunity to thrive. We design for diverse populations and honor different cultural contexts, identities, and paths to wellness.',
  },
  {
    title: 'Integrative',
    body: 'Physical, mental, emotional, and spiritual health are deeply interconnected. We treat wellbeing as a whole.',
  },
  {
    title: 'Service-oriented',
    body: 'The genuine welfare of the people we serve comes before engagement metrics, growth targets, or technical ambition.',
  },
];

function LatestNews() {
  const { data } = useContentJson('news', 'index.json');
  const post = data && data.posts && data.posts[0];
  if (!post) return null;
  return (
    <section className="about-section about-latest" aria-labelledby="about-latest">
      <h2 id="about-latest">Latest</h2>
      <Link to={`/news/${post.slug}`} className="news-card">
        <time dateTime={post.date} className="news-card__date">
          {formatDate(post.date)}
        </time>
        <h3 className="news-card__title">{post.title}</h3>
        {post.summary && <p className="news-card__summary">{post.summary}</p>}
        <span className="news-card__more">Read more</span>
      </Link>
      <p className="about-latest__all">
        <Link to="/news" className="auth-link">
          All news
        </Link>
      </p>
    </section>
  );
}

function AboutPage({ signedIn, onSignOut }) {
  const navigate = useNavigate();
  usePageMeta({ ...pages['/'], path: '/' });

  return (
    <div className="flex flex-col min-h-screen h-full w-full paper-texture">
      <SiteNav signedIn={signedIn} onSignOut={onSignOut} />

      <main className="about">
        <section className="about-hero">
          <img
            className="about-hero__logo"
            src="/saheeh-favicon/favicon.svg"
            alt=""
            width="96"
            height="96"
          />
          <div>
            <h1 className="about-hero__title">Care should be easier to reach.</h1>
            <p className="about-lede">
              Saheeh AI is a nonprofit. We build tools that help physicians, therapists and
              patients spend less time navigating the system and more time on what matters:
              getting well, and staying well.
            </p>
            <p className="about-sub">
              Free, plain-language guides to paying for care. A private journal. An AI companion
              in beta. No ads, no investors, no selling your data.
            </p>
          </div>
        </section>

        <nav className="about-actions" aria-label="Where to start">
          {ACTIONS.map(({ Icon, to, title, body }) => (
            <Link key={to} to={to} className="about-action">
              <Icon size={22} aria-hidden="true" />
              <span className="about-action__title">{title}</span>
              <span className="about-action__body">{body}</span>
            </Link>
          ))}
        </nav>

        <section className="about-band">
          <p className="about-band__eyebrow">Why we're a nonprofit</p>
          <p className="about-band__text">
            Nobody here answers to investors or engagement targets. That leaves one question to
            guide every decision: does this truly serve the people we care for? We measure our
            success by genuine improvements in wellbeing, not by how long anyone stays on the
            app.
          </p>
        </section>

        <section className="about-section" aria-labelledby="about-live">
          <h2 id="about-live">What's live today</h2>
          <div className="about-grid">
            {LIVE.map(({ Icon, title, tag, body, to, cta }) => (
              <div className="about-card about-card--live" key={title}>
                <Icon size={26} className="about-card__icon" aria-hidden="true" />
                <h3>
                  {title}
                  {tag && <span className="about-card__tag">{tag}</span>}
                </h3>
                <p>{body}</p>
                <Link to={to} className="about-card__cta">
                  {cta}
                </Link>
              </div>
            ))}
          </div>
          <p className="about-footnote about-footnote--inline">
            Journal and Chat need a free account. Chat is not available in states that restrict
            AI-delivered mental health services.
          </p>
        </section>

        <section className="about-section">
          <h2>Who we serve</h2>
          <div className="about-grid">
            {SERVE.map(({ Icon, title, body }) => (
              <div className="about-card" key={title}>
                <Icon size={26} className="about-card__icon" aria-hidden="true" />
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="about-section">
          <h2>How we work</h2>
          <ul className="about-list">
            {HOW.map(({ title, body }) => (
              <li key={title}>
                <strong>{title}</strong>
                {body}
              </li>
            ))}
          </ul>
        </section>

        <section className="about-section">
          <h2>What we hold ourselves to</h2>
          <ul className="about-list">
            {VALUES.map(({ title, body }) => (
              <li key={title}>
                <strong>{title}</strong>
                {body}
              </li>
            ))}
          </ul>
          <p className="about-commitment">
            We are committed to transparency, ethical AI development, and evidence-based
            practice. We acknowledge our limitations, keep learning from diverse perspectives,
            and remain dedicated to doing no harm.
          </p>
        </section>

        <section className="about-section">
          <h2>Where this is going</h2>
          <p>We are working toward a world where:</p>
          <ul className="about-vision">
            <li>Mental health support is as accessible as clean water</li>
            <li>Technology amplifies rather than replaces human connection</li>
          </ul>
          <p className="about-more">
            <Link to="/mission" className="auth-link">
              Read our full mission
            </Link>
            {team.directors.length > 0 && (
              <>
                {' · '}
                <Link to="/team" className="auth-link">
                  Meet the people behind it
                </Link>
              </>
            )}
          </p>
        </section>

        <LatestNews />

        {!signedIn && (
          <section className="about-cta">
            <p className="about-cta__lead">Want to try the journal or the chat?</p>
            <button
              type="button"
              className="auth-submit about-cta__button"
              onClick={() => navigate('/signin', { state: { mode: 'signUp' } })}
            >
              Create a free account
            </button>
            <button type="button" className="auth-link about-cta__link" onClick={() => navigate('/signin')}>
              I already have an account
            </button>
          </section>
        )}

        <NewsletterForm
          source="home"
          heading="Stay in touch"
          blurb="New guides and news, by email, rarely."
          compact
        />

        <p className="about-signoff">I love you, and you are going to do great things.</p>
      </main>

      <SiteFooter />
    </div>
  );
}

export default AboutPage;
