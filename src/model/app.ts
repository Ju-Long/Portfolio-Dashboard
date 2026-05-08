import type { DocumentReference } from "firebase/firestore"

export interface App {
    id: string,
    page: string,
    name: string,
    description: string,
    apple_link: string | null,
    web_link: string | null,
    github_link: string | null,
    image: string,
    image_path: string,
    tools: DocumentReference[]
}

export interface AppSection {
    id: string,
    title: string,
    description: string,
    platform: string, // name for platform
    features: Feature[],
    feature_type: "slides" | "frames"
    app: DocumentReference
}

export interface Feature {
    title: string | null,
    description: string | null,
    image: string | null,
    image_path: string | null,
    frames: string[] | null,
    frame_paths: string[] | null
}

// Persistance throughout multiple apps
export interface Platform {
    name: "mobile" | "watch" | "tablet" | "widget" | "desktop" | "web" | "architecture",
    icon: string
}

export interface AppTool {
    id: string,
    name: string,
    link: string,
    icon: string | null
}

export interface PrivacyPolicy {
    id: string,
    content: string,
    app: DocumentReference
}

export interface TermsOfUse {
    id: string,
    content: string,
    app: DocumentReference
}