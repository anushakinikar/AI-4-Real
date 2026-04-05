/**
 * TODO: Add implementation for frontend/src/lib/auth.js.
 */
export function getStoredUser() {
    if (typeof window === "undefined") {
        return null;
    }

    try {
        const rawUser = window.localStorage.getItem("user");
        return rawUser ? JSON.parse(rawUser) : null;
    } catch (error) {
        console.error("Failed to read stored user:", error);
        return null;
    }
}

export function getStoredUserName() {
    const user = getStoredUser();
    return user?.name || user?.full_name || user?.email || "User";
}