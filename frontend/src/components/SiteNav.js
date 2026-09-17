import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  FlaskConical,
  Info,
  LifeBuoy,
  LogIn,
  LogOut,
  MessageCircle,
  Newspaper,
  NotebookPen,
} from 'lucide-react';
import Header from './Header';
import NavMenu from './NavMenu';

/**
 * The one header every page shares: the name on the left, everything else on
 * the right. The same buttons in the same order on every page, so moving
 * between pages never rearranges the top of the screen. Labels drop to
 * icons on phones.
 *
 * Two dropdowns keep the header short. Both experiments (chat and journal)
 * live under Experiments, which keeps the beta things together. The guides,
 * the crisis lines and the news live under Resources. The footer still puts
 * 988 on every page, so a crisis line is one tap away without the menu.
 */

// Everything under Experiments is beta, and says so: the companion is a
// secondary feature, not the product, and nobody should mistake it for care.
const EXPERIMENTS = [
  { label: 'Chat', tag: 'beta', to: '/chat', Icon: MessageCircle },
  { label: 'Journal', tag: 'beta', to: '/journal', Icon: NotebookPen },
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
  const at = (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`);

  const signOut = () => {
    onSignOut();
    // The front page, not the sign-in card a protected route would bounce to.
    navigate('/', { replace: true });
  };

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
              active={at('/chat') || at('/journal')}
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
            <NavButton Icon={LogOut} onClick={signOut}>
              Sign Out
            </NavButton>
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
