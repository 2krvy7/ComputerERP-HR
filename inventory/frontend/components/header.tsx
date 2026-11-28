
"use client";

import { Menu } from "lucide-react";

interface HeaderProps {
  pageTitle?: string;
  onMenuClick?: () => void;
}

export default function Header({
  pageTitle = "Inventory Control",
  onMenuClick,
}: HeaderProps) {
  return (
    <header className="flex items-center gap-3 border-b border-[#DCE7EA] bg-white px-4 py-4 md:px-10">

  {/* Mobile Menu Button */}
  <button
    type="button"
    onClick={onMenuClick}
    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#365f68] transition-colors hover:bg-[#F2F7F8] md:hidden"
    aria-label="Open navigation menu"
  >
    <Menu className="h-6 w-6" />
  </button>

  {/* Page Title */}
  <h1 className="text-lg font-bold text-[#1F3338]">
    {pageTitle}
  </h1>

</header>
  );
}
