import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import Header from './Header';
import { COLORS } from '../utils/constants';

const SECTIONS = [
  {
    heading: 'Our Purpose',
    body: 'We believe wellness is a fundamental right, not a privilege. Through the thoughtful integration of AI and evidence-based wellness practices, we make personalized support for mental, physical, emotional, and spiritual health accessible to all—regardless of background, resources, or circumstances.',
  },
  {
    heading: 'What We Do',
    items: [
      { subhead: 'Democratize Access', body: 'We break down barriers to wellness support by leveraging technology to provide personalized, scalable guidance that meets people where they are in their journey.' },
      { subhead: 'Pioneer Future-Forward Approaches', body: 'We embrace innovation while honoring timeless wellness wisdom, continuously evolving our tools to serve the changing needs of individuals and communities.' },
      { subhead: 'Empower Proactive Ownership', body: 'We help individuals take responsibility for their wellbeing journey, providing tools and insights that enable informed decisions and sustainable growth.' },
      { subhead: 'Create Synergy', body: "We bridge the gap between cutting-edge technology and proven wellness principles, ensuring that human wisdom and artificial intelligence amplify each other's strengths." },
    ],
  },
  {
    heading: 'Who We Are',
    items: [
      { subhead: 'Inclusive', body: 'We ensure no one is excluded from the opportunity to thrive. Our platform is designed to serve diverse populations, honoring different cultural contexts, identities, and paths to wellness.' },
      { subhead: 'Integrative', body: 'We recognize that true self-actualization emerges from the harmonious development of physical, mental, emotional, and spiritual dimensions. We treat wellbeing holistically, understanding that these aspects are deeply interconnected.' },
      { subhead: 'Service-Oriented', body: 'We place the genuine welfare of users above all else—including engagement metrics, growth targets, or technological capabilities. Every decision is guided by one question: "Does this truly serve human flourishing?"' },
    ],
  },
  {
    heading: 'Our Guiding Principles',
    items: [
      { subhead: 'Win-Win', body: 'We create value for individuals while advancing collective wellness. Success means both personal transformation and broader societal impact.' },
      { subhead: 'Begin with the End in Mind', body: 'We support users in clarifying their values, defining their highest potential, and designing their lives with intentionality and purpose.' },
      { subhead: 'Proactivity', body: 'We encourage individuals to take ownership of their wellbeing journey, providing tools that foster agency, self-awareness, and meaningful change.' },
    ],
  },
];

const VISION_ITEMS = [
  "Mental health support is as accessible as clean water",
  "Technology amplifies rather than replaces human connection",
  "Wellness wisdom is continuously refined through collective learning",
  "Every individual has the tools to navigate life's challenges with resilience and clarity",
  "The boundaries between human and artificial intelligence create new possibilities for growth rather than new forms of isolation",
];

const divider = (
  <hr style={{ border: 'none', borderTop: `1px solid ${COLORS.brownBorderLight}`, marginBottom: '40px' }} />
);

function Section({ heading, body, items }) {
  return (
    <>
      <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '16px' }}>{heading}</h2>
      {body && (
        <p style={{ fontSize: '16px', lineHeight: 1.6, marginBottom: '40px' }}>{body}</p>
      )}
      {items?.map(({ subhead, body: itemBody }, i) => (
        <React.Fragment key={subhead}>
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginTop: '24px', marginBottom: '8px' }}>
            {subhead}
          </h3>
          <p style={{ fontSize: '16px', lineHeight: 1.6, marginBottom: i === items.length - 1 ? '40px' : '16px' }}>
            {itemBody}
          </p>
        </React.Fragment>
      ))}
      {divider}
    </>
  );
}

function MissionPage() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-screen h-full w-full paper-texture">
      <Header
        left={
          <button onClick={() => navigate('/')} className="logout-button back-button">
            <ChevronLeft size={16} />
            Chat
          </button>
        }
        title="About Us"
      />

      <div className="mission-content">
        <div style={{ color: COLORS.darkBrown }}>
          <h1 style={{ fontSize: '32px', fontWeight: 600, marginBottom: '16px' }}>Mission Statement</h1>

          <p style={{ fontSize: '18px', fontWeight: 500, marginBottom: '40px', lineHeight: 1.6 }}>
            To democratize wellness by creating synergistic partnerships between humans and intelligent technology, empowering every individual to take proactive ownership of their holistic flourishing.
          </p>

          {divider}

          {SECTIONS.map((section) => (
            <Section key={section.heading} {...section} />
          ))}

          <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '16px' }}>Our Vision</h2>
          <p style={{ fontSize: '16px', lineHeight: 1.6, marginBottom: '24px' }}>
            A world where wellness support is universal and evolving—where any conscious being can access personalized guidance, contribute unique insights, and collaborate to unlock deeper principles of flourishing. Through secure, adaptive technology, we're building a living ecosystem where wisdom, data, and breakthroughs are shared across diverse forms of intelligence, making every interaction more insightful and every being more capable of realizing their full potential.
          </p>

          <h3 style={{ fontSize: '18px', fontWeight: 600, marginTop: '24px', marginBottom: '16px' }}>
            We envision a future where:
          </h3>
          <ul style={{ fontSize: '16px', lineHeight: 1.8, marginBottom: '40px', paddingLeft: '20px' }}>
            {VISION_ITEMS.map((item) => <li key={item}>{item}</li>)}
          </ul>

          {divider}

          <h2 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '16px' }}>Our Commitment</h2>
          <p style={{ fontSize: '16px', lineHeight: 1.6, marginBottom: '40px' }}>
            We are committed to transparency, ethical AI development, and evidence-based practices. We acknowledge our limitations, continuously learn from diverse perspectives, and remain dedicated to doing no harm. We measure our success not by user retention or engagement metrics, but by genuine improvements in wellbeing and the expansion of human potential.
          </p>

          {divider}

          <p style={{ fontSize: '14px', fontStyle: 'italic', lineHeight: 1.6, marginBottom: '40px', opacity: 0.8 }}>
            This mission statement grounds our work in service to humanity while remaining open to the transformative possibilities that emerge when consciousness—in all its forms—collaborates toward flourishing.
          </p>
        </div>
      </div>
    </div>
  );
}

export default MissionPage;
