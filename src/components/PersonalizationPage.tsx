"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import Link from "next/link";

import { useAuth } from "../hooks/useAuth";
import { languageNames, supportedLanguages, type Language } from "../utils/i18n";
import { PageHeader } from "./AppShell";
import { AuthForm } from "./AuthForm";
import { Alert } from "./ui/alert";
import { Button, buttonVariants } from "./ui/button";
import { Card } from "./ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { FieldLabel } from "./ui/field";
import { Input } from "./ui/input";
import { Select } from "./ui/select";

type CropSettings = {
  offsetX: number;
  offsetY: number;
  zoom: number;
};

const croppedProfileSize = 512;

function loadImage(source: string, errorMessage: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(errorMessage));
    image.src = source;
  });
}

async function createCroppedProfileFile(file: File, previewUrl: string, crop: CropSettings, errorMessage: string) {
  const image = await loadImage(previewUrl, errorMessage);
  const canvas = document.createElement("canvas");
  canvas.width = croppedProfileSize;
  canvas.height = croppedProfileSize;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error(errorMessage);
  }

  const baseScale = Math.max(croppedProfileSize / image.width, croppedProfileSize / image.height);
  const scale = baseScale * crop.zoom;
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const offsetX = (crop.offsetX / 100) * (croppedProfileSize / 2);
  const offsetY = (crop.offsetY / 100) * (croppedProfileSize / 2);
  const x = (croppedProfileSize - drawWidth) / 2 + offsetX;
  const y = (croppedProfileSize - drawHeight) / 2 + offsetY;

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, croppedProfileSize, croppedProfileSize);
  context.drawImage(image, x, y, drawWidth, drawHeight);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));

  if (!blob) {
    throw new Error(errorMessage);
  }

  return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}-profile.jpg`, { type: "image/jpeg" });
}

export function PersonalizationPage() {
  const { user, busy, language: activeLanguage, t, setLanguage: setActiveLanguage, removeProfilePicture, updatePersonalization } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [theme, setTheme] = useState(user?.preferences.theme ?? "light");
  const [language, setLanguage] = useState<Language>(activeLanguage);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState(user?.photoURL ?? "");
  const [cropSourceFile, setCropSourceFile] = useState<File | null>(null);
  const [cropSourceUrl, setCropSourceUrl] = useState("");
  const [cropSettings, setCropSettings] = useState<CropSettings>({ offsetX: 0, offsetY: 0, zoom: 1 });
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(user?.name ?? "");
    setTheme(user?.preferences.theme ?? "light");
    setLanguage((user?.preferences.language as Language | undefined) ?? activeLanguage);
  }, [activeLanguage, user?.name, user?.preferences.language, user?.preferences.theme]);

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview(user?.photoURL ?? "");
      return;
    }

    const previewUrl = URL.createObjectURL(photoFile);
    setPhotoPreview(previewUrl);

    return () => URL.revokeObjectURL(previewUrl);
  }, [photoFile, user?.photoURL]);

  useEffect(() => {
    if (!cropSourceFile) {
      setCropSourceUrl("");
      return;
    }

    const previewUrl = URL.createObjectURL(cropSourceFile);
    setCropSourceUrl(previewUrl);

    return () => URL.revokeObjectURL(previewUrl);
  }, [cropSourceFile]);

  if (!user) {
    return (
      <main className="auth-page">
        <AuthForm />
      </main>
    );
  }

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;

    if (file && !file.type.startsWith("image/")) {
      setError(t("chooseImageFile"));
      return;
    }

    setPhotoFile(null);
    setCropSourceFile(file);
    setCropSettings({ offsetX: 0, offsetY: 0, zoom: 1 });
    setError(null);
    event.target.value = "";
  };

  const cancelCrop = () => {
    setCropSourceFile(null);
    setCropSettings({ offsetX: 0, offsetY: 0, zoom: 1 });
  };

  const applyCrop = async () => {
    if (!cropSourceFile || !cropSourceUrl) {
      return;
    }

    try {
      const croppedFile = await createCroppedProfileFile(cropSourceFile, cropSourceUrl, cropSettings, t("cannotCropImage"));
      setPhotoFile(croppedFile);
      setCropSourceFile(null);
      setError(null);
    } catch (cropError) {
      setError(cropError instanceof Error ? cropError.message : t("cannotCropImage"));
    }
  };

  const handleDeletePhoto = async () => {
    setNotice(null);
    setError(null);
    setPhotoFile(null);
    setCropSourceFile(null);

    if (!user.photoURL) {
      setPhotoPreview("");
      return;
    }

    try {
      await removeProfilePicture();
      setPhotoPreview("");
      setNotice(t("photoDeleted"));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : t("photoDeleteFailed"));
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);
    setError(null);

    try {
      await updatePersonalization({
        name: name.trim(),
        preferences: {
          theme,
          language,
        },
        photoFile,
      });
      setActiveLanguage(language);
      setPhotoFile(null);
      setNotice(t("savedProfile"));
    } catch (personalizationError) {
      setError(personalizationError instanceof Error ? personalizationError.message : t("profileSaveFailed"));
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
        eyebrow={t("profile")}
        subtitle={user.email}
        title={user.name || t("profile")}
      />

      <Card as="form" className="personalization-form" onSubmit={handleSubmit}>
        <section className="profile-picture-row">
          <label htmlFor="profile-photo" className="profile-picture-preview">
            {photoPreview ? <img alt={t("photoPreview")} src={photoPreview} /> : <span>{(name || user.email).slice(0, 1)}</span>}
          </label>

          <div className="profile-picture-actions">
            <input id="profile-photo" accept="image/*" type="file" onChange={handlePhotoChange} hidden />
            <Button disabled={busy || (!photoPreview && !photoFile)} onClick={() => void handleDeletePhoto()} type="button" variant="destructive">
              {t("deletePhoto")}
            </Button>
          </div>
        </section>

        <FieldLabel>
          <span>{t("username")}</span>
          <Input onChange={(event) => setName(event.target.value)} type="text" value={name} required/>
        </FieldLabel>

        <FieldLabel>
          <span>{t("theme")}</span>
          <Select onChange={(event) => setTheme(event.target.value)} value={theme}>
            <option value="light">{t("light")}</option>
            <option value="dark">{t("dark")}</option>
          </Select>
        </FieldLabel>

        <FieldLabel>
          <span>{t("language")}</span>
          <Select onChange={(event) => setLanguage(event.target.value as Language)} value={language}>
            {supportedLanguages.map((supportedLanguage) => (
              <option key={supportedLanguage} value={supportedLanguage}>
                {languageNames[supportedLanguage]}
              </option>
            ))}
          </Select>
        </FieldLabel>

        {error ? <Alert variant="destructive">{error}</Alert> : null}
        {notice ? <Alert variant="success">{notice}</Alert> : null}

        <Button disabled={busy} type="submit">
          {busy ? t("saving") : t("saveProfile")}
        </Button>
      </Card>

      <Dialog open={Boolean(cropSourceUrl)}>
        <DialogContent className="profile-crop-dialog" aria-labelledby="profile-crop-title">
            <DialogHeader>
              <p className="auth-kicker">{t("profilePhoto")}</p>
              <DialogTitle id="profile-crop-title">{t("cropAndFocus")}</DialogTitle>
              <DialogDescription>{t("cropHelp")}</DialogDescription>
            </DialogHeader>

            <div className="profile-crop-frame">
              <img
                alt={t("imageCropPreview")}
                className="profile-crop-image"
                src={cropSourceUrl}
                style={{
                  transform: `translate(${cropSettings.offsetX / 2}%, ${cropSettings.offsetY / 2}%) scale(${cropSettings.zoom})`,
                }}
              />
            </div>

            <div className="profile-crop-controls">
              <FieldLabel>
                <span>{t("zoom")}</span>
                <Input
                  max="2.5"
                  min="1"
                  onChange={(event) => setCropSettings((current) => ({ ...current, zoom: Number(event.target.value) }))}
                  step="0.05"
                  type="range"
                  value={cropSettings.zoom}
                />
              </FieldLabel>
            </div>

            <DialogFooter>
              <Button onClick={cancelCrop} type="button" variant="secondary">
                {t("cancel")}
              </Button>
              <Button onClick={() => void applyCrop()} type="button">
                {t("usePhoto")}
              </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
