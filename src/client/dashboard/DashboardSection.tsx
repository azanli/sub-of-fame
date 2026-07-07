import type { ReactNode } from 'react';

type DashboardSectionProps = {
  label: string;
  children: ReactNode;
};

export const DashboardSection = ({ label, children }: DashboardSectionProps) => (
  <div className="flex flex-col gap-2">
    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</p>
    <div className="flex flex-col gap-2 pr-1">{children}</div>
  </div>
);
