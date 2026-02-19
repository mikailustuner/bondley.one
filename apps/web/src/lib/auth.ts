"use client";

const TOKEN_KEY = "fincalc_token";
const REFRESH_TOKEN_KEY = "fincalc_refresh_token";
const USER_KEY = "fincalc_user";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): any | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setAuth(token: string, refreshToken: string, user: any): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isAdmin(): boolean {
  const user = getUser();
  return user?.role === "admin";
}

export function isProUser(): boolean {
  const user = getUser();
  return user?.role === "pro_user" || user?.role === "admin";
}

export function isPremiumUser(): boolean {
  const user = getUser();
  return user?.role === "premium_user" || user?.role === "pro_user" || user?.role === "admin";
}

export function isFreeUser(): boolean {
  const user = getUser();
  return user?.role === "free_user";
}

export function hasRole(role: string): boolean {
  const user = getUser();
  if (!user) return false;
  
  const roleHierarchy: Record<string, number> = {
    admin: 4,
    pro_user: 3,
    premium_user: 2,
    free_user: 1,
  };
  
  const userLevel = roleHierarchy[user.role] || 0;
  const requiredLevel = roleHierarchy[role] || 999;
  
  return userLevel >= requiredLevel;
}

export function getUserPermissions(): {
  role: string;
  is_admin: boolean;
  is_pro_user: boolean;
  is_premium_user: boolean;
  is_free_user: boolean;
} {
  const user = getUser();
  if (!user) {
    return {
      role: "",
      is_admin: false,
      is_pro_user: false,
      is_premium_user: false,
      is_free_user: false,
    };
  }
  
  return {
    role: user.role || "",
    is_admin: isAdmin(),
    is_pro_user: isProUser(),
    is_premium_user: isPremiumUser(),
    is_free_user: isFreeUser(),
  };
}
