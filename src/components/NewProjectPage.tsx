"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useAuth } from "../hooks/useAuth";
import { useProjectUsers } from "../hooks/useProjectUsers";
import { useProjects } from "../hooks/useProjects";
import {
  generateProjectDescription,
  getTodayDateInputValue,
  isPastDeadline,
  PROJECT_STATUSES,
} from "../services/project.service";
import { languageNames, supportedLanguages, type Language } from "../utils/i18n";
import { getProjectStatusLabel } from "../utils/labels";
import { isAdminRole, isAssignableRole } from "../utils/roles";
import { PageHeader } from "./AppShell";
import { AuthForm } from "./AuthForm";
import { Alert } from "./ui/alert";
import { Button, buttonVariants } from "./ui/button";
import { Card } from "./ui/card";
import { Checkbox } from "./ui/checkbox";
import { FieldLabel } from "./ui/field";
import { Input } from "./ui/input";
import { Select } from "./ui/select";
import { Textarea } from "./ui/textarea";

function isAssignableUser(projectUser: { role: string }) {
  return isAssignableRole(projectUser.role);
}

type AiResponseLanguage = "auto" | Language;

export function NewProjectPage() {
  const router = useRouter();
  const { user, language, t } = useAuth();
  const { users, loading: usersLoading, error: usersError } = useProjectUsers(Boolean(user));
  const { savingId, error, createProject } = useProjects();
  const [name, setName] = useState("");
  const [descriptionMessage, setDescriptionMessage] = useState("");
  const [descriptionResponseLanguage, setDescriptionResponseLanguage] = useState<AiResponseLanguage>("auto");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("planned");
  const [deadline, setDeadline] = useState("");
  const [leaderId, setLeaderId] = useState("");
  const [userIds, setUserIds] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [deadlineError, setDeadlineError] = useState<string | null>(null);
  const [usersSelectionError, setUsersSelectionError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const minimumDeadline = getTodayDateInputValue();
  const assignableUsers = users.filter(isAssignableUser);
  const assignableUserIds = new Set(assignableUsers.map((projectUser) => projectUser.uid));
  const projectLeaderUserIds = new Set(users.map((projectUser) => projectUser.uid));
  const normalizedUserSearch = userSearch.trim().toLowerCase();
  const filteredUsers = normalizedUserSearch
    ? assignableUsers.filter((projectUser) =>
        `${projectUser.name} ${projectUser.email}`.toLowerCase().includes(normalizedUserSearch),
      )
    : assignableUsers;
  const selectedUserIds = userIds.filter((selectedUserId) => assignableUserIds.has(selectedUserId));
  const canCreateProject = user ? isAdminRole(user.role) : false;

  useEffect(() => {
    if (leaderId && !users.some((projectUser) => projectUser.uid === leaderId)) {
      setLeaderId("");
    }
  }, [leaderId, users]);

  if (!user) {
    return (
      <main className="auth-page">
        <AuthForm />
      </main>
    );
  }

  if (!canCreateProject) {
    return (
      <main className="projects-page personalization-page">
        <section className="empty-state">{t("notAllowedManageProjects")}</section>
        <Link className={buttonVariants({ size: "sm", variant: "secondary" })} href="/projects">
          {t("backToProjects")}
        </Link>
      </main>
    );
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setDeadlineError(null);
    setUsersSelectionError(null);

    if (isPastDeadline(deadline)) {
      setDeadlineError(t("deadlineCannotBePast"));
      return;
    }

    const selectedAssignableUserIds = userIds.filter((selectedUserId) => assignableUserIds.has(selectedUserId));

    if (selectedAssignableUserIds.length === 0) {
      setUsersSelectionError(t("selectProjectUser"));
      return;
    }

    if (!leaderId || !projectLeaderUserIds.has(leaderId)) {
      setUsersSelectionError(t("selectProjectLeader"));
      return;
    }

    await createProject(
      {
        name: name.trim() || t("projectNameFallback"),
        description: description.trim(),
        status,
        deadline,
        leaderId,
        userIds: selectedAssignableUserIds,
      },
      user.uid,
    );
    router.push("/projects");
  };

  const toggleProjectUser = (selectedUserId: string) => {
    if (!assignableUserIds.has(selectedUserId)) {
      return;
    }

    setUsersSelectionError(null);
    setUserIds((currentUserIds) =>
      currentUserIds.includes(selectedUserId)
        ? currentUserIds.filter((currentUserId) => currentUserId !== selectedUserId)
        : [...currentUserIds, selectedUserId],
    );
  };

  const handleGenerateDescription = async () => {
    setGenerating(true);
    setGenerationError(null);

    try {
      const generatedDescription = await generateProjectDescription(
        name,
        descriptionMessage,
        language,
        descriptionResponseLanguage,
      );
      setDescription(generatedDescription);
    } catch (descriptionError) {
      setGenerationError(descriptionError instanceof Error ? descriptionError.message : t("writeDescriptionFailed"));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <main className="projects-page personalization-page">
      <PageHeader
        actions={
          <Link className={buttonVariants({ size: "sm", variant: "secondary" })} href="/projects">
            {t("projects")}
          </Link>
        }
        eyebrow={t("workspace")}
        subtitle={t("projectCreatorSubtitle")}
        title={t("addProject")}
      />

      <Card className="personalization-form new-project-form" as="form" onSubmit={handleSubmit}>
        <FieldLabel>
          <span>{t("name")}</span>
          <Input onChange={(event) => setName(event.target.value)} required type="text" value={name}/>
        </FieldLabel>

        <FieldLabel>
          <span>{t("status")}</span>
          <Select className={`status-select status-select-${status}`} onChange={(event) => setStatus(event.target.value)} value={status}>
            {PROJECT_STATUSES.map((projectStatus) => (
              <option key={projectStatus} value={projectStatus}>
                {getProjectStatusLabel(projectStatus, language)}
              </option>
            ))}
          </Select>
        </FieldLabel>

        <FieldLabel>
          <span>{t("deadline")}</span>
          <Input
            min={minimumDeadline}
            onChange={(event) => {
              setDeadline(event.target.value);
              setDeadlineError(null);
            }}
            required
            type="date"
            value={deadline}
          />
        </FieldLabel>

        <fieldset className="project-users-field">
          <legend>{t("participants")}</legend>
          <label className="project-users-search">
            <span>{t("searchUsers")}</span>
            <Input
              onChange={(event) => setUserSearch(event.target.value)}
              placeholder={t("searchUsersPlaceholder")}
              type="search"
              value={userSearch}
            />
          </label>
          {usersLoading ? <p className="project-users-note">{t("loadingUsers")}</p> : null}
          {!usersLoading && assignableUsers.length === 0 ? <p className="project-users-note">{t("noActiveUsers")}</p> : null}
          {!usersLoading && assignableUsers.length > 0 && filteredUsers.length === 0 ? (
            <p className="project-users-note">{t("noMatchingUsers")}</p>
          ) : null}
          <div className="project-users-list">
            {filteredUsers.map((projectUser) => (
              <label className="project-user-option" key={projectUser.uid}>
                <Checkbox
                  checked={selectedUserIds.includes(projectUser.uid)}
                  onChange={() => toggleProjectUser(projectUser.uid)}
                />
                <span>{projectUser.name || projectUser.email}</span>
                <small>{projectUser.uid === leaderId ? t("projectLeader") : projectUser.email}</small>
              </label>
            ))}
          </div>
        </fieldset>

        <FieldLabel>
          <span>{t("projectLeader")}</span>
          <Select
            disabled={users.length === 0}
            onChange={(event) => setLeaderId(event.target.value)}
            required
            value={leaderId}
          >
            <option value="">{t("selectProjectLeader")}</option>
            {users.map((projectUser) => (
              <option key={projectUser.uid} value={projectUser.uid}>
                {projectUser.name || projectUser.email}
              </option>
            ))}
          </Select>
        </FieldLabel>

        <FieldLabel>
          <span>{t("descriptionAiMessage")}</span>
          <Textarea
            maxLength={1000}
            onChange={(event) => setDescriptionMessage(event.target.value)}
            placeholder={t("descriptionAiPlaceholder")}
            rows={4}
            value={descriptionMessage}
          />
          <div className="char-count">{`${descriptionMessage.length}/1000`}</div>
        </FieldLabel>

        <FieldLabel>
          <span>{t("descriptionAiLanguage")}</span>
          <Select
            onChange={(event) => setDescriptionResponseLanguage(event.target.value as AiResponseLanguage)}
            value={descriptionResponseLanguage}
          >
            <option value="auto">{t("automatic")}</option>
            {supportedLanguages.map((supportedLanguage) => (
              <option key={supportedLanguage} value={supportedLanguage}>
                {languageNames[supportedLanguage]}
              </option>
            ))}
          </Select>
        </FieldLabel>

        <FieldLabel>
          <span className="field-label-row">
            {t("description")}
            <Button className="inline-ai-button" disabled={generating || !name.trim()} onClick={handleGenerateDescription} size="sm" type="button" variant="secondary">
              {generating ? t("generating") : t("generateWithAi")}
            </Button>
          </span>
          <Textarea onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={5} value={description} required/>
          <div className="char-count">{`${description?.length || 0}/500`}</div>
        </FieldLabel>

        {generationError ? <Alert variant="destructive">{generationError}</Alert> : null}
        {deadlineError ? <Alert variant="destructive">{deadlineError}</Alert> : null}
        {usersSelectionError ? <Alert variant="destructive">{usersSelectionError}</Alert> : null}
        {usersError ? <Alert variant="destructive">{usersError}</Alert> : null}
        {error ? <Alert variant="destructive">{error}</Alert> : null}

        <Button disabled={savingId === "new"} type="submit">
          {savingId === "new" ? t("creating") : t("createProject")}
        </Button>
      </Card>
    </main>
  );
}
