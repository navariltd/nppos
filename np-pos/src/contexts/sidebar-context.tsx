"use client"

import * as React from "react"

export interface SidebarConfig {
  variant: "sidebar" | "floating" | "inset"
  collapsible: "offcanvas" | "icon" | "none"
  side: "left" | "right"
}

export interface SidebarContextValue {
  config: SidebarConfig
  updateConfig: (config: Partial<SidebarConfig>) => void
}

export const SidebarContext = React.createContext<SidebarContextValue | null>(null)

const STORAGE_KEY = "nppos:sidebar-config"

function loadSidebarConfig(): SidebarConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveSidebarConfig(config: SidebarConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch {
    // Ignore
  }
}

const DEFAULT_CONFIG: SidebarConfig = {
  variant: "inset",
  collapsible: "icon",
  side: "left",
}

export function SidebarConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = React.useState<SidebarConfig>(() => {
    return loadSidebarConfig() ?? DEFAULT_CONFIG
  })
  const [hydrated, setHydrated] = React.useState(false)

  // Mark hydrated on mount (after reading from localStorage)
  React.useEffect(() => {
    setHydrated(true)
  }, [])

  // Persist whenever config changes (skip initial read)
  React.useEffect(() => {
    if (!hydrated) return
    saveSidebarConfig(config)
  }, [config, hydrated])

  const updateConfig = React.useCallback((newConfig: Partial<SidebarConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }))
  }, [])

  return (
    <SidebarContext.Provider value={{ config, updateConfig }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebarConfig() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebarConfig must be used within a SidebarConfigProvider")
  }
  return context
}