import type { App, AppSection, AppTool, Feature } from "@model/app";

import { firestore, storage } from "./client";
import { collection, deleteDoc, doc, getDoc, getDocs, query, QueryDocumentSnapshot, setDoc, where, type DocumentData, type DocumentReference } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, listAll, deleteObject } from "firebase/storage";

const UPLOAD_CONCURRENCY = 10;

const runInBatches = async <T>(
    tasks: Array<() => Promise<T>>,
    concurrency: number = UPLOAD_CONCURRENCY,
): Promise<T[]> => {
    const results: T[] = new Array(tasks.length);
    let cursor = 0;
    const worker = async (): Promise<void> => {
        while (cursor < tasks.length) {
            const index = cursor++;
            results[index] = await tasks[index]();
        }
    };
    const workers = Array.from(
        { length: Math.min(concurrency, tasks.length) },
        () => worker(),
    );
    await Promise.all(workers);
    return results;
};

const extractStoragePath = (url: string | null | undefined): string | null => {
    if (!url) return null;
    try {
        const u = new URL(url);
        const match = u.pathname.match(/\/o\/(.+)$/);
        if (!match) return null;
        return decodeURIComponent(match[1]);
    } catch {
        return null;
    }
};

const deleteStoragePath = async (path: string | null | undefined): Promise<void> => {
    if (!path) return;
    try {
        await deleteObject(ref(storage, path));
    } catch {
        console.error("Failed to delete storage path:", path);
    }
};

const collectFeaturePaths = (features: Feature[] | undefined): string[] => {
    const paths: string[] = [];
    for (const f of features ?? []) {
        if (f.image_path) paths.push(f.image_path);
        if (f.frame_paths) for (const p of f.frame_paths) if (p) paths.push(p);
    }
    return paths;
};

// MARK: - Tools
const convertFirestoreToTools = (document: QueryDocumentSnapshot<DocumentData, DocumentData>): AppTool => {
    const id = document.id;
    const { name, link, icon } = document.data();
    return { id, name, link, icon }
}

export const fetchTools = async(): Promise<AppTool[]> => {
    const snapshot = await getDocs(collection(firestore, "tools"));
    return snapshot.docs.map((doc) => convertFirestoreToTools(doc));
}

export const addTools = async(
    name: string,
    link: string,
    icon: File | null = null
): Promise<AppTool> => {
    const document = doc(collection(firestore, "tools"));

    let icon_url: string | null = null;
    if (icon) {
        const storageRef = ref(storage, `tools/${document.id}`);
        await uploadBytes(storageRef, icon);
        icon_url = await getDownloadURL(storageRef);
    }

    const tool: AppTool = {
        id: document.id,
        name: name,
        link: link,
        icon: icon_url
    };

    await setDoc(document, tool);

    return tool;
}

// MARK: - App
const convertFirestoreToApp = (document: QueryDocumentSnapshot<DocumentData, DocumentData>): App => {
    const id = document.id;
    const { page, name, description, apple_link, web_link, github_link, image, image_path, tools } = document.data();
    const resolved_path: string = image_path ?? extractStoragePath(image) ?? "";
    return { id, page, name, description, apple_link, web_link, github_link, image, image_path: resolved_path, tools }
}

export const fetchApps = async(): Promise<App[]> => {
    const snapshot = await getDocs(collection(firestore, "apps"));
    return snapshot.docs.map((doc) => convertFirestoreToApp(doc));
}

export const addAppBasicInfo = async(
    page: string,
    name: string,
    description: string,
    apple_link: string | null = null,
    web_link: string | null = null,
    github_link: string | null = null,
    image: File,
    tools: DocumentReference[],
): Promise<App> => {
    const document = doc(collection(firestore, "apps"));

    const image_path = `apps/${document.id}/image`;
    const imageRef = ref(storage, image_path);
    await uploadBytes(imageRef, image);
    const image_url = await getDownloadURL(imageRef);

    const app: App = {
        id: document.id,
        page: page,
        name: name,
        description: description,
        apple_link: apple_link,
        web_link: web_link,
        github_link: github_link,
        image: image_url,
        image_path: image_path,
        tools: tools
    };

    await setDoc(document, app);
    return app;
}

// MARK: - App Sections
const convertFirestoreToSection = (document: QueryDocumentSnapshot<DocumentData, DocumentData>): AppSection => {
    const id = document.id;
    const { title, description, platform, features, feature_type, app } = document.data();
    const resolved_features: Feature[] = (features ?? []).map((f: any): Feature => {
        const image: string | null = f.image ?? null;
        const frames: string[] | null = f.frames ?? null;
        const image_path: string | null = f.image_path ?? extractStoragePath(image);
        const frame_paths: string[] | null = f.frame_paths
            ?? (frames ? frames.map((u: string) => extractStoragePath(u) ?? "") : null);
        return {
            title: f.title ?? null,
            description: f.description ?? null,
            image,
            image_path,
            frames,
            frame_paths,
        };
    });
    return { id, title, description, platform, features: resolved_features, feature_type, app }
}

