import type { App, AppSection, AppTool, Version } from "@model/app";
import { atom } from "nanostores";

export const showAddProjectModal = atom<boolean>(false);
export const showEditProjectModal = atom<string | null>(null);
export const showEditPolicyModal = atom<string | null>(null);
export const showAddVersionModal = atom<string | null>(null);
export const showEditVersionModal = atom<{ appId: string; versionId: string } | null>(null);
export const showAddSectionModal = atom<{ appId: string; versionId: string } | null>(null);
export const showEditSectionModal = atom<{ appId: string; versionId: string; sectionId: string } | null>(null);

export const projects = atom<App[]>([]);
export const tools = atom<AppTool[]>([]);
export const versions = atom<Version[]>([]);
export const sections = atom<AppSection[]>([]);

// Maps appId -> the currently selected versionId in the dashboard tab strip.
export const selectedVersions = atom<Record<string, string>>({});
