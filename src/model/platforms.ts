import type { Platform } from "./app";

export const mobile_platform: Platform = {
    name: "mobile",
    icon: "fa-duotone fa-light fa-mobile"
}

export const tablet_platform: Platform = {
    name: "tablet",
    icon: "fa-duotone fa-light fa-tablet"
}

export const watch_platform: Platform = {
    name: "watch",
    icon: "fa-duotone fa-light fa-watch-apple"
}

export const widget_platform: Platform = {
    name: "widget",
    icon: "fa-duotone fa-light fa-grid-2"
}

export const desktop_platform: Platform = {
    name: "desktop",
    icon: "fa-duotone fa-light fa-desktop"
}

export const web_platform: Platform = {
    name: "web",
    icon: "fa-duotone fa-light fa-browser"
}

export const architecture_platform: Platform = {
    name: "architecture",
    icon: "fa-duotone fa-light fa-layer-group"
}

export const platforms: Platform[] = [
    web_platform,
    mobile_platform,
    watch_platform,
    widget_platform,
    desktop_platform,
    architecture_platform
];