export const fetchSections = async(id: string): Promise<AppSection[]> => {
    const app_reference = doc(firestore, "apps", id);
    const sections_query = query(collection(firestore, "sections"), where("app", "==", app_reference));
    const snapshot = await getDocs(sections_query);
    return snapshot.docs.map((doc) => convertFirestoreToSection(doc));
}

export const fetchAllSections = async(): Promise<AppSection[]> => {
    const snapshot = await getDocs(collection(firestore, "sections"));
    return snapshot.docs.map((doc) => convertFirestoreToSection(doc));
}

export const addAppSection = async(
    id: string,
    title: string,
    description: string,
    platform: string,
    feature_type: "slides" | "frames",
    features: {
        title: string | null,
        description: string | null,
        image: File | null,
        frames: File[] | null
    }[],
): Promise<AppSection> => {
    const app_reference = doc(firestore, "apps", id);
    const section_doc = doc(collection(firestore, "sections"));

    const uploaded_features: Feature[] = [];
    const tasks: Array<() => Promise<void>> = [];

    features.forEach((feature, index) => {
        if (feature_type == "slides" && feature.image) {
            const file = feature.image;
            const image_path = `sections/${section_doc.id}/slides/${index}`;
            const image_reference = ref(storage, image_path);
            const placeholder: Feature = {
                title: null,
                description: null,
                image: "",
                image_path,
                frames: null,
                frame_paths: null,
            };
            uploaded_features.push(placeholder);
            tasks.push(async () => {
                await uploadBytes(image_reference, file);
                placeholder.image = await getDownloadURL(image_reference);
            });
        } else if (feature_type == "frames" && feature.title && feature.description && feature.frames) {
            const frames = feature.frames;
            const placeholder: Feature = {
                title: feature.title,
                description: feature.description,
                image: null,
                image_path: null,
                frames: new Array(frames.length).fill(""),
                frame_paths: new Array(frames.length).fill(""),
            };
            uploaded_features.push(placeholder);
            frames.forEach((frame, frame_index) => {
                const frame_path = `sections/${section_doc.id}/frames/${frame_index}`;
                const frame_reference = ref(storage, frame_path);
                tasks.push(async () => {
                    await uploadBytes(frame_reference, frame);
                    placeholder.frames![frame_index] = await getDownloadURL(frame_reference);
                    placeholder.frame_paths![frame_index] = frame_path;
                });
            });
        }
    });

    await runInBatches(tasks);

    const section: AppSection = {
        id: section_doc.id,
        title: title,
        description: description,
        platform: platform,
        features: uploaded_features,
        feature_type: feature_type,
        app: app_reference
    };

    await setDoc(section_doc, section);
    return section;
}

export const updateAppSection = async(
    section_id: string,
    app_id: string,
    title: string,
    description: string,
    platform: string,
    feature_type: "slides" | "frames",
    features: {
        title: string | null,
        description: string | null,
        image: File | string | null,
        frames: (File | string)[] | null
    }[],
): Promise<AppSection> => {
    const app_reference = doc(firestore, "apps", app_id);
    const section_doc = doc(firestore, "sections", section_id);

    const existing_snap = await getDoc(section_doc);
    const old_paths = new Set<string>();
    if (existing_snap.exists()) {
        const old_section = convertFirestoreToSection(
            existing_snap as QueryDocumentSnapshot<DocumentData, DocumentData>,
        );
        for (const p of collectFeaturePaths(old_section.features)) old_paths.add(p);
    }

    const uploaded_features: Feature[] = [];
    const tasks: Array<() => Promise<void>> = [];
    const upload_stamp = Date.now();

    features.forEach((feature, index) => {
        if (feature_type == "slides" && feature.image) {
            if (typeof feature.image === "string") {
                uploaded_features.push({
                    title: null,
                    description: null,
                    image: feature.image,
                    image_path: extractStoragePath(feature.image),
                    frames: null,
                    frame_paths: null,
                });
                return;
            }
            const file = feature.image;
            const image_path = `sections/${section_id}/slides/${upload_stamp}_${index}`;
            const image_reference = ref(storage, image_path);
            const placeholder: Feature = {
                title: null,
                description: null,
                image: "",
                image_path,
                frames: null,
                frame_paths: null,
            };
            uploaded_features.push(placeholder);
            tasks.push(async () => {
                await uploadBytes(image_reference, file);
                placeholder.image = await getDownloadURL(image_reference);
            });
        } else if (feature_type == "frames" && feature.title && feature.description && feature.frames) {
            const frames = feature.frames;
            const frame_urls: string[] = new Array(frames.length).fill("");
            const frame_paths: string[] = new Array(frames.length).fill("");

            frames.forEach((frame, frame_index) => {
                if (typeof frame === "string") {
                    frame_urls[frame_index] = frame;
                    frame_paths[frame_index] = extractStoragePath(frame) ?? "";
                } else {
                    frame_paths[frame_index] = `sections/${section_id}/frames/${upload_stamp}_${frame_index}`;
                }
            });

            const placeholder: Feature = {
                title: feature.title,
                description: feature.description,
                image: null,
                image_path: null,
                frames: frame_urls,
                frame_paths,
            };
            uploaded_features.push(placeholder);

            frames.forEach((frame, frame_index) => {
                if (typeof frame === "string") return;
                const frame_reference = ref(storage, frame_paths[frame_index]);
                tasks.push(async () => {
                    await uploadBytes(frame_reference, frame);
                    placeholder.frames![frame_index] = await getDownloadURL(frame_reference);
                });
            });
        }
    });

    await runInBatches(tasks);

    const new_paths = new Set(collectFeaturePaths(uploaded_features));
    const orphan_paths: string[] = [];
    for (const p of old_paths) {
        if (p && !new_paths.has(p)) orphan_paths.push(p);
    }
    await Promise.all(orphan_paths.map((p) => deleteStoragePath(p)));

    const section: AppSection = {
        id: section_id,
        title: title,
        description: description,
        platform: platform,
        features: uploaded_features,
        feature_type: feature_type,
        app: app_reference
    };

    await setDoc(section_doc, section);
    return section;
}

