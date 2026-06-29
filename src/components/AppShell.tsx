import type { ReactNode } from "react";

export function PageHeader({
  actions,
  eyebrow,
  subtitle,
  title,
}: {
  actions?: ReactNode;
  eyebrow: ReactNode;
  subtitle?: ReactNode;
  title: ReactNode;
}) {
  return (
    <header className="projects-header">
      <div className="page-heading-copy">
        <p className="auth-kicker">{eyebrow}</p>
        <h1>{title}</h1>
        {subtitle ? <p className="projects-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="projects-userbar">{actions}</div> : null}
    </header>
  );
}

export function SectionHeader({
  actions,
  eyebrow,
  title,
}: {
  actions?: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
}) {
  return (
    <div className="project-section-heading">
      <div>
        {eyebrow ? <p className="auth-kicker">{eyebrow}</p> : null}
        <h2>{title}</h2>
      </div>
      {actions}
    </div>
  );
}
