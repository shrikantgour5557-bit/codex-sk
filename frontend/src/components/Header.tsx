import { Link } from 'react-router-dom';

export function Header() {
  return (
    <header className="site-header">
      <div className="container row-between">
        <Link to="/" className="logo">
          Free<span>AdSpace</span>
        </Link>
        <nav className="row-gap">
          <Link to="/login" className="link-btn">Login</Link>
          <Link to="/register" className="primary-btn">Register</Link>
        </nav>
      </div>
    </header>
  );
}