export const deleteAppSection = async(section_id: string): Promise<void> => {
    await deleteStorageFolder(`sections/${section_id}`).catch(() => {});
    await deleteDoc(doc(firestore, "sections", section_id));
}

// MARK: - Update / Delete App
export const updateAppBasicInfo = async(
    id: string,
    page: string,
    name: string,
    description: string,
    apple_link: string | null = null,
    web_link: string | null = null,
    github_link: string | null = null,
    image: File | null,
    tools: DocumentReference[],
): Promise<App> => {
    const document = doc(firestore, "apps", id);
    const existing = await getDoc(document);
    if (!existing.exists()) throw new Error("App not found");

    const existing_data = existing.data();
    let image_url: string = existing_data.image;
    let image_path: string =
        existing_data.image_path
        ?? extractStoragePath(image_url)
        ?? `apps/${id}/image`;
    if (image) {
        image_path = `apps/${id}/image`;
        const imageRef = ref(storage, image_path);
        await uploadBytes(imageRef, image);
        image_url = await getDownloadURL(imageRef);
    }

    const app: App = {
        id,
        page,
        name,
        description,
        apple_link,
        web_link,
        github_link,
        image: image_url,
        image_path,
        tools,
    };
    await setDoc(document, app);
    return app;
}

const deleteStorageFolder = async (path: string): Promise<void> => {
    const folderRef = ref(storage, path);
    const result = await listAll(folderRef);
    await Promise.all([
        ...result.items.map((item) => deleteObject(item)),
        ...result.prefixes.map((prefix) => deleteStorageFolder(prefix.fullPath)),
    ]);
}

export const deleteApp = async(id: string): Promise<void> => {
    const app_reference = doc(firestore, "apps", id);
    const sections_query = query(collection(firestore, "sections"), where("app", "==", app_reference));
    const sections_snap = await getDocs(sections_query);
    await Promise.all(sections_snap.docs.map((d) => deleteAppSection(d.id)));

    await Promise.all([
        deleteDoc(doc(firestore, "privacy-policies", id)).catch(() => {}),
        deleteDoc(doc(firestore, "terms-of-use", id)).catch(() => {}),
    ]);

    await deleteStorageFolder(`apps/${id}`).catch(() => {});

    await deleteDoc(doc(firestore, "apps", id));
}

// MARK: - Policies
export const getPrivacyPolicy = async(id: string): Promise<string> => {
    const snap = await getDoc(doc(firestore, "privacy-policies", id));
    if (!snap.exists()) return "";
    return (snap.data().content as string) ?? "";
}

export const getTermsOfUse = async(id: string): Promise<string> => {
    const snap = await getDoc(doc(firestore, "terms-of-use", id));
    if (!snap.exists()) return "";
    return (snap.data().content as string) ?? "";
}

export const setPrivacyPolicy = async(id: string, content: string): Promise<void> => {
    const appRef = doc(firestore, "apps", id);
    await setDoc(doc(firestore, "privacy-policies", id), { content, app: appRef });
}

export const setTermsOfUse = async(id: string, content: string): Promise<void> => {
    const appRef = doc(firestore, "apps", id);
    await setDoc(doc(firestore, "terms-of-use", id), { content, app: appRef });
}
