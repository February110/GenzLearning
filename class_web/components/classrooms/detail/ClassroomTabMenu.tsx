"use client";

import React from "react";

export type TabItem = {
  id: string;
  label: string;
  indicator?: boolean;
};

interface ClassroomTabMenuProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
}

export default function ClassroomTabMenu({ tabs, activeTab, onChange }: ClassroomTabMenuProps) {
  return (
    <div className="overflow-x-auto">
      <div className="flex gap-3 border-b border-black/10 dark:border-white/10 px-2 md:px-0">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`flex items-center gap-1 rounded-t-xl border-b-2 px-3 py-2 text-sm font-semibold transition ${
                isActive
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white"
              }`}
            >
              <span>{tab.label}</span>
              {tab.indicator ? <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
