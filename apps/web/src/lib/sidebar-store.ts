"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import React from "react";

interface SidebarContextType {
  isOpen: boolean;
  toggle: () => void;
  close: () => void;
}

const SidebarContext = createContext<SidebarContextType>({
  isOpen: false,
  toggle: () => {},
  close: () => {},
});

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);
  const close = useCallback(() => setIsOpen(false), []);

  return React.createElement(
    SidebarContext.Provider,
    { value: { isOpen, toggle, close } },
    children
  );
}

export function useSidebarStore() {
  return useContext(SidebarContext);
}
