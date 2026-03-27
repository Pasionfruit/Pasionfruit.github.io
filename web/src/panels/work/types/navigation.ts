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
  | "Learning"
  | "Resume"
  | "Technical Skills"
  | "Certifications"
  | "Contact Info";

export type NavSection = "Overview" | "Project" | "Team" | "Resources" | "Experience";

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
      { key: "Learning", label: "Projects" },
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
  {
    name: "Experience",
    tabs: [
      { key: "Resume", label: "Resume" },
      { key: "Technical Skills", label: "Technical Skills" },
      { key: "Certifications", label: "Certifications" },
      { key: "Contact Info", label: "Contact Info" },
    ],
  },
];
