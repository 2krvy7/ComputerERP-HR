
"use client";

interface HeaderProps {
  pageTitle?: string;
}

export default function Header({
  pageTitle = "Inventory Control",
}: HeaderProps) {
  return (
    <header className="flex items-center border-b border-[#DCE7EA] bg-white px-6 py-4 md:px-10">
      <h1 className="text-lg font-bold text-[#1F3338]">
        {pageTitle}
      </h1>
    </header>
  );
}
