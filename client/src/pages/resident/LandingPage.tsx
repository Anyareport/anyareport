import {
  AlertOutlined,
  AndroidOutlined,
  ArrowRightOutlined,
  AppleOutlined,
  DownloadOutlined,
  DesktopOutlined,
  EnvironmentOutlined,
  FileTextOutlined,
  MoonOutlined,
  SunOutlined,
} from '@ant-design/icons';
import { Button, message, Modal } from 'antd';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../../components/Logo';
import { useTheme } from '../../contexts/ThemeContext';
import './LandingPage.css';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const reportStatuses = [
  { label: 'Pending', className: 'pending', current: false },
  { label: 'Coordinating', className: 'coordinating', current: false },
  { label: 'In progress', className: 'in-progress', current: true },
  { label: 'Resolved', className: 'resolved', current: false },
];

export default function LandingPage() {
  const { theme, toggleTheme } = useTheme();
  const [installHelpOpen, setInstallHelpOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') setInstallHelpOpen(false);
    } catch {
      message.error(
        'Could not open the install prompt. Follow the steps below to install manually.'
      );
    } finally {
      setInstallPrompt(null);
    }
  };

  return (
    <div className="landing-page" id="home">
      <header className="landing-header">
        <div className="landing-container landing-header__inner">
          <a className="landing-brand" href="#home" aria-label="Anyareport home">
            <Logo size="sm" />
          </a>
          <nav className="landing-nav" aria-label="Main navigation">
            <a href="#why">Why Anyareport</a>
            <a href="#how">How it works</a>
            <a href="#features">Features</a>
          </nav>
          <Button
            className="landing-header__install"
            icon={<DownloadOutlined aria-hidden="true" />}
            aria-label="Install Anyareport"
            title="Install Anyareport"
            onClick={() => setInstallHelpOpen(true)}
          >
            Install
          </Button>
          <Button
            className="landing-header__theme"
            type="text"
            shape="circle"
            icon={theme === 'light' ? <MoonOutlined /> : <SunOutlined />}
            aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            onClick={toggleTheme}
          />
          <Link
            className="landing-button landing-button--primary landing-header__login"
            to="/login"
          >
            Log in
          </Link>
        </div>
      </header>

      <main>
        <section className="landing-section landing-hero" aria-labelledby="landing-title">
          <div className="landing-container landing-grid landing-hero__grid">
            <div className="landing-hero__copy">
              <p className="landing-eyebrow">A clearer way to report</p>
              <h1 id="landing-title">Report incidents from your phone.</h1>
              <p className="landing-lead">
                Describe what happened, add a photo, and follow your report as it moves through
                review.
              </p>
              <p className="landing-filipino">
                Mag-report kahit wala kang contact number ng barangay.
              </p>
              <div className="landing-actions">
                <Link className="landing-button landing-button--primary" to="/login">
                  Log in to report <ArrowRightOutlined aria-hidden="true" />
                </Link>
              </div>
              <p className="landing-note">
                Sign in with your account to submit a report. Email verification is required.
              </p>
            </div>

            <div className="landing-report-preview" aria-label="Example report status">
              <div className="landing-report-preview__top">
                <span className="landing-preview-icon">
                  <AlertOutlined aria-hidden="true" />
                </span>
                <span className="landing-preview-label">REPORT STATUS</span>
                <span className="landing-preview-live">Example</span>
              </div>
              <h2>Vehicular accident near the highway crossing</h2>
              <p className="landing-report-preview__description">
                A sample of how a report can move through the response process.
              </p>
              <ol className="landing-status-list" aria-label="Report status progression">
                {reportStatuses.map((status, index) => (
                  <li
                    className={`landing-status landing-status--${status.className}${status.current ? ' landing-status--current' : ''}`}
                    aria-current={status.current ? 'step' : undefined}
                    key={status.label}
                  >
                    <span className="landing-status__dot" aria-hidden="true" />
                    <span>{status.label}</span>
                    {index < reportStatuses.length - 1 && (
                      <span className="landing-status__connector" aria-hidden="true" />
                    )}
                  </li>
                ))}
              </ol>
              <div className="landing-preview-footer">
                <span>
                  <EnvironmentOutlined aria-hidden="true" /> Location included
                </span>
                <span>
                  <FileTextOutlined aria-hidden="true" /> Status updates
                </span>
              </div>
            </div>
          </div>
        </section>

        <section
          className="landing-section landing-section--surface"
          id="why"
          aria-labelledby="landing-why-title"
        >
          <div className="landing-container landing-grid landing-two-column">
            <div>
              <p className="landing-eyebrow">Why Anyareport</p>
              <h2 id="landing-why-title">Reporting shouldn’t depend on who you know.</h2>
              <p className="landing-lead">
                Share a concern through one place, without needing to find the right contact first.
              </p>
            </div>
            <ul className="landing-text-rows">
              <li>
                <h3>No number to call</h3>
                <p>Send a report through the app instead of searching for a barangay contact.</p>
              </li>
              <li>
                <h3>A trip to the hall</h3>
                <p>Describe an incident and its location from your phone.</p>
              </li>
              <li>
                <h3>No word back</h3>
                <p>Check the status of submitted reports from your account.</p>
              </li>
            </ul>
          </div>
        </section>

        <section
          className="landing-section landing-how"
          id="how"
          aria-labelledby="landing-how-title"
        >
          <div className="landing-container">
            <p className="landing-eyebrow">From report to response</p>
            <h2 id="landing-how-title">Four steps to a report.</h2>
            <ol className="landing-steps">
              <li>
                <span className="landing-step-number">01</span>
                <h3>Sign in</h3>
                <p>Use your account to get started. A verified email is needed to submit.</p>
              </li>
              <li>
                <span className="landing-step-number">02</span>
                <h3>Describe it</h3>
                <p>Write what happened and add up to three photos if they help explain it.</p>
              </li>
              <li>
                <span className="landing-step-number">03</span>
                <h3>Set the location</h3>
                <p>Use GPS or pick the incident location on the map within the barangay.</p>
              </li>
              <li>
                <span className="landing-step-number">04</span>
                <h3>Review and follow</h3>
                <p>Review the suggested report details, submit, and check status updates.</p>
              </li>
            </ol>
            <div className="landing-status-legend" aria-label="Report statuses">
              <strong>Status updates</strong>
              {reportStatuses.map((status) => (
                <span
                  className={`landing-legend-chip landing-legend-chip--${status.className}`}
                  key={status.label}
                >
                  <span aria-hidden="true" /> {status.label}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section
          className="landing-section landing-section--surface"
          id="features"
          aria-labelledby="landing-features-title"
        >
          <div className="landing-container landing-grid landing-two-column">
            <div>
              <p className="landing-eyebrow">Designed for clear reporting</p>
              <h2 id="landing-features-title">Every report gets the right details.</h2>
              <p className="landing-lead">
                Anyareport can suggest a category and summary from your description and photos. You
                can review the details before submitting.
              </p>
              <div className="landing-categories">
                <div className="landing-category landing-category--emergency">
                  <h3>Emergency situations</h3>
                  <p>Fires, medical emergencies, and vehicle accidents.</p>
                </div>
                <div className="landing-category landing-category--blotter">
                  <h3>Blotter cases</h3>
                  <p>Incidents such as disputes and fights.</p>
                </div>
                <div className="landing-category landing-category--public">
                  <h3>Public concerns</h3>
                  <p>Community issues such as broken streetlights or potholes.</p>
                </div>
              </div>
            </div>
            <ul className="landing-text-rows landing-feature-rows">
              <li>
                <h3>Text, photo, or both</h3>
                <p>Describe the incident in words and include photos when useful.</p>
              </li>
              <li>
                <h3>Suggestions you can review</h3>
                <p>
                  AI can suggest a category and summary; report details can be reviewed before
                  submission.
                </p>
              </li>
              <li>
                <h3>Your reports in one place</h3>
                <p>Return to your account to check the status of reports you’ve submitted.</p>
              </li>
            </ul>
          </div>
        </section>

        <section className="landing-install" id="install" aria-labelledby="landing-install-title">
          <div className="landing-container landing-install__inner">
            <span className="landing-install__icon">
              <DownloadOutlined aria-hidden="true" />
            </span>
            <div>
              <p className="landing-eyebrow">Take Anyareport with you</p>
              <h2 id="landing-install-title">Install it on your phone or computer.</h2>
              <p>Open Anyareport like an app for quick access from your home screen or desktop.</p>
            </div>
            <Button
              className="landing-install__button"
              type="primary"
              icon={<DownloadOutlined aria-hidden="true" />}
              onClick={() => setInstallHelpOpen(true)}
            >
              How to install
            </Button>
          </div>
        </section>

        <section className="landing-section landing-contact" id="contact">
          <div className="landing-container landing-contact__inner">
            <div className="landing-emergency-card">
              <span className="landing-emergency-icon">
                <AlertOutlined aria-hidden="true" />
              </span>
              <div>
                <p className="landing-eyebrow">Need urgent help?</p>
                <h2>Contact emergency services directly.</h2>
                <p>
                  Anyareport is a way to submit and follow barangay reports. It does not replace
                  emergency services or hotlines.
                </p>
              </div>
            </div>
            <div className="landing-contact-copy">
              <p className="landing-eyebrow">Another way to report</p>
              <h3>Prefer to speak to someone?</h3>
              <p>
                You can contact or visit your barangay directly. Anyareport offers an additional way
                to share a report.
              </p>
              <Link className="landing-text-link" to="/login">
                Get started with Anyareport <ArrowRightOutlined aria-hidden="true" />
              </Link>
            </div>
          </div>
          <div className="landing-container landing-footer">
            <Logo size="sm" />
            <span>Barangay Don Mariano Marcos</span>
          </div>
        </section>
      </main>
      <Modal
        title="Install Anyareport"
        open={installHelpOpen}
        onCancel={() => setInstallHelpOpen(false)}
        footer={
          installPrompt
            ? [
                <Button key="close" onClick={() => setInstallHelpOpen(false)}>
                  Maybe later
                </Button>,
                <Button
                  key="install"
                  type="primary"
                  icon={<DownloadOutlined aria-hidden="true" />}
                  onClick={handleInstall}
                >
                  Install now
                </Button>,
              ]
            : [
                <Button key="close" type="primary" onClick={() => setInstallHelpOpen(false)}>
                  Got it
                </Button>,
              ]
        }
        width={620}
      >
        <p className="landing-install-dialog__intro">
          Add Anyareport to your device for an app-like window and quick access. The exact option
          depends on your browser.
        </p>
        <div className="landing-install-options">
          <article className="landing-install-option">
            <span className="landing-install-option__icon">
              <AndroidOutlined aria-hidden="true" />
            </span>
            <div>
              <h3>Android</h3>
              <p>
                Open this page in Chrome, tap the <strong>⋮ menu</strong>, then choose{' '}
                <strong>Install app</strong> or <strong>Add to Home screen</strong>.
              </p>
            </div>
          </article>
          <article className="landing-install-option">
            <span className="landing-install-option__icon">
              <AppleOutlined aria-hidden="true" />
            </span>
            <div>
              <h3>iPhone or iPad</h3>
              <p>
                Open this page in Safari, tap <strong>Share</strong>, scroll down, then tap{' '}
                <strong>Add to Home Screen</strong>.
              </p>
            </div>
          </article>
          <article className="landing-install-option">
            <span className="landing-install-option__icon">
              <DesktopOutlined aria-hidden="true" />
            </span>
            <div>
              <h3>Desktop</h3>
              <p>
                In Chrome or Edge, select the install icon in the address bar, or open the browser
                menu and choose <strong>Install Anyareport</strong>.
              </p>
            </div>
          </article>
        </div>
        <p className="landing-install-dialog__note">
          If you don’t see an install option, try opening the site in a supported browser or use
          your browser’s menu to add it to your home screen.
        </p>
      </Modal>
    </div>
  );
}
