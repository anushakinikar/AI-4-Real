"use client";

import { useEffect, useState } from "react";
import { getStoredUser, getStoredUserName } from "../lib/auth.js";

export default function useAuth() {
  const [user, setUser] = useState(null);
  const [userName, setUserName] = useState("User");

  useEffect(() => {
    const syncUser = () => {
      setUser(getStoredUser());
      setUserName(getStoredUserName());
    };

    syncUser();
    window.addEventListener("storage", syncUser);

    return () => {
      window.removeEventListener("storage", syncUser);
    };
  }, []);

  return { user, userName };
}
