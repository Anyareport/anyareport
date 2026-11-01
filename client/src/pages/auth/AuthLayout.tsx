import {
  AlertOutlined,
  CameraOutlined,
  ClockCircleOutlined,
  LeftOutlined,
} from '@ant-design/icons';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../../components/Logo';
import './AuthLayout.css';

const benefits = [
  { icon: <CameraOutlined aria-hidden="true" />, text: 'Report with a photo or a short note' },
  { icon: <ClockCircleOutlined aria-hidden="true" />, text: 'Track every report until it is resolved' },
  { icon: <AlertOutlined aria-hidden="true" />, text: 'Get emergency alerts for your barangay' },
];

interface AuthLayoutProps {
  children: ReactNode;
  page: 'login' | 'register';
}

export default function AuthLayout({ children, page }: AuthLayoutProps) {
  const mobileTagline =
    page === 'login' ? 'Report it. Track it. Resolved.' : 'Create your resident account.';

  return (
    <div className={`auth-layout auth-layout--${page}`}>
      <header className="auth-brand-panel">
        <Link className="auth-home-link auth-home-link--mobile" to="/">
          <LeftOutlined aria-hidden="true" />
          <span>Back to home</span>
        </Link>
        <Link className="auth-brand-logo" to="/" aria-label="Anyareport home">
          <Logo size="lg" />
        </Link>
        <p className="auth-mobile-tagline">{mobileTagline}</p>

        <div className="auth-brand-copy">
          <div className="auth-radar" aria-hidden="true">
            <span />
          </div>
          <div className="auth-brand-message">
            <h1>
              <span>Anything wrong?</span>
              <span>Report it.</span>
            </h1>
            <p>
              Incident reporting for the people of Barangay Don Mariano Marcos, Bayombong.
            </p>
            <ul>
              {benefits.map(({ icon, text }) => (
                <li key={text}>
                  <span className="auth-benefit-icon">{icon}</span>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </header>

      <main className="auth-main">
        <div className="auth-content">
          <Link className="auth-home-link auth-home-link--desktop" to="/">
            <LeftOutlined aria-hidden="true" />
            <span>Back to home</span>
          </Link>
          {children}
        </div>
      </main>
    </div>
  );
}
