import type { Language } from "./i18n";
import { normalizeRole } from "./roles";

const projectStatusLabels: Record<Language, Record<string, string>> = {
  en: {
    planned: "Planned",
    active: "Active",
    paused: "Paused",
    blocked: "Blocked",
    completed: "Completed",
  },
  az: {
    planned: "Planlaşdırılıb",
    active: "Aktiv",
    paused: "Dayandırılıb",
    blocked: "Bloklanıb",
    completed: "Tamamlanıb",
  },
};

const roleLabels: Record<Language, Record<string, string>> = {
  en: {
    admin: "Admin",
    "super-admin": "Super admin",
    user: "User",
  },
  az: {
    "super-admin": "Super admin",
    admin: "Admin",
    user: "İstifadəçi",
  },
};

const userStatusLabels: Record<Language, Record<string, string>> = {
  en: {
    approved: "Approved",
    pending: "Pending",
    denied: "Denied",
    created: "Created",
    "email-unverified": "Email unverified",
  },
  az: {
    approved: "Təsdiqlənib",
    pending: "Gözləmədədir",
    denied: "Rədd edilib",
    created: "Yaradılıb",
    "email-unverified": "E-poçt təsdiqlənməyib",
  },
};

export function getProjectStatusLabel(status: string, language: Language = "en") {
  return projectStatusLabels[language][status] ?? status;
}

export function getRoleLabel(role: string, language: Language = "en") {
  return roleLabels[language][normalizeRole(role)] ?? role;
}

export function getUserStatusLabel(status: string, language: Language = "en") {
  return userStatusLabels[language][status] ?? status;
}
