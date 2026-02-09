import { createContext, ReactNode, useContext, useMemo, useState } from 'react';

type AuthContextType = {
  isSignedIn: boolean;
  setIsSignedIn: (value: boolean) => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isSignedIn, setIsSignedIn] = useState(false);

  const value = useMemo(
    () => ({
      isSignedIn,
      setIsSignedIn,
    }),
    [isSignedIn]
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
