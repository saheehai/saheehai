import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Info, LogIn, LogOut, Newspaper, NotebookPen } from 'lucide-react';
import Header from './Header';
import ExperimentsMenu from './ExperimentsMenu';

/**
 * The one header every page shares: the name on the left, everything else on
 * the right. The same buttons in the same order on every page, so moving
 * between chat, journal, news and about never rearranges the top of the
 * screen. Labels drop to icons on phones.
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
            <ExperimentsMenu active={at('/chat')} />
            <NavButton to="/journal" Icon={NotebookPen} active={at('/journal')}>
              Journal
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
