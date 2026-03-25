import { createContext, ReactNode, useContext, useMemo, useState } from 'react';

export type AuthUser = {
  userid: number;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone_number?: string;
  type?: string;
  tags?: { tagid: number; name: string }[];
};

/**
 * Display name for posts/events — no hardcoded fallbacks except a stable id-based label
 * when profile has no name or email (should be rare after registration).
 */
export function getPostAuthorDisplayName(user: AuthUser): string {
  const fullName = [user.first_name?.trim(), user.last_name?.trim()].filter(Boolean).join(' ').trim();
  if (fullName.length > 0) return fullName;
  const email = user.email?.trim();
  if (email) return email;
  return `User ${user.userid}`;
}

type AuthContextType = {
  isSignedIn: boolean;
  setIsSignedIn: (value: boolean) => void;
  currentUser: AuthUser | null;
  setCurrentUser: (user: AuthUser | null) => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  const value = useMemo(
    () => ({
      isSignedIn,
      setIsSignedIn,
      currentUser,
      setCurrentUser,
    }),
    [isSignedIn, currentUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
