"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import Link from "next/link";

import { useAuth } from "../hooks/useAuth";
import { AuthForm } from "./AuthForm";

type CropSettings = {
  offsetX: number;
  offsetY: number;
  zoom: number;
};

const croppedProfileSize = 512;

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load image."));
    image.src = source;
  });
}

async function createCroppedProfileFile(file: File, previewUrl: string, crop: CropSettings) {
  const image = await loadImage(previewUrl);
  const canvas = document.createElement("canvas");
  canvas.width = croppedProfileSize;
  canvas.height = croppedProfileSize;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Could not crop image.");
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
    throw new Error("Could not crop image.");
  }

  return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}-profile.jpg`, { type: "image/jpeg" });
}

export function PersonalizationPage() {
  const { user, busy, removeProfilePicture, updatePersonalization } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [theme, setTheme] = useState(user?.preferences.theme ?? "light");
  const [language, setLanguage] = useState(user?.preferences.language ?? "en");
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
    setLanguage(user?.preferences.language ?? "en");
  }, [user?.name, user?.preferences.language, user?.preferences.theme]);

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
      setError("Please choose an image file.");
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
      const croppedFile = await createCroppedProfileFile(cropSourceFile, cropSourceUrl, cropSettings);
      setPhotoFile(croppedFile);
      setCropSourceFile(null);
      setError(null);
    } catch (cropError) {
      setError(cropError instanceof Error ? cropError.message : "Could not crop image.");
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
      setNotice("Profile picture deleted.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete profile picture.");
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
      setPhotoFile(null);
      setNotice("Personalization saved.");
    } catch (personalizationError) {
      setError(personalizationError instanceof Error ? personalizationError.message : "Could not save personalization.");
    }
  };

  return (
    <main className="projects-page personalization-page">
      <header className="projects-header">
        <div>
          <p className="auth-kicker">Profile</p>
          <h1>{user.name || "Profile"}</h1>
          <p className="projects-subtitle">{user.email}</p>
        </div>
        <div className="projects-userbar">
          <Link className="nav-link" href="/projects">
            Projects
          </Link>
        </div>
      </header>

      <form className="personalization-form" onSubmit={handleSubmit}>

        <section className="profile-picture-row">
          <label htmlFor="profile-photo" className="profile-picture-preview">
            {photoPreview ? <img alt="Profile preview" src={photoPreview} /> : <span>{(name || user.email).slice(0, 1)}</span>}
          </label>

          <div className="profile-picture-actions">
            <input id="profile-photo" accept="image/*" type="file" onChange={handlePhotoChange} hidden />
            <button className="auth-button danger-button" disabled={busy || (!photoPreview && !photoFile)} onClick={() => void handleDeletePhoto()} type="button">
              Delete photo
            </button>
          </div>
        </section>

        <label className="auth-field">
          <span>Username</span>
          <input onChange={(event) => setName(event.target.value)} type="text" value={name} required/>
        </label>

        <label className="auth-field">
          <span>Theme</span>
          <select onChange={(event) => setTheme(event.target.value)} value={theme}>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>

        <label className="auth-field">
          <span>Language</span>
          <select onChange={(event) => setLanguage(event.target.value)} value={language}>
            <option value="az">Azerbaijani</option>
            <option value="en">English</option>
          </select>
        </label>

        {error ? <p className="auth-message auth-message-error">{error}</p> : null}
        {notice ? <p className="auth-message auth-message-success">{notice}</p> : null}

        <button className="auth-button" disabled={busy} type="submit">
          {busy ? "Saving..." : "Save profile"}
        </button>
      </form>

      {cropSourceUrl ? (
        <div className="confirm-backdrop" role="presentation">
          <section aria-labelledby="profile-crop-title" aria-modal="true" className="confirm-dialog profile-crop-dialog" role="dialog">
            <div>
              <p className="auth-kicker">Profile photo</p>
              <h2 id="profile-crop-title">Crop and focus</h2>
              <p className="confirm-copy">Move the focus and zoom until the preview looks right.</p>
            </div>

            <div className="profile-crop-frame">
              <img
                alt="Crop preview"
                src={cropSourceUrl}
                style={{
                  transform: `translate(${cropSettings.offsetX / 2}%, ${cropSettings.offsetY / 2}%) scale(${cropSettings.zoom})`,
                }}
              />
            </div>

            <div className="profile-crop-controls">
              <label className="auth-field">
                <span>Zoom</span>
                <input
                  max="2.5"
                  min="1"
                  onChange={(event) => setCropSettings((current) => ({ ...current, zoom: Number(event.target.value) }))}
                  step="0.05"
                  type="range"
                  value={cropSettings.zoom}
                />
              </label>
            </div>

            <div className="project-actions">
              <button className="auth-button auth-button-secondary" onClick={cancelCrop} type="button">
                Cancel
              </button>
              <button className="auth-button" onClick={() => void applyCrop()} type="button">
                Use photo
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
