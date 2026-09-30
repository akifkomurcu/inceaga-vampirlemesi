import type { ReactNode } from 'react';

type NavKey = 'village' | 'graveyard' | 'chronicles' | 'settings';

interface GameShellProps {
  children: ReactNode;
  identityName: string;
  identitySubtitle: string;
  activeNav?: NavKey;
  title?: string;
  toolbarContent?: ReactNode;
  footerContent?: ReactNode;
}

const NAV_ITEMS: { key: NavKey; label: string; icon: string }[] = [
  { key: 'village', label: 'Köy', icon: 'castle' },
  { key: 'graveyard', label: 'Mezarlık', icon: 'skull' },
  { key: 'chronicles', label: 'Günce', icon: 'history' },
  { key: 'settings', label: 'Ayarlar', icon: 'settings' },
];

export default function GameShell({
  children,
  identityName,
  identitySubtitle,
  activeNav = 'village',
  title = 'Vampir Köylü',
  toolbarContent,
  footerContent,
}: GameShellProps) {
  return (
    <div className="ritual-shell">
      <aside className="ritual-sidebar">
        <div className="ritual-sidebar-head">
          <p className="ritual-sidebar-brand">{title}</p>
        </div>

        <div className="ritual-identity">
          <div className="ritual-identity-avatar" aria-hidden="true">
            {identityName.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <p className="ritual-identity-title">{identityName}</p>
            <p className="ritual-identity-subtitle">{identitySubtitle}</p>
          </div>
        </div>

        <nav className="ritual-nav" aria-label="Oyun bölümleri">
          {NAV_ITEMS.map((item) => (
            <div
              key={item.key}
              className={`ritual-nav-item ${activeNav === item.key ? 'is-active' : ''}`}
            >
              <span className="material-symbols-outlined icon-lined" aria-hidden="true">
                {item.icon}
              </span>
              <span>{item.label}</span>
            </div>
          ))}
        </nav>

        {footerContent ? <div className="ritual-sidebar-footer">{footerContent}</div> : null}
      </aside>

      <div className="ritual-main">
        <header className="ritual-topbar">
          <div className="ritual-topbar-brand">
            <span className="material-symbols-outlined ritual-brand-icon" aria-hidden="true">
              bedtime
            </span>
            <h1>{title}</h1>
          </div>

          {toolbarContent}
        </header>

        <main className="ritual-canvas">{children}</main>
      </div>
    </div>
  );
}