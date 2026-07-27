import {
  Bot,
  ClipboardCheck,
  Cog,
  DraftingCompass,
  Factory,
  FolderKanban,
  Handshake,
  LayoutDashboard,
  type LucideIcon,
  Megaphone,
  Navigation,
  Package,
  ScrollText,
  ShieldCheck,
  ShoppingCart,
  Radar,
  Truck,
  Users,
  Wallet,
  Workflow,
  Wrench,
} from "lucide-react";

// UX.14 — per-module Lucide icons for the COLLAPSED sidebar rail. The expanded nav
// uses a dot+name marker (no per-module icon), so the collapsed rail needs its own
// sensible icon per module. Lucide thin stroke, one per module key; a neutral
// fallback keeps any future/unknown module reachable rather than blank.
export const MODULE_ICON: Record<string, LucideIcon> = {
  // Core
  core: LayoutDashboard,
  agents: Bot,
  workflows: Workflow,
  projects: FolderKanban,
  machines: Cog,
  // Value chain
  procurement: ShoppingCart,
  manufacturing: Factory,
  inventory: Package,
  fulfillment: Truck,
  quality: ClipboardCheck,
  sales: Handshake,
  marketing: Megaphone,
  // Robotics
  fleet: Radar,
  "field-service": Wrench,
  engineering: DraftingCompass,
  autonomy: Navigation,
  // Back office
  finance: Wallet,
  people: Users,
  security: ShieldCheck,
  legal: ScrollText,
};

export function moduleIcon(key: string): LucideIcon {
  return MODULE_ICON[key] ?? LayoutDashboard;
}
