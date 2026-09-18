import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  FlaskConical,
  Info,
  Layers,
  LifeBuoy,
  LogIn,
  LogOut,
  MessageCircle,
  Newspaper,
  NotebookPen,
  UserRound,
} from 'lucide-react';
import Header from './Header';
import NavMenu from './NavMenu';
import Avatar from './Avatar';
import { useProfile } from '../context/ProfileContext';

/**
 * The one header every page shares: the name on the left, everything else on
 * the right. The same buttons in the same order on every page, so moving
 * between pages never rearranges the top of the screen. Labels drop to
 * icons on phones.
 *
 * Three dropdowns keep the header short. Both experiments (chat and journal)
 * live under Experiments, which keeps the beta things together. The guides,
 * the crisis lines and the news live under Resources. The account menu, on
 * the far right behind the person's picture, holds the Account page and
 * Sign out: one deliberate tap to leave, rather than the last of a row of
 * small icons. A crisis line is always one tap away without opening the
 * menu: the footer carries 988 on every page that has a footer, and the two
 * that do not (chat and Practice) carry their own line instead.
 */

// Everything under Experiments is beta, and says so: the companion is a
// secondary feature, not the product, and nobody should mistake it for care.
const EXPERIMENTS = [
  { label: 'Chat', tag: 'beta', to: '/chat', Icon: MessageCircle },
  { label: 'Journal', tag: 'beta', to: '/journal', Icon: NotebookPen },
  { label: 'Practice', tag: 'beta', to: '/practice', Icon: Layers },
];

// "Get help" first: it is the one someone may need in a hurry.
const RESOURCES = [
  { label: 'Get help', to: '/help', Icon: LifeBuoy },
  { label: 'Guides', to: '/resources', Icon: BookOpen },
  { label: 'News', to: '/news', Icon: Newspaper },
];

function NavButton({ to, Icon, children, active, onClick }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      className={`logout-button nav-btn ${active ? 'is-active' : ''}`}
      onClick={onClick || (() => navigate(to))}
      aria-current={active ? 'page' : undefined}
      aria-label={children}
    >
      <Icon size={15} aria-hidden="true" />
      <span className="nav-btn__label">{children}</span>
    </button>
  );
}

function SiteNav({ signedIn, onSignOut }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { profile } = useProfile();
  const at = (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`);

  const signOut = () => {
    onSignOut();
    // The front page, not the sign-in card a protected route would bounce to.
    navigate('/', { replace: true });
  };

  const nickname = profile?.nickname || '';

  return (
    <Header
      left={
        <Link to="/" className="app-header__brand">
          Saheeh AI
        </Link>
      }
      right={
        signedIn ? (
          <>
            <NavMenu
              label="Experiments"
              Icon={FlaskConical}
              items={EXPERIMENTS}
              active={at('/chat') || at('/journal') || at('/practice')}
            />
            <NavMenu
              label="Resources"
              Icon={BookOpen}
              items={RESOURCES}
              active={at('/help') || at('/resources') || at('/news')}
            />
            <NavButton to="/" Icon={Info} active={pathname === '/'}>
              About Us
            </NavButton>
            <NavMenu
              label={nickname || 'Account'}
              Icon={UserRound}
              trigger={<Avatar src={profile?.avatar} name={nickname} size={24} />}
              className="account-btn"
              items={[
                { label: 'Account', to: '/account', Icon: UserRound },
                { label: 'Sign out', onSelect: signOut, Icon: LogOut, divider: true },
              ]}
              active={at('/account')}
            />
          </>
        ) : (
          <>
            <NavMenu
              label="Resources"
              Icon={BookOpen}
              items={RESOURCES}
              active={at('/help') || at('/resources') || at('/news')}
            />
            <NavButton to="/" Icon={Info} active={pathname === '/'}>
              About Us
            </NavButton>
            <NavButton to="/signin" Icon={LogIn} active={at('/signin')}>
              Sign in
            </NavButton>
          </>
        )
      }
    />
  );
}

export default SiteNav;
