import React from 'react';
import { Link } from 'react-router-dom';
import SiteNav from './SiteNav';
import SiteFooter from './SiteFooter';
import { usePageMeta } from '../hooks/usePageMeta';
import pages from '../content/pages.json';

/**
 * The full mission statement, on its own page rather than folded into a
 * <details> on the front page. The wording is the front page's softened
 * version of public/mission.md.
 */
function MissionPage({ signedIn, onSignOut }) {
  usePageMeta({ ...pages['/mission'], path: '/mission' });

  return (
    <div className="flex flex-col min-h-screen h-full w-full paper-texture">
      <SiteNav signedIn={signedIn} onSignOut={onSignOut} />

      <main className="news mission">
        <header className="news__intro">
          <h1>Our mission</h1>
          <p>Wellness is a right, not a privilege.</p>
        </header>

        <article className="news-article__body">
          <h2>Mission</h2>
          <p>
            To democratize wellness by creating partnerships between people and intelligent
            technology, so that every individual can take proactive ownership of their own
            flourishing.
          </p>

          <h2>Purpose</h2>
          <p>
            We believe wellness is a fundamental right, not a privilege. Through the thoughtful
            integration of AI and evidence-based wellness practices, we make personalized support
            for mental, physical, emotional, and spiritual health accessible to all, regardless of
            background, resources, or circumstances.
          </p>

          <h2>What we do</h2>
          <ul>
            <li>
              <strong>Democratize access.</strong> We break down barriers to wellness support with
              technology that offers personalized, scalable guidance and meets people where they
              are.
            </li>
            <li>
              <strong>Make care affordable to reach.</strong> We publish plain-language guides to
              paying for care, and we point people to the programs that already exist to help
              them.
            </li>
            <li>
              <strong>Empower ownership.</strong> We help people take responsibility for their own
              wellbeing, with tools and insights that make informed decisions and sustainable
              growth possible.
            </li>
            <li>
              <strong>Keep humans in the loop.</strong> Technology should amplify human connection,
              never replace it. Our tools exist to make good care more available, not to stand in
              for the people who provide it.
            </li>
          </ul>

          <h2>Vision</h2>
          <p>
            A world where wellness support is universal and evolving, where anyone can access
            personalized guidance, contribute unique insights, and collaborate to unlock deeper
            principles of flourishing. Through secure, adaptive technology, we are building a
            living ecosystem where wisdom, data, and breakthroughs are shared, making every
            interaction more insightful and every person more capable of realizing their full
            potential.
          </p>

          <h2>Our commitment</h2>
          <p>
            We are committed to transparency, ethical AI development, and evidence-based
            practice. We acknowledge our limitations, keep learning from diverse perspectives, and
            remain dedicated to doing no harm.
          </p>
          <p>
            This mission grounds our work in service to humanity while remaining open to the
            possibilities that emerge when people and technology collaborate toward flourishing.
          </p>
        </article>

        <footer className="news-article__footer">
          <Link to="/" className="auth-link">
            ← About Saheeh AI
          </Link>
        </footer>
      </main>

      <SiteFooter />
    </div>
  );
}

export default MissionPage;
