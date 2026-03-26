export type ProjectName = "SunGuide" | "NG SELS";

export type RequirementStatus = "Passed" | "Failed" | "Rewrite Requested";
export type TicketStatus = "Open" | "In Progress" | "Done" | "Blocked";
export type TicketPriority = "Low" | "Medium" | "High" | "Critical";
export type AssignmentStatus = "Planned" | "In Progress" | "Done";

export interface Requirement {
  id: string;
  project: ProjectName;
  requirement: string;
  description: string;
  functionBlock: string;
  status: RequirementStatus;
  relatedTestCases: string;
  failedTestCases: string;
  notes: string;
}

export interface Ticket {
  id: string;
  project: ProjectName;
  ticket: string;
  summary: string;
  priority: TicketPriority;
  failureBuild: string;
  fixedBuild: string;
  status: TicketStatus;
  associatedTestCases: string;

  resolutionNotes: string;
}
export interface AssignmentItem {
  id: string;
  project: ProjectName;
  date: string;
  startDate: string;
  dueDate: string;
  teamMember: string;
  taskName: string;
  task: string;
  status: AssignmentStatus;
}

export interface TeamActionItem {
  id: string;
  project: ProjectName;
  teamMember: string;
  action: string;
  dueDate: string;
  status: AssignmentStatus;
}

export interface TeamMember {
  id: string;
  project: ProjectName;
  name: string;
  position: string;
  pointOfContact: string;
}

export interface Device {
  id: string;
  project: ProjectName;
  name: string;
  type: string;
  status: string;
  notes: string;
}

export interface SimulatorScenario {
  id: string;
  project: ProjectName;
  name: string;
  description: string;
  status: string;
}

export interface TestCase {
  id: string;
  project: ProjectName;
  title: string;
  sourceType: "requirement" | "ticket";
  sourceId: string;
  precondition: string;
  steps: string;
  expectedResult: string;
}

export interface IngestedChunk {
  id: string;
  project: ProjectName;
  sourceFile: string;
  sourceType: "excel" | "pdf";
  section: string;
  text: string;
}

export interface ChatExchange {
  id: string;
  project: ProjectName;
  question: string;
  answer: string;
  sourceChunkIds: string[];
  createdAt: string;
}
