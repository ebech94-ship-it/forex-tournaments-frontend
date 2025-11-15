// app/ProfileContext.tsx
import React, { createContext, ReactNode, useState } from "react";

// Define the type for context
type ProfileContextType = {
  profileImage: string | null;
  setProfileImage: (uri: string | null) => void;
};

// Create the context
export const ProfileContext = createContext<ProfileContextType>({
  profileImage: null,
  setProfileImage: () => {},
});

// Context provider component
export const ProfileProvider = ({ children }: { children: ReactNode }) => {
  const [profileImage, setProfileImage] = useState<string | null>(null);

  return (
    <ProfileContext.Provider value={{ profileImage, setProfileImage }}>
      {children}
    </ProfileContext.Provider>
  );
};

// ✅ Add a harmless default export to satisfy Expo Router
// This will prevent router errors while keeping this file functional
export default function EmptyScreen() {
  return null;
}
