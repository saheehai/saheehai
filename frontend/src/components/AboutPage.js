import React from 'react';
import { useNavigate } from 'react-router-dom';
import { HeartHandshake, LogIn, Stethoscope, UserRound } from 'lucide-react';
import Header from './Header';
import ExperimentsMenu from './ExperimentsMenu';

/**
 * The front page, signed in or out. A nonprofit's "who we are" should not sit
 * behind a login, and it is where a first sign-in lands.
 */

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

const VISION_ITEMS = [
  'Mental health support is as accessible as clean water',
  'Technology amplifies rather than replaces human connection',
  'Wellness wisdom is continuously refined through collective learning',
  "Every individual has the tools to navigate life's challenges with resilience and clarity",
];

function AboutPage({ signedIn, onSignOut }) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-screen h-full w-full paper-texture">
      <Header
        left={signedIn ? <ExperimentsMenu /> : <span className="app-header__brand">Saheeh AI</span>}
        title="About Us"
        right={
          signedIn ? (
            <>
              <button type="button" onClick={() => navigate('/journal')} className="logout-button">
                Journal
              </button>
              <button type="button" onClick={onSignOut} className="logout-button">
                Sign Out
              </button>
            </>
          ) : (
            <button type="button" onClick={() => navigate('/signin')} className="logout-button">
              <LogIn size={15} aria-hidden="true" />
              Sign in
            </button>
          )
        }
      />

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
            <p className="about-eyebrow">A nonprofit</p>
            <h1 className="about-hero__title">Care should be easier to reach.</h1>
            <p className="about-lede">
              Saheeh AI is a nonprofit. We build tools that help physicians, therapists and
              patients spend less time navigating the system and more time on what matters:
              getting well, and staying well.
            </p>
          </div>
        </section>

        <section className="about-band">
          <p className="about-band__eyebrow">Why we're a nonprofit</p>
          <p className="about-band__text">
            Nobody here answers to investors or engagement targets. That leaves one question to
            guide every decision: does this truly serve the people we care for? We measure our
            success by genuine improvements in wellbeing, not by how long anyone stays on the
            app.
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
            {VISION_ITEMS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <details className="about-details">
          <summary>Read our full mission statement</summary>
          <div className="about-details__body">
            <h3>Mission</h3>
            <p>
              To democratize wellness by creating synergistic partnerships between humans and
              intelligent technology, empowering every individual to take proactive ownership of
              their holistic flourishing.
            </p>
            <h3>Purpose</h3>
            <p>
              We believe wellness is a fundamental right, not a privilege. Through the thoughtful
              integration of AI and evidence-based wellness practices, we make personalized
              support for mental, physical, emotional, and spiritual health accessible to all,
              regardless of background, resources, or circumstances.
            </p>
            <h3>Vision</h3>
            <p>
              A world where wellness support is universal and evolving, where anyone can access
              personalized guidance, contribute unique insights, and collaborate to unlock deeper
              principles of flourishing. Through secure, adaptive technology, we are building a
              living ecosystem where wisdom, data, and breakthroughs are shared, making every
              interaction more insightful and every person more capable of realizing their full
              potential.
            </p>
            <p className="about-details__closing">
              This mission grounds our work in service to humanity while remaining open to the
              possibilities that emerge when people and technology collaborate toward
              flourishing.
            </p>
          </div>
        </details>

        <section className="about-cta">
          {signedIn ? (
            <button type="button" className="auth-submit about-cta__button" onClick={() => navigate('/chat')}>
              Open the chat
            </button>
          ) : (
            <>
              <button
                type="button"
                className="auth-submit about-cta__button"
                onClick={() => navigate('/signin', { state: { mode: 'signUp' } })}
              >
                Create an account
              </button>
              <button type="button" className="auth-link about-cta__link" onClick={() => navigate('/signin')}>
                I already have an account
              </button>
            </>
          )}
        </section>

        <p className="about-footnote">
          Saheeh AI is a wellness companion, not a therapist or medical professional. If you are
          in crisis, please contact your local emergency services or a crisis line.
        </p>
      </main>
    </div>
  );
}

export default AboutPage;
