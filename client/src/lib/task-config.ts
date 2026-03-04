import {
  Syringe,
  Stethoscope,
  Activity,
  PawPrint,
  ClipboardList,
  Calendar,
  FileText,
  type LucideIcon,
} from "lucide-react";

export interface TaskCategoryConfig {
  id: string;
  label: string;
  icon: LucideIcon;
  bgColor: string;
  textColor: string;
  badgeBg: string;
  badgeText: string;
}

export interface TaskPriorityConfig {
  id: string;
  label: string;
  bgColor: string;
  textColor: string;
}

export const TASK_CATEGORIES: TaskCategoryConfig[] = [
  {
    id: "vaccine",
    label: "Vaccine",
    icon: Syringe,
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
    textColor: "text-blue-600 dark:text-blue-400",
    badgeBg: "#E2ECFF",
    badgeText: "#666ee8",
  },
  {
    id: "medical",
    label: "Medical",
    icon: Stethoscope,
    bgColor: "bg-red-50 dark:bg-red-950/30",
    textColor: "text-red-600 dark:text-red-400",
    badgeBg: "#FFDEDE",
    badgeText: "#ff4961",
  },
  {
    id: "spay_neuter",
    label: "Spay/Neuter",
    icon: Activity,
    bgColor: "bg-purple-50 dark:bg-purple-950/30",
    textColor: "text-purple-600 dark:text-purple-400",
    badgeBg: "#F3E8FF",
    badgeText: "#9333ea",
  },
  {
    id: "grooming",
    label: "Grooming",
    icon: PawPrint,
    bgColor: "bg-pink-50 dark:bg-pink-950/30",
    textColor: "text-pink-600 dark:text-pink-400",
    badgeBg: "#FCE7F3",
    badgeText: "#db2777",
  },
  {
    id: "behavior_eval",
    label: "Behavior Eval",
    icon: ClipboardList,
    bgColor: "bg-yellow-50 dark:bg-yellow-950/30",
    textColor: "text-yellow-600 dark:text-yellow-400",
    badgeBg: "#FFEED9",
    badgeText: "#ff9149",
  },
  {
    id: "follow_up",
    label: "Follow Up",
    icon: Calendar,
    bgColor: "bg-green-50 dark:bg-green-950/30",
    textColor: "text-green-600 dark:text-green-400",
    badgeBg: "#D2FFE8",
    badgeText: "#28d094",
  },
  {
    id: "admin",
    label: "Admin",
    icon: FileText,
    bgColor: "bg-gray-50 dark:bg-gray-800/30",
    textColor: "text-gray-600 dark:text-gray-400",
    badgeBg: "#E5E7EB",
    badgeText: "#6b7280",
  },
  {
    id: "custom",
    label: "Custom",
    icon: ClipboardList,
    bgColor: "bg-slate-50 dark:bg-slate-800/30",
    textColor: "text-slate-600 dark:text-slate-400",
    badgeBg: "#CCF5F8",
    badgeText: "#1e9ff2",
  },
];

export const TASK_PRIORITIES: TaskPriorityConfig[] = [
  { id: "low", label: "Low", bgColor: "bg-gray-100", textColor: "text-gray-700" },
  { id: "medium", label: "Medium", bgColor: "bg-blue-100", textColor: "text-blue-700" },
  { id: "high", label: "High", bgColor: "bg-orange-100", textColor: "text-orange-700" },
  { id: "urgent", label: "Urgent", bgColor: "bg-red-100", textColor: "text-red-700" },
];

export function getTaskCategory(typeId: string): TaskCategoryConfig {
  return TASK_CATEGORIES.find(c => c.id === typeId) || TASK_CATEGORIES.find(c => c.id === "custom")!;
}

export function getTaskPriority(priorityId: string): TaskPriorityConfig {
  return TASK_PRIORITIES.find(p => p.id === priorityId) || TASK_PRIORITIES.find(p => p.id === "medium")!;
}

export const TASK_STATUS_FILTERS = [
  { id: "all", label: "All Tasks" },
  { id: "pending", label: "Pending" },
  { id: "completed", label: "Completed" },
  { id: "overdue", label: "Overdue" },
];
