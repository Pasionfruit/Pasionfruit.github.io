export type TabName =
  | "Schedule"
  | "Requirements"
  | "Tickets"
  | "Overview"
  | "Members"
  | "Milestones"
  | "Tasks"
  | "Automation"
  | "Devices"
  | "Simulator"
  | "Test Case Generation"
  | "Learning";

export type NavSection = "Overview" | "Project" | "Team" | "Resources";

export const navSections: Array<{ name: NavSection; tabs: Array<{ key: TabName; label: string }> }> = [
  {
    name: "Overview",
    tabs: [
      { key: "Schedule", label: "Schedule" },
      { key: "Overview", label: "Status" },
    ],
  },
  {
    name: "Project",
    tabs: [
      { key: "Requirements", label: "Requirements" },
      { key: "Tickets", label: "Tickets" },
      { key: "Test Case Generation", label: "Test case generation" },
      { key: "Learning", label: "Learning" },
    ],
  },
  {
    name: "Team",
    tabs: [
      { key: "Members", label: "Members" },
      { key: "Milestones", label: "Milestones" },
      { key: "Tasks", label: "Tasks" },
    ],
  },
  {
    name: "Resources",
    tabs: [
      { key: "Automation", label: "Automation" },
      { key: "Devices", label: "Devices" },
      { key: "Simulator", label: "Simulator" },
    ],
  },
];
