"use client";

import { createContext, useContext, useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@kodhom/ui/components/button";

const MobileMenuContext = createContext({
  isOpen: false,
  toggle: () => {},
  close: () => {},
});

export function useMobileMenu() {
  return useContext(MobileMenuContext);
}

export function MobileMenuProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <MobileMenuContext.Provider
      value={{
        isOpen,
        toggle: () => setIsOpen((v) => !v),
        close: () => setIsOpen(false),
      }}
    >
      {children}
    </MobileMenuContext.Provider>
  );
}

export function MobileMenuButton() {
  const { toggle } = useMobileMenu();
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-9 w-9 flex-shrink-0 rounded-lg hover:bg-accent/80"
      onClick={toggle}
    >
      <Menu className="h-5 w-5" />
    </Button>
  );
}
