"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useAuth } from "../hooks/useAuth";
import { getRoleLabel } from "../utils/labels";
import { isAdminRole, isSuperAdminRole } from "../utils/roles";
import { SignOutConfirmDialog } from "./SignOutConfirmDialog";
import { Button } from "./ui/button";

function canManageProjects(role: string) {
  return isAdminRole(role);
}

function getInitial(value: string) {
  return value.trim().slice(0, 1).toUpperCase() || "?";
}

function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { busy, language, signOut, t, user } = useAuth();
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);

  if (!user) {
    return null;
  }

  const canEdit = canManageProjects(user.role);
  const panelLabel = isSuperAdminRole(user.role) ? t("superAdminPanel") : t("adminPanel");
  const displayName = user.name || user.email;
  const navItems = [
    {
      glyph: canEdit ? "P" : "T",
      href: "/projects",
      isActive: pathname === "/projects" || pathname === "/myprojects" || (pathname.startsWith("/projects/") && pathname !== "/projects/new"),
      label: canEdit ? t("projects") : t("myTasks"),
    },
    ...(canEdit
      ? [
          {
            glyph: "+",
            href: "/projects/new",
            isActive: pathname === "/projects/new",
            label: t("addProject"),
          },
          {
            glyph: "S",
            href: "/statistics",
            isActive: pathname.startsWith("/statistics"),
            label: t("statistics"),
          },
          {
            glyph: "U",
            href: "/registrations",
            isActive: pathname.startsWith("/registrations"),
            label: t("appUsers"),
          },
        ]
      : []),
    {
      glyph: getInitial(displayName),
      href: "/personalization",
      isActive: pathname.startsWith("/personalization"),
      label: t("profile"),
    },
  ];

  const handleSignOut = async () => {
    await signOut();
    setConfirmingSignOut(false);
    router.push("/");
  };

  return (
    <>
      <aside className="app-sidebar" aria-label={t("workspace")}>
        <div className="app-sidebar-brand">
          <span className="app-sidebar-logo" aria-hidden="true">PM</span>
          <div>
            <strong>{t("workspace")}</strong>
            <span>{canEdit ? panelLabel : t("tasks")}</span>
          </div>
        </div>

        <nav className="app-sidebar-nav" aria-label={t("projects")}>
          {navItems.map((item) => (
            <Link
              aria-current={item.isActive ? "page" : undefined}
              className={`app-sidebar-link${item.isActive ? " app-sidebar-link-active" : ""}`}
              href={item.href}
              key={item.href}
            >
              <span aria-hidden="true">{item.glyph}</span>
              <strong>{item.label}</strong>
            </Link>
          ))}
        </nav>

        <div className="app-sidebar-account">
          <div className="app-sidebar-user">
            <span className="app-sidebar-avatar" aria-hidden="true">
              {user.photoURL ? <img alt="" src={user.photoURL} /> : getInitial(displayName)}
            </span>
            <div>
              <strong>{displayName}</strong>
              <span>{getRoleLabel(user.role, language)}</span>
            </div>
          </div>
          <Button className="app-sidebar-logout" disabled={busy} onClick={() => setConfirmingSignOut(true)} size="sm" type="button" variant="secondary">
            {t("logout")}
          </Button>
        </div>
      </aside>

      {confirmingSignOut ? (
        <SignOutConfirmDialog
          busy={busy}
          onCancel={() => setConfirmingSignOut(false)}
          onConfirm={() => void handleSignOut()}
          open={confirmingSignOut}
        />
      ) : null}
    </>
  );
}

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
    <>
      <AppSidebar />
      <header className="projects-header">
        <div className="page-heading-copy">
          <p className="auth-kicker">{eyebrow}</p>
          <h1>{title}</h1>
          {subtitle ? <p className="projects-subtitle">{subtitle}</p> : null}
        </div>
        {actions ? <div className="projects-userbar">{actions}</div> : null}
      </header>
    </>
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
