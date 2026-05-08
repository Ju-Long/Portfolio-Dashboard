import type { App, AppSection, AppTool } from "@model/app";
import { atom } from "nanostores";

export const showAddProjectModal = atom<boolean>(false);
export const showEditProjectModal = atom<string | null>(null);
export const showEditPolicyModal = atom<string | null>(null);
export const showAddSectionModal = atom<string | null>(null);
export const showEditSectionModal = atom<{ appId: string; sectionId: string } | null>(null);

export const projects = atom<App[]>([]);
export const tools = atom<AppTool[]>([]);
export const sections = atom<AppSection[]>([]);
