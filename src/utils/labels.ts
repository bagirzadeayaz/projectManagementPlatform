import type { Language } from "./i18n";

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
    user: "User",
  },
  az: {
    admin: "İnzibatçı",
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
  return roleLabels[language][role.trim().toLowerCase()] ?? role;
}

export function getUserStatusLabel(status: string, language: Language = "en") {
  return userStatusLabels[language][status] ?? status;
}
