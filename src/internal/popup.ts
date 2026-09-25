/** Opens a centered popup window (browser only). Returns null when blocked or unavailable. */
export function openPopup(url?: string): Window | null {
    if (typeof window === "undefined" || !window.open) {
        throw new Error(
            "Popups aren't available here. Pass `openUrl` to signInWithOAuth() to open the sign-in page yourself.",
        );
    }
    const screenW = window.innerWidth || 1024;
    const screenH = window.innerHeight || 768;
    const width = Math.min(1024, screenW);
    const height = Math.min(768, screenH);
    const left = screenW / 2 - width / 2;
    const top = screenH / 2 - height / 2;
    return window.open(
        url || "about:blank",
        url ? "rb_oauth" : "_blank",
        `width=${width},height=${height},top=${top},left=${left},resizable,menubar=no`,
    );
}
