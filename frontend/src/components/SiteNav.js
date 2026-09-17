import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, Info, LifeBuoy, LogIn, LogOut, Newspaper } from 'lucide-react';
import Header from './Header';
import ExperimentsMenu from './ExperimentsMenu';

/**
 * The one header every page shares: the name on the left, everything else on
 * the right. The same buttons in the same order on every page, so moving
 * between pages never rearranges the top of the screen. Labels drop to
 * icons on phones.
 *
 * "Get help" is on every state of the header. Both experiments (chat and
 * journal) live under the Experiments menu, which keeps the beta things
 * together and the header the same width whether or not someone is signed in.
 */

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
            <ExperimentsMenu active={at('/chat') || at('/journal')} />
            <NavButton to="/help" Icon={LifeBuoy} active={at('/help')}>
              Get help
            </NavButton>
            <NavButton to="/resources" Icon={BookOpen} active={at('/resources')}>
              Resources
            </NavButton>
            <NavButton to="/news" Icon={Newspaper} active={at('/news')}>
              News
            </NavButton>
            <NavButton to="/" Icon={Info} active={pathname === '/'}>
              About Us
            </NavButton>
            <NavButton Icon={LogOut} onClick={signOut}>
              Sign Out
            </NavButton>
          </>
        ) : (
          <>
            <NavButton to="/help" Icon={LifeBuoy} active={at('/help')}>
              Get help
            </NavButton>
            <NavButton to="/resources" Icon={BookOpen} active={at('/resources')}>
              Resources
            </NavButton>
            <NavButton to="/news" Icon={Newspaper} active={at('/news')}>
              News
            </NavButton>
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
