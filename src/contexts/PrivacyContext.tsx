import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface PrivacyContextType {
  privacyMode: boolean;
  togglePrivacyMode: () => void;
}

const PrivacyContext = createContext<PrivacyContextType | undefined>(undefined);

export const PrivacyProvider = ({ children }: { children: ReactNode }) => {
  const [privacyMode, setPrivacyMode] = useState(() => {
    const saved = localStorage.getItem('privacyMode');
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('privacyMode', String(privacyMode));
  }, [privacyMode]);

  const togglePrivacyMode = () => setPrivacyMode(prev => !prev);

  return (
    <PrivacyContext.Provider value={{ privacyMode, togglePrivacyMode }}>
      {children}
    </PrivacyContext.Provider>
  );
};

export const usePrivacy = () => {
  const context = useContext(PrivacyContext);
  if (!context) {
    throw new Error('usePrivacy must be used within a PrivacyProvider');
  }
  return context;
};
