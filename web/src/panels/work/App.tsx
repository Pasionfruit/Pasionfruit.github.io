import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  AssignmentItem,
  AssignmentStatus,
  ChatExchange,
  IngestedChunk,
  ProjectName,
  Requirement,
  RequirementStatus,
  Device,
  SimulatorScenario,
  TeamMember,
  TeamActionItem,
  TestCase,
  Ticket,
  TicketPriority,
  TicketStatus,
} from "./types/domain";
import { chunkText, retrieveTopChunks } from "./utils/rag";
import {
  loadRequirements, saveRequirements,
  loadTickets, saveTickets,
  loadTestCases, saveTestCases,
  loadAssignments, saveAssignments,
  loadTeamMembers, saveTeamMembers,
  loadTeamActions,
  loadDevices, saveDevices,
  loadSimulators, saveSimulators,
  loadChunks, saveChunks,
  loadChats, saveChats,
  setTokenGetter,
} from "./utils/sheetsClient";
import { TabName, NavSection, navSections } from "./types/navigation";
import type { GoogleAuthState } from "../../hooks/useGoogleAuth";

(pdfjsLib as typeof pdfjsLib & { GlobalWorkerOptions: { workerSrc: string } }).GlobalWorkerOptions.workerSrc = pdfWorker;

const sampleRequirements: Requirement[] = [
  {
    id: "req-1",
    project: "SunGuide",
    requirement: "SG-REQ-001",
    description: "System should support user login with role-based access.",
    notes: "Core authentication flow",
    functionBlock: "Authentication",
    status: "Passed",
    relatedTestCases: "TC-SG-1, TC-SG-2",
    failedTestCases: "",
  },
  {
    id: "req-2",
    project: "NG SELS",
    requirement: "NG-REQ-001",
    description: "System should ingest project requirements from Excel and PDF.",
    notes: "RAG ingestion baseline",
    functionBlock: "Ingestion",
    status: "Passed",
    relatedTestCases: "",
    failedTestCases: "",
  },
];

const sampleTickets: Ticket[] = [
  {
    id: "tic-1",
    project: "SunGuide",
    ticket: "SUN-101",
    summary: "Login module fails under timeout",
    priority: "High",
    failureBuild: "1.2.0",
    fixedBuild: "1.2.2",
    status: "In Progress",
    associatedTestCases: "TC-SG-1",
    resolutionNotes: "",
  },
  {
    id: "tic-2",
    project: "NG SELS",
    ticket: "NGS-77",
    summary: "PDF parser skips table content",
    priority: "Critical",
    failureBuild: "0.9.1",
    fixedBuild: "",
    status: "Open",
    associatedTestCases: "TC-NG-4",
    resolutionNotes: "",
  },
];

const sampleAssignments: AssignmentItem[] = [
  {
    id: "asg-1",
    project: "SunGuide",
    date: "2026-03-26",
    startDate: "2026-03-24",
    dueDate: "2026-03-26",
    teamMember: "Michael",
    taskName: "Login Timeout Fix Validation",
    task: "Validate login timeout fix in build 1.2.2",
    status: "Planned",
  },
  {
    id: "asg-2",
    project: "NG SELS",
    date: "2026-03-27",
    startDate: "2026-03-25",
    dueDate: "2026-03-27",
    teamMember: "Yousra",
    taskName: "PDF Extraction Review",
    task: "Review PDF extraction edge cases",
    status: "In Progress",
  },
  {
    id: "asg-3",
    project: "SunGuide",
    date: "2026-03-28",
    startDate: "2026-03-26",
    dueDate: "2026-03-28",
    teamMember: "Chris",
    taskName: "Auth Regression Suite",
    task: "Run regression on auth-related tickets",
    status: "Planned",
  },
  {
    id: "asg-4",
    project: "SunGuide",
    date: "2026-03-29",
    startDate: "2026-03-27",
    dueDate: "2026-04-01",
    teamMember: "Network Team",
    taskName: "Network Failover Validation",
    task: "Validate network failover scenarios for field devices",
    status: "Planned",
  },
  {
    id: "asg-5",
    project: "NG SELS",
    date: "2026-03-30",
    startDate: "2026-03-30",
    dueDate: "2026-04-03",
    teamMember: "SwRI",
    taskName: "Requirements Traceability Review",
    task: "Review requirements traceability for subsystem interfaces",
    status: "Done",
  },
  {
    id: "asg-6",
    project: "NG SELS",
    date: "2026-03-31",
    startDate: "2026-03-31",
    dueDate: "2026-04-07",
    teamMember: "Arcadis",
    taskName: "Deployment Handoff Checklist",
    task: "Confirm deployment handoff checklist for release candidate",
    status: "Planned",
  },
];

const sampleTeamActions: TeamActionItem[] = [
  {
    id: "act-1",
    project: "SunGuide",
    teamMember: "Michael",
    action: "Create automated test for session timeout",
    dueDate: "2026-03-29",
    status: "In Progress",
  },
  {
    id: "act-2",
    project: "NG SELS",
    teamMember: "Yousra",
    action: "Document known parser limitations",
    dueDate: "2026-03-30",
    status: "Planned",
  },
  {
    id: "act-7",
    project: "NG SELS",
    teamMember: "Yousra",
    action: "Daily log: reviewed requirement traceability blockers and next steps",
    dueDate: "2026-04-04",
    status: "Done",
  },
  {
    id: "act-3",
    project: "SunGuide",
    teamMember: "Chris",
    action: "Close duplicate ticket after verification",
    dueDate: "2026-03-31",
    status: "Planned",
  },
  {
    id: "act-4",
    project: "SunGuide",
    teamMember: "Network Team",
    action: "Complete port and firewall validation for integration environment",
    dueDate: "2026-04-01",
    status: "Planned",
  },
  {
    id: "act-5",
    project: "NG SELS",
    teamMember: "SwRI",
    action: "Submit verification notes for control center workflows",
    dueDate: "2026-04-02",
    status: "Done",
  },
  {
    id: "act-6",
    project: "NG SELS",
    teamMember: "Arcadis",
    action: "Finalize onboarding notes for deployment support",
    dueDate: "2026-04-03",
    status: "Planned",
  },
];

const sampleTeamMembers: TeamMember[] = [
  {
    id: "tm-1",
    project: "SunGuide",
    name: "Michael",
    position: "QA Lead",
    pointOfContact: "michael@project.local",
  },
  {
    id: "tm-2",
    project: "NG SELS",
    name: "Yousra",
    position: "Systems Analyst",
    pointOfContact: "yousra@project.local",
  },
  {
    id: "tm-3",
    project: "SunGuide",
    name: "Chris",
    position: "Test Engineer",
    pointOfContact: "chris@project.local",
  },
  {
    id: "tm-4",
    project: "SunGuide",
    name: "Network Team",
    position: "Infrastructure Support",
    pointOfContact: "network.team@project.local",
  },
  {
    id: "tm-5",
    project: "NG SELS",
    name: "SwRI",
    position: "External Technical Partner",
    pointOfContact: "swri@project.local",
  },
  {
    id: "tm-6",
    project: "NG SELS",
    name: "Arcadis",
    position: "Deployment Partner",
    pointOfContact: "arcadis@project.local",
  },
];

const sampleDevices: Device[] = [
  {
    id: "dev-1",
    project: "SunGuide",
    name: "Field Controller Unit A",
    type: "Field Controller",
    status: "Online",
    notes: "Primary field device for SunGuide zone 1 integration.",
  },
  {
    id: "dev-2",
    project: "SunGuide",
    name: "Network Switch NX-04",
    type: "Network Switch",
    status: "Planned",
    notes: "Core switch supporting subsystem communication.",
  },
  {
    id: "dev-3",
    project: "NG SELS",
    name: "Subsystem Interface Board",
    type: "Interface Controller",
    status: "Online",
    notes: "Handles NG SELS subsystem signal routing.",
  },
];

const sampleSimulators: SimulatorScenario[] = [
  {
    id: "sim-1",
    project: "SunGuide",
    name: "Login timeout scenario",
    description: "Simulate a 30-second delay on the auth endpoint and verify session handling.",
    status: "Draft",
  },
  {
    id: "sim-2",
    project: "SunGuide",
    name: "Network failover test",
    description: "Drop the primary link and confirm fallback routing activates within threshold.",
    status: "Planned",
  },
  {
    id: "sim-3",
    project: "NG SELS",
    name: "Requirements ingestion load test",
    description: "Simulate ingestion of a large Excel file and verify chunk extraction accuracy.",
    status: "Draft",
  },
];

const sampleTestCases: TestCase[] = [
  {
    id: "tc-1",
    project: "SunGuide",
    title: "Validate login timeout handling",
    sourceType: "ticket",
    sourceId: "SUN-101",
    precondition: "User account exists and API is reachable",
    steps: "1. Submit login request\n2. Simulate 30s delay\n3. Verify retry behavior",
    expectedResult: "User sees retry prompt and no session corruption",
  },
];

function generateId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeRequirementStatus(status: string | undefined): RequirementStatus {
  const value = (status ?? "").trim().toLowerCase();
  if (value === "passed" || value === "approved") return "Passed";
  if (value === "failed" || value === "blocked") return "Failed";
  if (value === "rewrite requested" || value === "in review") return "Rewrite Requested";
  return "Passed";
}

interface WorkAppProps {
  authState: GoogleAuthState;
  isGuestMode: boolean;
  onGuestModeChange: (isGuestMode: boolean) => void;
  onBackToHub: () => void;
}

function WorkApp({ authState, isGuestMode, onGuestModeChange, onBackToHub }: WorkAppProps) {
  const [activeSection, setActiveSection] = useState<NavSection>(isGuestMode ? "Experience" : "Overview");
  const [activeTab, setActiveTab] = useState<TabName>(isGuestMode ? "Resume" : "Schedule");
  const [isLoading, setIsLoading] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [project, setProject] = useState<ProjectName>("SunGuide");
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [testcases, setTestcases] = useState<TestCase[]>([]);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamActions, setTeamActions] = useState<TeamActionItem[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [simulators, setSimulators] = useState<SimulatorScenario[]>([]);
  const [chunks, setChunks] = useState<IngestedChunk[]>([]);
  const [chats, setChats] = useState<ChatExchange[]>([]);

  const [reqForm, setReqForm] = useState<Omit<Requirement, "id" | "project">>({
    requirement: "",
    description: "",
    notes: "",
    functionBlock: "",
    status: "Passed",
    relatedTestCases: "",
    failedTestCases: "",
  });
  const [editingRequirementId, setEditingRequirementId] = useState<string | null>(null);

  const [reqStatusFilter, setReqStatusFilter] = useState<RequirementStatus | "All">("All");
  const [reqSearch, setReqSearch] = useState<string>("");
  const [reqFunctionBlockFilter, setReqFunctionBlockFilter] = useState<string>("");

  const [ticketStatusFilter, setTicketStatusFilter] = useState<TicketStatus | "All">("All");
  const [ticketPriorityFilter, setTicketPriorityFilter] = useState<TicketPriority | "All">("All");
  const [ticketSearch, setTicketSearch] = useState<string>("");
  const [isRequirementFormCollapsed, setIsRequirementFormCollapsed] = useState(true);
  const [isTicketFormCollapsed, setIsTicketFormCollapsed] = useState(true);
  const [isDeviceFormCollapsed, setIsDeviceFormCollapsed] = useState(true);
  const [isSimulatorFormCollapsed, setIsSimulatorFormCollapsed] = useState(true);
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null);
  const [ticketForm, setTicketForm] = useState<Omit<Ticket, "id" | "project">>({
    ticket: "",
    summary: "",
    priority: "Medium",
    failureBuild: "",
    fixedBuild: "",
    status: "Open",
    associatedTestCases: "",
    resolutionNotes: "",
  });
  const [assignmentStatusFilter, setAssignmentStatusFilter] = useState<AssignmentStatus | "All">("All");
  const [assignmentMemberFilter, setAssignmentMemberFilter] = useState<string>("All");
  const [assignmentDateFilter, setAssignmentDateFilter] = useState<string>("");
  const [assignmentStartDate, setAssignmentStartDate] = useState<string>("");
  const [assignmentEndDate, setAssignmentEndDate] = useState<string>("");
  const [assignmentSearch, setAssignmentSearch] = useState<string>("");
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isAssignmentFormCollapsed, setIsAssignmentFormCollapsed] = useState(false);
  const [isMilestoneFormCollapsed, setIsMilestoneFormCollapsed] = useState(true);
  
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [assignmentForm, setAssignmentForm] = useState<Omit<AssignmentItem, "id" | "project">>({
    date: "",
    startDate: "",
    dueDate: "",
    teamMember: "",
    taskName: "",
    task: "",
    status: "Planned",
  });
  
  const [memberSearch, setMemberSearch] = useState<string>("");
  const [deviceSearch, setDeviceSearch] = useState<string>("");
  const [deviceStatusFilter, setDeviceStatusFilter] = useState<string>("All");
  const [simulatorSearch, setSimulatorSearch] = useState<string>("");
  const [simulatorStatusFilter, setSimulatorStatusFilter] = useState<string>("All");

  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [memberForm, setMemberForm] = useState<Omit<TeamMember, "id" | "project">>({
    name: "",
    position: "",
    pointOfContact: "",
  });

  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
  const [deviceForm, setDeviceForm] = useState<Omit<Device, "id" | "project">>({ name: "", type: "", status: "", notes: "" });

  const [editingSimulatorId, setEditingSimulatorId] = useState<string | null>(null);
  const [simulatorForm, setSimulatorForm] = useState<Omit<SimulatorScenario, "id" | "project">>({ name: "", description: "", status: "" });

  const [tcForm, setTcForm] = useState<{
    sourceType: "requirement" | "ticket";
    sourceId: string;
    precondition: string;
    steps: string;
    expectedResult: string;
  }>({
    sourceType: "requirement",
    sourceId: "",
    precondition: "",
    steps: "",
    expectedResult: "",
  });

  const [learningQuery, setLearningQuery] = useState<string>("");
  const [learningAnswer, setLearningAnswer] = useState<string>("");
  const [learningSources, setLearningSources] = useState<IngestedChunk[]>([]);
  const [learningStatus, setLearningStatus] = useState<string>("");

  const { isAuthenticated, signIn, signOut, getToken } = authState;

  useEffect(() => {
    if (!isAuthenticated) return;
    setTokenGetter(getToken);
    setIsLoading(true);
    setSheetError(null);
    Promise.allSettled([
      loadRequirements(),
      loadTickets(),
      loadTestCases(),
      loadAssignments(),
      loadTeamMembers(),
      loadTeamActions(),
      loadDevices(),
      loadSimulators(),
      loadChunks(),
      loadChats(),
    ])
      .then((results) => {
        const [reqs, tix, tcs, asgns, members, actions, devs, sims, chks, cts] = results;

        const valueOr = <T,>(result: PromiseSettledResult<T>, fallback: T): T => {
          return result.status === "fulfilled" ? result.value : fallback;
        };

        setRequirements(
          valueOr(reqs, sampleRequirements).map((item) => ({
            ...item,
            status: normalizeRequirementStatus(item.status),
          }))
        );
        setTickets(valueOr(tix, sampleTickets));
        setTestcases(valueOr(tcs, sampleTestCases));
        setAssignments(valueOr(asgns, sampleAssignments));
        setTeamMembers(valueOr(members, sampleTeamMembers));
        setTeamActions(valueOr(actions, sampleTeamActions));
        setDevices(valueOr(devs, sampleDevices));
        setSimulators(valueOr(sims, sampleSimulators));
        setChunks(valueOr(chks, []));
        setChats(valueOr(cts, []));

        const failedCount = results.filter((result) => result.status === "rejected").length;
        if (failedCount > 0) {
          setLearningStatus(
            `Loaded with warnings: ${failedCount} sheet tab(s) failed to load. Check tab names and headers.`
          );
        } else {
          setLearningStatus("");
        }
      })
      .finally(() => setIsLoading(false));
  // getToken is a stable function referencing a module-level variable
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const projectRequirements = useMemo(() => {
    return requirements
      .filter((item) => item.project === project)
      .filter((item) =>
        reqStatusFilter === "All"
          ? true
          : normalizeRequirementStatus(item.status) === normalizeRequirementStatus(reqStatusFilter)
      )
      .filter((item) => {
        if (!reqFunctionBlockFilter.trim()) {
          return true;
        }
        return item.functionBlock.toLowerCase().includes(reqFunctionBlockFilter.trim().toLowerCase());
      })
      .filter((item) => {
        if (!reqSearch.trim()) {
          return true;
        }
        const needle = reqSearch.toLowerCase();
        return (
          item.requirement.toLowerCase().includes(needle) ||
          item.description.toLowerCase().includes(needle) ||
          item.functionBlock.toLowerCase().includes(needle) ||
          item.notes.toLowerCase().includes(needle)
        );
      });
  }, [requirements, project, reqStatusFilter, reqFunctionBlockFilter, reqSearch]);

  const projectTickets = useMemo(() => {
    return tickets
      .filter((item) => item.project === project)
      .filter((item) => (ticketStatusFilter === "All" ? true : item.status === ticketStatusFilter))
      .filter((item) => (ticketPriorityFilter === "All" ? true : item.priority === ticketPriorityFilter))
      .filter((item) => {
        if (!ticketSearch.trim()) {
          return true;
        }
        const needle = ticketSearch.toLowerCase();
        return item.ticket.toLowerCase().includes(needle) || item.summary.toLowerCase().includes(needle);
      });
  }, [tickets, project, ticketStatusFilter, ticketPriorityFilter, ticketSearch]);

  const projectAssignments = useMemo(() => {
    return assignments
      .filter((item) => item.project === project)
      .filter((item) => (assignmentStatusFilter === "All" ? true : item.status === assignmentStatusFilter))
      .filter((item) => (assignmentMemberFilter === "All" ? true : item.teamMember === assignmentMemberFilter))
      .filter((item) => (assignmentDateFilter ? item.date === assignmentDateFilter : true));
  }, [assignments, project, assignmentStatusFilter, assignmentMemberFilter, assignmentDateFilter]);

  const projectAssignmentsByDateRange = useMemo(() => {
    const q = assignmentSearch.toLowerCase();
    return assignments
      .filter((item) => item.project === project)
      .filter((item) => (assignmentStartDate ? item.startDate >= assignmentStartDate : true))
      .filter((item) => (assignmentEndDate ? item.dueDate <= assignmentEndDate : true))
      .filter((item) => q
        ? item.taskName.toLowerCase().includes(q) ||
          item.task.toLowerCase().includes(q) ||
          item.teamMember.toLowerCase().includes(q)
        : true
      );
  }, [assignments, project, assignmentStartDate, assignmentEndDate, assignmentSearch]);

  const projectTeamActions = useMemo(() => {
    return teamActions
      .filter((item) => item.project === project)
      .filter((item) => (assignmentStatusFilter === "All" ? true : item.status === assignmentStatusFilter))
      .filter((item) => (assignmentMemberFilter === "All" ? true : item.teamMember === assignmentMemberFilter));
  }, [teamActions, project, assignmentStatusFilter, assignmentMemberFilter]);

  const assignmentMembers = useMemo(() => {
    return Array.from(
      new Set(
        assignments
          .filter((item) => item.project === project)
          .map((item) => item.teamMember)
      )
    ).sort();
  }, [assignments, project]);

  const projectCalendarEntries = useMemo(() => {
    const assignmentEntries = assignments
      .filter((item) => item.project === project)
      .map((item) => ({
        id: item.id,
        date: item.date,
        title: item.taskName || item.task,
        owner: item.teamMember,
        source: "Assignment",
        status: item.status,
      }));

    const actionEntries = teamActions
      .filter((item) => item.project === project)
      .map((item) => ({
        id: item.id,
        date: item.dueDate,
        title: item.action,
        owner: item.teamMember,
        source: "Action",
        status: item.status,
      }));

    return [...assignmentEntries, ...actionEntries].sort((a, b) => a.date.localeCompare(b.date));
  }, [assignments, teamActions, project]);

  const projectTeamMembers = useMemo(() => {
    return teamMembers
      .filter((item) => item.project === project)
      .filter((item) => {
        if (!memberSearch.trim()) {
          return true;
        }
        const needle = memberSearch.toLowerCase();
        return item.name.toLowerCase().includes(needle) || item.position.toLowerCase().includes(needle);
      });
  }, [teamMembers, project, memberSearch]);

  const projectDevices = useMemo(() => {
    return devices
      .filter((item) => item.project === project)
      .filter((item) => (deviceStatusFilter === "All" ? true : item.status === deviceStatusFilter))
      .filter((item) => {
        if (!deviceSearch.trim()) {
          return true;
        }
        const needle = deviceSearch.toLowerCase();
        return item.name.toLowerCase().includes(needle) || item.type.toLowerCase().includes(needle);
      });
  }, [devices, project, deviceStatusFilter, deviceSearch]);

  const projectSimulators = useMemo(() => {
    return simulators
      .filter((item) => item.project === project)
      .filter((item) => (simulatorStatusFilter === "All" ? true : item.status === simulatorStatusFilter))
      .filter((item) => {
        if (!simulatorSearch.trim()) {
          return true;
        }
        const needle = simulatorSearch.toLowerCase();
        return item.name.toLowerCase().includes(needle) || item.description.toLowerCase().includes(needle);
      });
  }, [simulators, project, simulatorStatusFilter, simulatorSearch]);

  const projectTicketStatuses = useMemo(() => {
    const scopedTickets = tickets.filter((item) => item.project === project);
    return {
      open: scopedTickets.filter((item) => item.status === "Open").length,
      inProgress: scopedTickets.filter((item) => item.status === "In Progress").length,
      done: scopedTickets.filter((item) => item.status === "Done").length,
      blocked: scopedTickets.filter((item) => item.status === "Blocked").length,
    };
  }, [tickets, project]);

  const highPriorityTasks = useMemo(() => {
    const urgentTickets = tickets
      .filter((item) => item.project === project)
      .filter((item) => item.priority === "High" || item.priority === "Critical")
      .filter((item) => item.status !== "Done")
      .map((item) => ({
        id: item.id,
        title: `${item.ticket} - ${item.summary}`,
        owner: "Ticket",
        status: item.status,
        priority: item.priority,
      }));

    const urgentActions = teamActions
      .filter((item) => item.project === project)
      .filter((item) => item.status !== "Done")
      .slice(0, 3)
      .map((item) => ({
        id: item.id,
        title: item.action,
        owner: item.teamMember,
        status: item.status,
        priority: "High" as TicketPriority,
      }));

    return [...urgentTickets, ...urgentActions].slice(0, 6);
  }, [tickets, teamActions, project]);

  const projectTestCases = useMemo(
    () => testcases.filter((item) => item.project === project),
    [testcases, project]
  );

  const projectChunks = useMemo(() => chunks.filter((item) => item.project === project), [chunks, project]);
  const projectChats = useMemo(() => chats.filter((item) => item.project === project), [chats, project]);

  function calculateBusinessDays(startDateStr: string, endDateStr: string): number {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    let count = 0;
    const current = new Date(start);
    
    while (current <= end) {
      const dayOfWeek = current.getDay();
      // 0 = Sunday, 6 = Saturday
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
    
    return count;
  }

  const visibleNavSections = isGuestMode
    ? navSections.filter((section) => section.name === "Experience")
    : navSections;

  useEffect(() => {
    if (!isGuestMode) {
      return;
    }
    // Keep guest navigation pinned to the Experience section/tabs.
    if (activeSection !== "Experience") {
      setActiveSection("Experience");
    }
    const experienceTabs: ReadonlyArray<TabName> = [
      "Resume",
      "Technical Skills",
      "Certifications",
      "Contact Info",
    ];
    if (!experienceTabs.includes(activeTab)) {
      setActiveTab("Resume");
    }
  }, [isGuestMode, activeSection, activeTab]);

  function handleSignOutClick(): void {
    if (isGuestMode) {
      onGuestModeChange(false);
      onBackToHub();
      setActiveSection("Overview");
      setActiveTab("Schedule");
      return;
    }
    signOut();
  }

  function selectSection(section: NavSection): void {
    setActiveSection(section);
    const firstTab = visibleNavSections.find((item) => item.name === section)?.tabs[0]?.key;
    if (firstTab) {
      setActiveTab(firstTab);
    }
  }

  function selectTab(tab: TabName): void {
    setActiveTab(tab);
    const matchingSection = visibleNavSections.find((section) => section.tabs.some((item) => item.key === tab))?.name;
    if (matchingSection) {
      setActiveSection(matchingSection);
    }
  }

  function persistAll(next: {
    requirements?: Requirement[];
    tickets?: Ticket[];
    testcases?: TestCase[];
    assignments?: AssignmentItem[];
    teamMembers?: TeamMember[];
    devices?: Device[];
    simulators?: SimulatorScenario[];
    chunks?: IngestedChunk[];
    chats?: ChatExchange[];
  }): void {
    if (next.requirements) saveRequirements(next.requirements).catch(console.error);
    if (next.tickets) saveTickets(next.tickets).catch(console.error);
    if (next.testcases) saveTestCases(next.testcases).catch(console.error);
    if (next.assignments) saveAssignments(next.assignments).catch(console.error);
    if (next.teamMembers) saveTeamMembers(next.teamMembers).catch(console.error);
    if (next.devices) saveDevices(next.devices).catch(console.error);
    if (next.simulators) saveSimulators(next.simulators).catch(console.error);
    if (next.chunks) saveChunks(next.chunks).catch(console.error);
    if (next.chats) saveChats(next.chats).catch(console.error);
  }

  function handleProjectChange(value: ProjectName): void {
    setProject(value);
    setLearningAnswer("");
    setLearningSources([]);
  }

  function submitRequirement(event: FormEvent): void {
    event.preventDefault();
    const next = editingRequirementId
      ? requirements.map((item) =>
          item.id === editingRequirementId
            ? {
                ...item,
                ...reqForm,
              }
            : item
        )
      : [
          {
            id: generateId("req"),
            project,
            ...reqForm,
          },
          ...requirements,
        ];
    setRequirements(next);
    persistAll({ requirements: next });
    setReqForm({ requirement: "", description: "", notes: "", functionBlock: "", status: "Passed", relatedTestCases: "", failedTestCases: "" });
    setEditingRequirementId(null);
  }

  function editRequirement(item: Requirement): void {
    setEditingRequirementId(item.id);
    setIsRequirementFormCollapsed(false);
    setReqForm({
      requirement: item.requirement,
      description: item.description,
      notes: item.notes,
      functionBlock: item.functionBlock,
      status: item.status,
      relatedTestCases: item.relatedTestCases,
      failedTestCases: item.failedTestCases,
    });
  }

  function cancelRequirementEdit(): void {
    setEditingRequirementId(null);
    setReqForm({ requirement: "", description: "", notes: "", functionBlock: "", status: "Passed", relatedTestCases: "", failedTestCases: "" });
  }

  function removeRequirement(id: string): void {
    const next = requirements.filter((item) => item.id !== id);
    setRequirements(next);
    persistAll({ requirements: next });
    if (editingRequirementId === id) {
      cancelRequirementEdit();
    }
  }

  function importRequirements(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const fileName = file.name.toLowerCase();

      try {
        let importedData: Omit<Requirement, "id">[] = [];

        if (fileName.endsWith(".json")) {
          const parsed = JSON.parse(content);
          importedData = Array.isArray(parsed) ? parsed : [parsed];
        } else if (fileName.endsWith(".csv")) {
          const parsed = Papa.parse(content, { header: true, skipEmptyLines: true });
          importedData = parsed.data as Omit<Requirement, "id">[];
        } else {
          alert("Unsupported file format. Please use CSV or JSON.");
          return;
        }

        // Validate and add requirements
        const validRequirements: Omit<Requirement, "id">[] = [];
        for (const item of importedData) {
          if (item.requirement && item.description) {
            validRequirements.push({
              project: item.project || project,
              requirement: item.requirement,
              description: item.description,
              functionBlock: item.functionBlock || "",
              status: normalizeRequirementStatus(item.status),
              relatedTestCases:
                item.relatedTestCases || (item as { relatedTestcases?: string }).relatedTestcases || "",
              failedTestCases: item.failedTestCases || "",
              notes: item.notes || "",
            });
          }
        }

        if (validRequirements.length === 0) {
          alert("No valid requirements found in the file. Each requirement must have an ID and description.");
          return;
        }

        // Check for duplicates before adding
        const lookup = new Map<string, Requirement>();
        for (const req of requirements) {
          lookup.set(`${req.project}:${req.requirement}`, req);
        }

        const newRequirements: Requirement[] = [];
        let skipped = 0;

        for (const item of validRequirements) {
          const key = `${item.project}:${item.requirement}`;
          if (!lookup.has(key)) {
            newRequirements.push({
              id: generateId("req"),
              ...item,
            });
          } else {
            skipped += 1;
          }
        }

        if (newRequirements.length > 0) {
          const next = [...newRequirements, ...requirements];
          setRequirements(next);
          persistAll({ requirements: next });
          alert(`Imported ${newRequirements.length} requirement(s)${skipped > 0 ? `. Skipped ${skipped} duplicate(s)` : ""}.`);
        } else if (skipped > 0) {
          alert(`All ${skipped} requirement(s) already exist.`);
        }
      } catch (error) {
        alert(`Error parsing file: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    };
    reader.readAsText(file);
    // Reset the input so the same file can be imported again
    event.target.value = "";
  }

  function upsertTickets(imported: Omit<Ticket, "id">[]): void {
    const lookup = new Map<string, Ticket>();
    for (const ticket of tickets) {
      lookup.set(`${ticket.project}:${ticket.ticket}`, ticket);
    }

    let inserted = 0;
    let updated = 0;

    for (const item of imported) {
      const key = `${item.project}:${item.ticket}`;
      const existing = lookup.get(key);
      if (existing) {
        updated += 1;
        lookup.set(key, { ...existing, ...item });
      } else {
        inserted += 1;
        lookup.set(key, { ...item, id: generateId("tic") });
      }
    }

    const next = [...lookup.values()];
    setTickets(next);
    persistAll({ tickets: next });
  }

  function editTicket(item: Ticket): void {
    setEditingTicketId(item.id);
    setIsTicketFormCollapsed(false);
    setTicketForm({
      ticket: item.ticket,
      summary: item.summary,
      priority: item.priority,
      failureBuild: item.failureBuild,
      fixedBuild: item.fixedBuild,
      status: item.status,
      associatedTestCases: item.associatedTestCases,
      resolutionNotes: item.resolutionNotes,
    });
  }

  function updateTicket(event: FormEvent): void {
    event.preventDefault();
    if (!ticketForm.ticket.trim() || !ticketForm.summary.trim()) {
      alert("Ticket ID and Summary are required");
      return;
    }

    if (editingTicketId) {
      const next = tickets.map((item) =>
        item.id === editingTicketId
          ? {
              ...item,
              ...ticketForm,
            }
          : item
      );
      setTickets(next);
      persistAll({ tickets: next });
    } else {
      const newTicket: Ticket = {
        id: generateId("tic"),
        project,
        ...ticketForm,
      };
      const next = [...tickets, newTicket];
      setTickets(next);
      persistAll({ tickets: next });
    }
    cancelTicketEdit();
  }

  function deleteTicket(id: string): void {
    const next = tickets.filter((item) => item.id !== id);
    setTickets(next);
    persistAll({ tickets: next });
    if (editingTicketId === id) {
      cancelTicketEdit();
    }
  }

  function cancelTicketEdit(): void {
    setEditingTicketId(null);
    setTicketForm({
      ticket: "",
      summary: "",
      priority: "Medium",
      failureBuild: "",
      fixedBuild: "",
      status: "Open",
      associatedTestCases: "",
      resolutionNotes: "",
    });
  }
  // Export helper functions
  function exportToCSV(data: unknown[], filename: string): void {
    const headers = Object.keys(data[0] as Record<string, unknown>);
    const csv =
      headers.join(",") +
      "\n" +
      data
        .map((row) =>
          headers
            .map((header) => {
              const value = (row as Record<string, unknown>)[header];
              const stringValue = String(value === null || value === undefined ? "" : value);
              return `"${stringValue.replace(/"/g, '""')}"`;
            })
            .join(",")
        )
        .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    downloadFile(blob, `${filename}.csv`);
  }

  function exportToJSON(data: unknown[], filename: string): void {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json;charset=utf-8;" });
    downloadFile(blob, `${filename}.json`);
  }

  function downloadFile(blob: Blob, filename: string): void {
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function exportRequirements(format: "csv" | "json"): void {
    const data = projectRequirements.map((req) => ({
      requirement: req.requirement,
      description: req.description,
      functionBlock: req.functionBlock,
      status: req.status,
      relatedTestCases: req.relatedTestCases,
      failedTestCases: req.failedTestCases,
      notes: req.notes,
    }));
    if (format === "csv") {
      exportToCSV(data, `${project}-requirements`);
    } else {
      exportToJSON(data, `${project}-requirements`);
    }
  }

  function exportTickets(format: "csv" | "json"): void {
    const data = projectTickets.map((ticket) => ({
      ticket: ticket.ticket,
      summary: ticket.summary,
      priority: ticket.priority,
      failureBuild: ticket.failureBuild,
      fixedBuild: ticket.fixedBuild,
      status: ticket.status,
      associatedTestCases: ticket.associatedTestCases,
    }));
    if (format === "csv") {
      exportToCSV(data, `${project}-tickets`);
    } else {
      exportToJSON(data, `${project}-tickets`);
    }
  }

  function exportAssignments(format: "csv" | "json"): void {
    const data = projectAssignments.map((assignment) => ({
      date: assignment.date,
      startDate: assignment.startDate,
      dueDate: assignment.dueDate,
      teamMember: assignment.teamMember,
      taskName: assignment.taskName,
      task: assignment.task,
      status: assignment.status,
    }));
    if (format === "csv") {
      exportToCSV(data, `${project}-milestones`);
    } else {
      exportToJSON(data, `${project}-milestones`);
    }
  }

  function exportDevices(format: "csv" | "json"): void {
    const data = projectDevices.map((device) => ({
      name: device.name,
      type: device.type,
      status: device.status,
      notes: device.notes,
    }));
    if (format === "csv") {
      exportToCSV(data, `${project}-devices`);
    } else {
      exportToJSON(data, `${project}-devices`);
    }
  }

  function exportSimulators(format: "csv" | "json"): void {
    const data = projectSimulators.map((simulator) => ({
      name: simulator.name,
      description: simulator.description,
      status: simulator.status,
    }));
    if (format === "csv") {
      exportToCSV(data, `${project}-simulators`);
    } else {
      exportToJSON(data, `${project}-simulators`);
    }
  }

  function importTicketsGeneral(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const fileName = file.name.toLowerCase();

      try {
        let importedData: Omit<Ticket, "id">[] = [];

        if (fileName.endsWith(".json")) {
          const parsed = JSON.parse(content);
          const data = Array.isArray(parsed) ? parsed : [parsed];
          importedData = data.map((item: Record<string, unknown>) => ({
            project,
            ticket: String(item.ticket || ""),
            summary: String(item.summary || ""),
            priority: (item.priority || "Medium") as TicketPriority,
            failureBuild: String(item.failureBuild || ""),
            fixedBuild: String(item.fixedBuild || ""),
            status: (item.status || "Open") as TicketStatus,
            associatedTestCases: String(item.associatedTestCases || ""),
            resolutionNotes: String(item.resolutionNotes || item["resolution notes"] || ""),
          }));
        } else if (fileName.endsWith(".csv")) {
          const parsed = Papa.parse(content, { header: true, skipEmptyLines: true });
          importedData = (parsed.data as Record<string, unknown>[]).map((item) => ({
            project,
            ticket: String(item.ticket || ""),
            summary: String(item.summary || ""),
            priority: (item.priority || "Medium") as TicketPriority,
            failureBuild: String(item.failureBuild || ""),
            fixedBuild: String(item.fixedBuild || ""),
            status: (item.status || "Open") as TicketStatus,
            associatedTestCases: String(item.associatedTestCases || ""),
            resolutionNotes: String(item.resolutionNotes || item["resolution notes"] || ""),
          }));
        } else {
          alert("Unsupported file format. Please use CSV or JSON.");
          return;
        }

        if (importedData.length === 0) {
          alert("No valid tickets found in the file.");
          return;
        }

        upsertTickets(importedData);
      } catch (error) {
        console.error("Import failed:", error);
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  function importAssignments(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const fileName = file.name.toLowerCase();

      try {
        let importedData: Omit<AssignmentItem, "id">[] = [];

        const normalizeAssignment = (item: Record<string, unknown>): Omit<AssignmentItem, "id"> => ({
          project,
          date: String(item.date || item["milestone date"] || item["target date"] || item.startDate || item["start date"] || ""),
          startDate: String(item.startDate || item["start date"] || item.date || ""),
          dueDate: String(item.dueDate || item["due date"] || item["end date"] || item.targetDate || item["target date"] || ""),
          teamMember: String(item.teamMember || item["team member"] || item.owner || ""),
          taskName: String(item.taskName || item["task name"] || item.title || item.milestone || item["milestone name"] || ""),
          task: String(item.task || item.description || item.notes || ""),
          status: (item.status || "Planned") as AssignmentStatus,
        });

        if (fileName.endsWith(".json")) {
          const parsed = JSON.parse(content);
          const data = Array.isArray(parsed) ? parsed : [parsed];
          importedData = data.map((item) => normalizeAssignment(item as Record<string, unknown>));
        } else if (fileName.endsWith(".csv")) {
          const parsed = Papa.parse(content, { header: true, skipEmptyLines: true });
          importedData = (parsed.data as Record<string, unknown>[]).map((item) => normalizeAssignment(item));
        } else {
          alert("Unsupported file format. Please use CSV or JSON.");
          return;
        }

        const validAssignments = importedData.filter((item) => item.taskName.trim() && item.dueDate.trim());
        if (validAssignments.length === 0) {
          alert("No valid milestones found. Each milestone must have a task name and due date.");
          return;
        }

        const lookup = new Map<string, AssignmentItem>();
        for (const item of assignments) {
          lookup.set(`${item.project}:${item.taskName}:${item.dueDate}`, item);
        }

        let inserted = 0;
        let skipped = 0;
        for (const item of validAssignments) {
          const key = `${item.project}:${item.taskName}:${item.dueDate}`;
          if (lookup.has(key)) {
            skipped += 1;
            continue;
          }

          inserted += 1;
          lookup.set(key, {
            id: generateId("asg"),
            ...item,
          });
        }

        const next = [...lookup.values()];
        setAssignments(next);
        persistAll({ assignments: next });
        alert(`Imported ${inserted} milestone(s)${skipped > 0 ? `. Skipped ${skipped} duplicate(s).` : "."}`);
      } catch (error) {
        alert(`Error parsing file: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  function importDevices(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const fileName = file.name.toLowerCase();

      try {
        let importedData: Omit<Device, "id">[] = [];

        if (fileName.endsWith(".json")) {
          const parsed = JSON.parse(content);
          importedData = Array.isArray(parsed) ? parsed : [parsed];
        } else if (fileName.endsWith(".csv")) {
          const parsed = Papa.parse(content, { header: true, skipEmptyLines: true });
          importedData = parsed.data as Omit<Device, "id">[];
        } else {
          alert("Unsupported file format. Please use CSV or JSON.");
          return;
        }

        const validDevices: Omit<Device, "id">[] = [];
        for (const item of importedData) {
          if (item.name && item.type && item.status) {
            validDevices.push({
              project,
              name: item.name,
              type: item.type,
              status: item.status,
              notes: item.notes || "",
            });
          }
        }

        if (validDevices.length === 0) {
          alert("No valid devices found. Each device must have a name, type, and status.");
          return;
        }

        const lookup = new Map<string, Device>();
        for (const device of devices) {
          lookup.set(`${device.project}:${device.name}`, device);
        }

        const newDevices: Device[] = [];
        let skipped = 0;

        for (const item of validDevices) {
          const key = `${item.project}:${item.name}`;
          if (!lookup.has(key)) {
            newDevices.push({
              id: generateId("dev"),
              ...item,
            });
          } else {
            skipped += 1;
          }
        }

        if (newDevices.length > 0) {
          const next = [...newDevices, ...devices];
          setDevices(next);
          persistAll({ devices: next });
          alert(`Imported ${newDevices.length} device(s)${skipped > 0 ? `. Skipped ${skipped} duplicate(s)` : ""}.`);
        } else if (skipped > 0) {
          alert(`All ${skipped} device(s) already exist.`);
        }
      } catch (error) {
        alert(`Error parsing file: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  function importSimulators(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const fileName = file.name.toLowerCase();

      try {
        let importedData: Omit<SimulatorScenario, "id">[] = [];

        if (fileName.endsWith(".json")) {
          const parsed = JSON.parse(content);
          importedData = Array.isArray(parsed) ? parsed : [parsed];
        } else if (fileName.endsWith(".csv")) {
          const parsed = Papa.parse(content, { header: true, skipEmptyLines: true });
          importedData = parsed.data as Omit<SimulatorScenario, "id">[];
        } else {
          alert("Unsupported file format. Please use CSV or JSON.");
          return;
        }

        const validSimulators: Omit<SimulatorScenario, "id">[] = [];
        for (const item of importedData) {
          if (item.name && item.description && item.status) {
            validSimulators.push({
              project,
              name: item.name,
              description: item.description,
              status: item.status,
            });
          }
        }

        if (validSimulators.length === 0) {
          alert("No valid simulator scenarios found. Each scenario must have a name, description, and status.");
          return;
        }

        const lookup = new Map<string, SimulatorScenario>();
        for (const sim of simulators) {
          lookup.set(`${sim.project}:${sim.name}`, sim);
        }

        const newSimulators: SimulatorScenario[] = [];
        let skipped = 0;

        for (const item of validSimulators) {
          const key = `${item.project}:${item.name}`;
          if (!lookup.has(key)) {
            newSimulators.push({
              id: generateId("sim"),
              ...item,
            });
          } else {
            skipped += 1;
          }
        }

        if (newSimulators.length > 0) {
          const next = [...newSimulators, ...simulators];
          setSimulators(next);
          persistAll({ simulators: next });
          alert(`Imported ${newSimulators.length} simulator scenario(s)${skipped > 0 ? `. Skipped ${skipped} duplicate(s)` : ""}.`);
        } else if (skipped > 0) {
          alert(`All ${skipped} simulator scenario(s) already exist.`);
        }
      } catch (error) {
        alert(`Error parsing file: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  function submitMember(event: FormEvent): void {
    event.preventDefault();

    const next = editingMemberId
      ? teamMembers.map((item) =>
          item.id === editingMemberId
            ? {
                ...item,
                ...memberForm,
              }
            : item
        )
      : [
          {
            id: generateId("tm"),
            project,
            ...memberForm,
          },
          ...teamMembers,
        ];

    setTeamMembers(next);
    persistAll({ teamMembers: next });
    cancelMemberEdit();
  }

  function editMember(item: TeamMember): void {
    setEditingMemberId(item.id);
    setMemberForm({
      name: item.name,
      position: item.position,
      pointOfContact: item.pointOfContact,
    });
  }

  function deleteMember(id: string): void {
    const next = teamMembers.filter((item) => item.id !== id);
    setTeamMembers(next);
    persistAll({ teamMembers: next });
    if (editingMemberId === id) {
      cancelMemberEdit();
    }
  }

  function cancelMemberEdit(): void {
    setEditingMemberId(null);
    setMemberForm({
      name: "",
      position: "",
      pointOfContact: "",
    });
  }

  function submitDevice(event: FormEvent): void {
    event.preventDefault();
    const next = editingDeviceId
      ? devices.map((item) => (item.id === editingDeviceId ? { ...item, ...deviceForm } : item))
      : [{ id: generateId("dev"), project, ...deviceForm }, ...devices];
    setDevices(next);
    persistAll({ devices: next });
    cancelDeviceEdit();
  }

  function editDevice(item: Device): void {
    setEditingDeviceId(item.id);
    setIsDeviceFormCollapsed(false);
    setDeviceForm({ name: item.name, type: item.type, status: item.status, notes: item.notes });
  }

  function deleteDevice(id: string): void {
    const next = devices.filter((item) => item.id !== id);
    setDevices(next);
    persistAll({ devices: next });
    if (editingDeviceId === id) {
      cancelDeviceEdit();
    }
  }

  function cancelDeviceEdit(): void {
    setEditingDeviceId(null);
    setDeviceForm({ name: "", type: "", status: "", notes: "" });
  }

  function submitAssignment(event: FormEvent): void {
    event.preventDefault();
    const formWithDate = { ...assignmentForm, date: assignmentForm.date || selectedDate || assignmentForm.startDate };
    const next = editingAssignmentId
      ? assignments.map((item) => (item.id === editingAssignmentId ? { ...item, ...formWithDate } : item))
      : [{ id: generateId("asg"), project, ...formWithDate }, ...assignments];
    setAssignments(next);
    persistAll({ assignments: next });
    cancelAssignmentEdit();
  }

  function editAssignment(item: AssignmentItem): void {
    setEditingAssignmentId(item.id);
    setIsMilestoneFormCollapsed(false);
    setAssignmentForm({ date: item.date, startDate: item.startDate, dueDate: item.dueDate, teamMember: item.teamMember, taskName: item.taskName, task: item.task, status: item.status });
  }

  function deleteAssignment(id: string): void {
    const next = assignments.filter((item) => item.id !== id);
    setAssignments(next);
    persistAll({ assignments: next });
    if (editingAssignmentId === id) {
      cancelAssignmentEdit();
    }
  }

  function cancelAssignmentEdit(): void {
    setEditingAssignmentId(null);
    setIsMilestoneFormCollapsed(true);
    setAssignmentForm({ date: "", startDate: "", dueDate: "", teamMember: "", taskName: "", task: "", status: "Planned" });
  }

  function submitSimulator(event: FormEvent): void {
    event.preventDefault();
    const next = editingSimulatorId
      ? simulators.map((item) => (item.id === editingSimulatorId ? { ...item, ...simulatorForm } : item))
      : [{ id: generateId("sim"), project, ...simulatorForm }, ...simulators];
    setSimulators(next);
    persistAll({ simulators: next });
    cancelSimulatorEdit();
  }

  function editSimulator(item: SimulatorScenario): void {
    setEditingSimulatorId(item.id);
    setIsSimulatorFormCollapsed(false);
    setSimulatorForm({ name: item.name, description: item.description, status: item.status });
  }

  function deleteSimulator(id: string): void {
    const next = simulators.filter((item) => item.id !== id);
    setSimulators(next);
    persistAll({ simulators: next });
    if (editingSimulatorId === id) {
      cancelSimulatorEdit();
    }
  }

  function cancelSimulatorEdit(): void {
    setEditingSimulatorId(null);
    setSimulatorForm({ name: "", description: "", status: "" });
  }

  function createManualTestCase(event: FormEvent): void {
    event.preventDefault();
    if (!tcForm.sourceId.trim()) {
      return;
    }

    const sourceLabel = tcForm.sourceType === "requirement" ? "REQ" : "TICKET";
    const nextCase: TestCase = {
      id: generateId("tc"),
      project,
      title: `${sourceLabel}-${tcForm.sourceId} Validation`,
      sourceType: tcForm.sourceType,
      sourceId: tcForm.sourceId,
      precondition: tcForm.precondition,
      steps: tcForm.steps,
      expectedResult: tcForm.expectedResult,
    };

    const next = [nextCase, ...testcases];
    setTestcases(next);
    persistAll({ testcases: next });
    setTcForm({ sourceType: tcForm.sourceType, sourceId: "", precondition: "", steps: "", expectedResult: "" });
  }

  async function parseExcel(file: File): Promise<string[]> {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });

    const sections: string[] = [];
    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const csvText = XLSX.utils.sheet_to_csv(worksheet);
      sections.push(`Sheet: ${sheetName}\n${csvText}`);
    }
    return sections;
  }

  async function parsePdf(file: File): Promise<string[]> {
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    const pages: string[] = [];

    for (let i = 1; i <= pdf.numPages; i += 1) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .trim();
      pages.push(`Page ${i}\n${pageText}`);
    }

    return pages;
  }

  async function ingestLearningDocuments(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const files = event.target.files;
    if (!files || !files.length) {
      return;
    }

    setLearningStatus("Ingestion started...");
    const created: IngestedChunk[] = [];

    for (const file of Array.from(files)) {
      const name = file.name.toLowerCase();
      const isExcel = name.endsWith(".xlsx") || name.endsWith(".xls");
      const isPdf = name.endsWith(".pdf");
      if (!isExcel && !isPdf) {
        continue;
      }

      const sections = isExcel ? await parseExcel(file) : await parsePdf(file);
      const sourceType = isExcel ? "excel" : "pdf";

      for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex += 1) {
        const section = sections[sectionIndex];
        const textChunks = chunkText(section, 650);
        for (let chunkIndex = 0; chunkIndex < textChunks.length; chunkIndex += 1) {
          created.push({
            id: generateId("chunk"),
            project,
            sourceFile: file.name,
            sourceType,
            section: `${sourceType.toUpperCase()}-${sectionIndex + 1}.${chunkIndex + 1}`,
            text: textChunks[chunkIndex],
          });
        }
      }
    }

    const next = [...created, ...chunks];
    setChunks(next);
    persistAll({ chunks: next });
    setLearningStatus(`Ingestion complete: ${created.length} chunks added for ${project}.`);
    event.target.value = "";
  }

  function askLearningQuestion(event: FormEvent): void {
    event.preventDefault();
    if (!learningQuery.trim()) {
      return;
    }

    const top = retrieveTopChunks(learningQuery, projectChunks, 3);

    const answer =
      top.length === 0
        ? "No direct context was found in ingested documents. Upload more requirements or documentation for this project."
        : `Based on ingested docs, likely relevant guidance:\n${top
            .map((chunk, index) => `${index + 1}. ${chunk.text.slice(0, 220)}...`)
            .join("\n")}`;

    setLearningAnswer(answer);
    setLearningSources(top);

    const exchange: ChatExchange = {
      id: generateId("chat"),
      project,
      question: learningQuery,
      answer,
      sourceChunkIds: top.map((item) => item.id),
      createdAt: new Date().toISOString(),
    };

    const nextChats = [exchange, ...chats].slice(0, 40);
    setChats(nextChats);
    persistAll({ chats: nextChats });
    setLearningQuery("");
  }

  function renderRequirementsTab() {
    return (
      <div className="assignment-layout">
        <form className="panel form-panel" onSubmit={submitRequirement}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3 style={{ margin: 0 }}>{editingRequirementId ? "Update Requirement" : "Add Requirement"}</h3>
            <button
              type="button"
              onClick={() => setIsRequirementFormCollapsed(!isRequirementFormCollapsed)}
              style={{
                padding: "0.25rem 0.75rem",
                background: "none",
                border: "1px solid var(--border-color)",
                cursor: "pointer",
                fontSize: "0.9rem",
                borderRadius: "4px",
              }}
              title={isRequirementFormCollapsed ? "Expand form" : "Collapse form"}
            >
              {isRequirementFormCollapsed ? "▼" : "▲"}
            </button>
          </div>
          {!isRequirementFormCollapsed && (
            <>
              <div style={{ marginBottom: "1rem", paddingBottom: "1rem", borderBottom: "1px solid var(--border-color)" }}>
                <h4>Import Requirements</h4>
                <input
                  type="file"
                  id="import-requirements"
                  accept=".csv,.json"
                  onChange={importRequirements}
                  style={{ display: "none" }}
                />
                <button
                  type="button"
                  className="secondary"
                  onClick={() => document.getElementById("import-requirements")?.click()}
                >
                  Import (CSV/JSON)
                </button>
              </div>
              <div className="form-grid">
                <input
                  placeholder="Requirement ID"
                  value={reqForm.requirement}
                  onChange={(event) => setReqForm({ ...reqForm, requirement: event.target.value })}
                  required
                />
                <select
                  value={reqForm.status}
                  onChange={(event) => setReqForm({ ...reqForm, status: event.target.value as RequirementStatus })}
                >
                  <option>Passed</option>
                  <option>Failed</option>
                  <option>Rewrite Requested</option>
                </select>
                <textarea
                  placeholder="Description"
                  value={reqForm.description}
                  onChange={(event) => setReqForm({ ...reqForm, description: event.target.value })}
                  required
                />
                <input
                  placeholder="Function Block"
                  value={reqForm.functionBlock}
                  onChange={(event) => setReqForm({ ...reqForm, functionBlock: event.target.value })}
                />
                <input
                  placeholder="Related Test Cases"
                  value={reqForm.relatedTestCases}
                  onChange={(event) => setReqForm({ ...reqForm, relatedTestCases: event.target.value })}
                />
                <input
                  placeholder="Failed Test Cases"
                  value={reqForm.failedTestCases}
                  onChange={(event) => setReqForm({ ...reqForm, failedTestCases: event.target.value })}
                />
                <textarea
                  placeholder="Notes"
                  value={reqForm.notes}
                  onChange={(event) => setReqForm({ ...reqForm, notes: event.target.value })}
                />
              </div>
              <div className="button-row">
                <button type="submit">{editingRequirementId ? "Update Requirement" : "Save Requirement"}</button>
                {editingRequirementId ? (
                  <>
                    <button className="secondary" type="button" onClick={cancelRequirementEdit}>
                      Cancel
                    </button>
                    <button className="danger" type="button" onClick={() => removeRequirement(editingRequirementId)}>
                      Delete
                    </button>
                  </>
                ) : null}
              </div>
            </>
          )}
        </form>

        <div className="panel requirements-panel">
          <h3>{project} Requirements</h3>
          <div className="filter-toolbar requirements-filter-toolbar">
            <input
              placeholder="Search requirement, description, or notes"
              value={reqSearch}
              onChange={(event) => setReqSearch(event.target.value)}
            />
            <input
              placeholder="Filter Function Block #"
              value={reqFunctionBlockFilter}
              onChange={(event) => setReqFunctionBlockFilter(event.target.value)}
            />
            <select
              value={reqStatusFilter}
              onChange={(event) => setReqStatusFilter(event.target.value as RequirementStatus | "All")}
            >
              <option value="All">All Statuses</option>
              <option value="Passed">Passed</option>
              <option value="Failed">Failed</option>
              <option value="Rewrite Requested">Rewrite Requested</option>
            </select>
            <button
              type="button"
              className="secondary"
              onClick={() => exportRequirements("csv")}
            >
              Export CSV
            </button>
          </div>
          <div className="table-wrap requirements-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Requirement</th>
                  <th>Description</th>
                  <th>Function Block</th>
                  <th>Status</th>
                  <th>Related Test Cases</th>
                  <th>Failed Test Cases</th>
                  <th>Notes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {projectRequirements.map((row) => (
                  <tr key={row.id}>
                    <td>{row.requirement}</td>
                    <td>{row.description}</td>
                    <td>{row.functionBlock || "-"}</td>
                    <td>{row.status}</td>
                    <td>{row.relatedTestCases || "-"}</td>
                    <td>{row.failedTestCases || "-"}</td>
                    <td>{row.notes}</td>
                    <td>
                      <button
                        className="icon-button"
                        type="button"
                        aria-label={`Edit ${row.requirement}`}
                        title={`Edit ${row.requirement}`}
                        onClick={() => editRequirement(row)}
                      >
                        ✎
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  function renderTicketsTab() {
    return (
      <div className="assignment-layout">
        <div className="panel form-panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3 style={{ margin: 0 }}>{editingTicketId ? "Update Ticket" : "Add Ticket"}</h3>
            <button
              type="button"
              onClick={() => setIsTicketFormCollapsed(!isTicketFormCollapsed)}
              style={{
                padding: "0.25rem 0.75rem",
                background: "none",
                border: "1px solid var(--border-color)",
                cursor: "pointer",
                fontSize: "0.9rem",
                borderRadius: "4px",
              }}
              title={isTicketFormCollapsed ? "Expand form" : "Collapse form"}
            >
              {isTicketFormCollapsed ? "▼" : "▲"}
            </button>
          </div>
          {!isTicketFormCollapsed && (
            <>
              <div style={{ marginBottom: "1rem", paddingBottom: "1rem", borderBottom: "1px solid var(--border-color)" }}>
                <h4>Import Resolution Notes</h4>
                <input
                  type="file"
                  id="import-tickets"
                  accept=".csv,.json"
                  onChange={importTicketsGeneral}
                  style={{ display: "none" }}
                />
                <button
                  type="button"
                  className="secondary"
                  onClick={() => document.getElementById("import-tickets")?.click()}
                >
                  Import (CSV/JSON)
                </button>
              </div>
              <form className="ticket-editor" onSubmit={updateTicket}>
                <h4>{editingTicketId ? "Update Ticket" : "Add Ticket"}</h4>
                <div className="form-grid">
                  <input
                    placeholder="Ticket"
                    value={ticketForm.ticket}
                    onChange={(event) => setTicketForm({ ...ticketForm, ticket: event.target.value })}
                  />
                  <input
                    placeholder="Summary"
                    value={ticketForm.summary}
                    onChange={(event) => setTicketForm({ ...ticketForm, summary: event.target.value })}
                  />
                  <select
                    value={ticketForm.priority}
                    onChange={(event) => setTicketForm({ ...ticketForm, priority: event.target.value as TicketPriority })}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                  <input
                    placeholder="Failure Build"
                    value={ticketForm.failureBuild}
                    onChange={(event) => setTicketForm({ ...ticketForm, failureBuild: event.target.value })}
                  />
                  <input
                    placeholder="Fixed Build"
                    value={ticketForm.fixedBuild}
                    onChange={(event) => setTicketForm({ ...ticketForm, fixedBuild: event.target.value })}
                  />
                  <select
                    value={ticketForm.status}
                    onChange={(event) => setTicketForm({ ...ticketForm, status: event.target.value as TicketStatus })}
                  >
                    <option value="Open">Open</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Done">Done</option>
                    <option value="Blocked">Blocked</option>
                  </select>
                  <input
                    placeholder="Associated Test Cases"
                    value={ticketForm.associatedTestCases}
                    onChange={(event) => setTicketForm({ ...ticketForm, associatedTestCases: event.target.value })}
                  />
                  <textarea
                    placeholder="Resolution Notes"
                    value={ticketForm.resolutionNotes}
                    onChange={(event) => setTicketForm({ ...ticketForm, resolutionNotes: event.target.value })}
                  />
                </div>
                <div className="button-row">
                  <button type="submit">
                    {editingTicketId ? "Update Ticket" : "Add Ticket"}
                  </button>
                  {editingTicketId ? (
                    <>
                      <button className="secondary" type="button" onClick={cancelTicketEdit}>
                        Cancel
                      </button>
                      <button className="danger" type="button" onClick={() => editingTicketId && deleteTicket(editingTicketId)}>
                        Delete
                      </button>
                    </>
                  ) : null}
                </div>
              </form>
            </>
          )}
        </div>

        <div className="panel">
          <h3>{project} Tickets</h3>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <div className="filter-toolbar" style={{ marginBottom: "0" }}>
              <input
                placeholder="Search ticket or summary"
                value={ticketSearch}
                onChange={(event) => setTicketSearch(event.target.value)}
              />
              <select
                value={ticketStatusFilter}
                onChange={(event) => setTicketStatusFilter(event.target.value as TicketStatus | "All")}
              >
                <option value="All">All Statuses</option>
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Done">Done</option>
                <option value="Blocked">Blocked</option>
              </select>
              <select
                value={ticketPriorityFilter}
                onChange={(event) => setTicketPriorityFilter(event.target.value as TicketPriority | "All")}
              >
                <option value="All">All Priorities</option>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>
            <button
              type="button"
              className="secondary"
              onClick={() => exportTickets("csv")}
            >
              Export CSV
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Summary</th>
                  <th>Priority</th>
                  <th>Failure Build</th>
                  <th>Fixed Build</th>
                  <th>Status</th>
                  <th>Associated Test Cases</th>
                  <th>Resolution Notes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {projectTickets.map((row) => (
                  <tr key={row.id}>
                    <td>{row.ticket}</td>
                    <td>{row.summary}</td>
                    <td>{row.priority}</td>
                    <td>{row.failureBuild || "-"}</td>
                    <td>{row.fixedBuild || "-"}</td>
                    <td>{row.status}</td>
                    <td>{row.associatedTestCases || "-"}</td>
                    <td>{row.resolutionNotes || "-"}</td>
                    <td>
                      <button
                        className="icon-button"
                        type="button"
                        aria-label={`Edit ${row.ticket}`}
                        title={`Edit ${row.ticket}`}
                        onClick={() => editTicket(row)}
                      >
                        ✎
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  function renderOverviewTab() {
    const totalTickets = projectTicketStatuses.open + projectTicketStatuses.inProgress + projectTicketStatuses.done + projectTicketStatuses.blocked;
    
    // Calculate pie chart slices
    const slices = [
      { label: 'Open', count: projectTicketStatuses.open, color: '#ef4444', percentage: totalTickets > 0 ? (projectTicketStatuses.open / totalTickets) * 100 : 0 },
      { label: 'In Progress', count: projectTicketStatuses.inProgress, color: '#f59e0b', percentage: totalTickets > 0 ? (projectTicketStatuses.inProgress / totalTickets) * 100 : 0 },
      { label: 'Done', count: projectTicketStatuses.done, color: '#10b981', percentage: totalTickets > 0 ? (projectTicketStatuses.done / totalTickets) * 100 : 0 },
      { label: 'Blocked', count: projectTicketStatuses.blocked, color: '#8b5cf6', percentage: totalTickets > 0 ? (projectTicketStatuses.blocked / totalTickets) * 100 : 0 },
    ].filter(s => s.count > 0);

    // Generate SVG pie chart
    let cumulativePercentage = 0;
    const pathData = slices.map((slice) => {
      const startAngle = (cumulativePercentage / 100) * 2 * Math.PI - Math.PI / 2;
      const endAngle = ((cumulativePercentage + slice.percentage) / 100) * 2 * Math.PI - Math.PI / 2;
      const startX = Math.cos(startAngle) * 50;
      const startY = Math.sin(startAngle) * 50;
      const endX = Math.cos(endAngle) * 50;
      const endY = Math.sin(endAngle) * 50;
      const largeArc = slice.percentage > 50 ? 1 : 0;
      const path = `M 0 0 L ${startX} ${startY} A 50 50 0 ${largeArc} 1 ${endX} ${endY} Z`;
      cumulativePercentage += slice.percentage;
      return { ...slice, path };
    });

    return (
      <div className="overview-grid">
        <div className="panel metric-panel">
          <h3>High Priority Tasks</h3>
          {highPriorityTasks.length === 0 ? <p>No high priority tasks currently tracked.</p> : null}
          {highPriorityTasks.map((item) => (
            <p key={item.id}>
              {item.priority} | {item.owner} | {item.title} ({item.status})
            </p>
          ))}
        </div>

        <div className="panel metric-panel">
          <h3>Ticket Statuses</h3>
          <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
            {totalTickets > 0 ? (
              <svg viewBox="-60 -60 120 120" style={{ width: '150px', height: '150px', flexShrink: 0 }}>
                {pathData.map((slice, idx) => (
                  <path key={idx} d={slice.path} fill={slice.color} stroke="var(--bg-primary)" strokeWidth="2" />
                ))}
              </svg>
            ) : (
              <div style={{ width: '150px', height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
                No tickets
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {slices.map((slice) => (
                <div key={slice.label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '12px', height: '12px', backgroundColor: slice.color, borderRadius: '2px' }}></div>
                  <span style={{ fontSize: '0.9rem' }}>
                    {slice.label}: {slice.count} ({slice.percentage.toFixed(1)}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel metric-panel">
          <h3>Requirement Assessment</h3>
          <p>Total Requirements: {requirements.filter((item) => item.project === project).length}</p>
          <p>
            With Linked Testcases: {
              requirements
                .filter((item) => item.project === project)
                .filter((item) => item.relatedTestCases.trim().length > 0).length
            }
          </p>
          <p>
            Rewrite Requested: {requirements.filter((item) => item.project === project && item.status === "Rewrite Requested").length}
          </p>
          <p>Failed: {requirements.filter((item) => item.project === project && item.status === "Failed").length}</p>
        </div>
      </div>
    );
  }

  function renderMilestonesTab() {
    return (
      <div className="assignment-layout">
        <form className="panel form-panel" onSubmit={submitAssignment}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3 style={{ margin: 0 }}>{editingAssignmentId ? "Update Milestone" : "Add Milestone"}</h3>
            <button
              type="button"
              onClick={() => setIsMilestoneFormCollapsed(!isMilestoneFormCollapsed)}
              style={{
                padding: "0.25rem 0.75rem",
                background: "none",
                border: "1px solid var(--border-color)",
                cursor: "pointer",
                fontSize: "0.9rem",
                borderRadius: "4px",
              }}
              title={isMilestoneFormCollapsed ? "Expand form" : "Collapse form"}
            >
              {isMilestoneFormCollapsed ? "▼" : "▲"}
            </button>
          </div>
          {!isMilestoneFormCollapsed && (
            <>
              <div style={{ marginBottom: "1rem", paddingBottom: "1rem", borderBottom: "1px solid var(--border-color)" }}>
                <h4>Import Milestones</h4>
                <input
                  type="file"
                  id="import-milestones"
                  accept=".csv,.json"
                  onChange={importAssignments}
                  style={{ display: "none" }}
                />
                <button
                  type="button"
                  className="secondary"
                  onClick={() => document.getElementById("import-milestones")?.click()}
                >
                  Import (CSV/JSON)
                </button>
              </div>
              <div className="form-grid">
                <input
                  type="date"
                  value={assignmentForm.date}
                  onChange={(event) => setAssignmentForm({ ...assignmentForm, date: event.target.value })}
                />
                <input
                  type="date"
                  value={assignmentForm.startDate}
                  onChange={(event) => setAssignmentForm({ ...assignmentForm, startDate: event.target.value })}
                  required
                />
                <input
                  type="date"
                  value={assignmentForm.dueDate}
                  onChange={(event) => setAssignmentForm({ ...assignmentForm, dueDate: event.target.value })}
                  required
                />
                <input
                  placeholder="Team Member"
                  value={assignmentForm.teamMember}
                  onChange={(event) => setAssignmentForm({ ...assignmentForm, teamMember: event.target.value })}
                />
                <input
                  placeholder="Milestone Name"
                  value={assignmentForm.taskName}
                  onChange={(event) => setAssignmentForm({ ...assignmentForm, taskName: event.target.value })}
                  required
                />
                <textarea
                  placeholder="Milestone Details"
                  value={assignmentForm.task}
                  onChange={(event) => setAssignmentForm({ ...assignmentForm, task: event.target.value })}
                  required
                />
                <select
                  value={assignmentForm.status}
                  onChange={(event) => setAssignmentForm({ ...assignmentForm, status: event.target.value as AssignmentStatus })}
                >
                  <option value="Planned">Planned</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Done">Done</option>
                </select>
              </div>
              <div className="button-row">
                <button type="submit">{editingAssignmentId ? "Update Milestone" : "Add Milestone"}</button>
                {editingAssignmentId ? (
                  <>
                    <button className="secondary" type="button" onClick={cancelAssignmentEdit}>
                      Cancel
                    </button>
                    <button className="danger" type="button" onClick={() => deleteAssignment(editingAssignmentId)}>
                      Delete
                    </button>
                  </>
                ) : null}
              </div>
            </>
          )}
        </form>

        <div className="panel">
          <h3>{project} Milestones</h3>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <div className="filter-toolbar" style={{ marginBottom: "0" }}>
              <select value={assignmentMemberFilter} onChange={(event) => setAssignmentMemberFilter(event.target.value)}>
                <option value="All">All Team Members</option>
                {assignmentMembers.map((member) => (
                  <option key={member} value={member}>
                    {member}
                  </option>
                ))}
              </select>
              <select
                value={assignmentStatusFilter}
                onChange={(event) => setAssignmentStatusFilter(event.target.value as AssignmentStatus | "All")}
              >
                <option value="All">All Statuses</option>
                <option value="Planned">Planned</option>
                <option value="In Progress">In Progress</option>
                <option value="Done">Done</option>
              </select>
              <input type="date" value={assignmentDateFilter} onChange={(event) => setAssignmentDateFilter(event.target.value)} />
            </div>
            <button
              type="button"
              className="secondary"
              onClick={() => exportAssignments("csv")}
            >
              Export CSV
            </button>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Start Date</th>
                  <th>Due Date</th>
                  <th>Team Member</th>
                  <th>Milestone Name</th>
                  <th>Details</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {projectAssignments.map((row) => (
                  <tr key={row.id}>
                    <td>{row.startDate || row.date || "-"}</td>
                    <td>{row.dueDate}</td>
                    <td>{row.teamMember || "-"}</td>
                    <td>{row.taskName}</td>
                    <td>{row.task}</td>
                    <td>{row.status}</td>
                    <td>
                      <button
                        className="icon-button"
                        type="button"
                        aria-label={`Edit ${row.taskName}`}
                        title={`Edit ${row.taskName}`}
                        onClick={() => editAssignment(row)}
                      >
                        ✎
                      </button>
                    </td>
                  </tr>
                ))}
                {projectAssignments.length === 0 ? (
                  <tr>
                    <td colSpan={7}>No milestones match the current filters.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  function renderMembersTab() {
    function currentTaskCount(memberName: string): number {
      const scheduleCount = assignments.filter(
        (item) => item.project === project && item.teamMember === memberName && item.status !== "Done"
      ).length;
      const actionCount = teamActions.filter(
        (item) => item.project === project && item.teamMember === memberName && item.status !== "Done"
      ).length;
      return scheduleCount + actionCount;
    }

    return (
      <div className="tab-layout">
        <form className="panel form-panel" onSubmit={submitMember}>
          <h3>{editingMemberId ? "Update Member" : "Add Member"}</h3>
          <div className="form-grid">
            <input
              placeholder="Team member name"
              value={memberForm.name}
              onChange={(event) => setMemberForm({ ...memberForm, name: event.target.value })}
              required
            />
            <input
              placeholder="Position"
              value={memberForm.position}
              onChange={(event) => setMemberForm({ ...memberForm, position: event.target.value })}
              required
            />
            <input
              placeholder="Point of contact"
              value={memberForm.pointOfContact}
              onChange={(event) => setMemberForm({ ...memberForm, pointOfContact: event.target.value })}
              required
            />
          </div>
          <div className="button-row">
            <button type="submit">{editingMemberId ? "Update Member" : "Add Member"}</button>
            {editingMemberId ? (
              <>
                <button className="secondary" type="button" onClick={cancelMemberEdit}>
                  Cancel
                </button>
                <button className="danger" type="button" onClick={() => deleteMember(editingMemberId)}>
                  Delete
                </button>
              </>
            ) : null}
          </div>
        </form>

        <div className="panel">
          <h3>Members</h3>
          <div className="filter-toolbar">
            <input
              placeholder="Search member name or position"
              value={memberSearch}
              onChange={(event) => setMemberSearch(event.target.value)}
            />
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Team Member Name</th>
                  <th>Position</th>
                  <th>Number of Current Tasks</th>
                  <th>Point of Contact</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {projectTeamMembers.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>{row.position}</td>
                    <td>{currentTaskCount(row.name)}</td>
                    <td>{row.pointOfContact}</td>
                    <td>
                        <button
                          className="icon-button"
                          type="button"
                          aria-label={`Edit ${row.name}`}
                          title={`Edit ${row.name}`}
                          onClick={() => editMember(row)}
                        >
                          ✎
                        </button>
                    </td>
                  </tr>
                ))}
                {projectTeamMembers.length === 0 ? (
                  <tr>
                    <td colSpan={5}>No team members are configured for this project.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  function renderTasksTab() {
    const completedScheduleTasks = projectAssignments.filter((item) => item.status === "Done");
    const completedTeamActions = projectTeamActions.filter((item) => item.status === "Done");

    return (
      <div className="assignment-layout">
        <div className="panel">
          <h3>Team and Actionable Tasks</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Team Member</th>
                  <th>Action</th>
                  <th>Due Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {projectTeamActions.map((row) => (
                  <tr key={row.id}>
                    <td>{row.teamMember}</td>
                    <td>{row.action}</td>
                    <td>{row.dueDate}</td>
                    <td>{row.status}</td>
                  </tr>
                ))}
                {projectTeamActions.length === 0 ? (
                  <tr>
                    <td colSpan={4}>No team actions match the current filters.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel completed-panel">
          <h3>Completed Tasks</h3>
          <p className="status-note">{completedScheduleTasks.length + completedTeamActions.length} completed items</p>
          <div className="completed-grid">
            <div>
              <h4>Completed Schedule Tasks</h4>
              <ul className="completed-list">
                {completedScheduleTasks.length === 0 ? <li>No completed schedule tasks.</li> : null}
                {completedScheduleTasks.map((row) => (
                  <li key={row.id}>
                    {row.date} | {row.teamMember} | {row.task}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4>Completed Team Actions</h4>
              <ul className="completed-list">
                {completedTeamActions.length === 0 ? <li>No completed team actions.</li> : null}
                {completedTeamActions.map((row) => (
                  <li key={row.id}>
                    {row.dueDate} | {row.teamMember} | {row.action}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderCalendarTab() {
    // Group entries by date for calendar grid
    const entriesByDate: Record<string, typeof projectCalendarEntries> = {};
    projectCalendarEntries.forEach((entry) => {
      if (!entriesByDate[entry.date]) {
        entriesByDate[entry.date] = [];
      }
      entriesByDate[entry.date].push(entry);
    });

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const monthName = firstDay.toLocaleString("default", { month: "long", year: "numeric" });
    const days: (number | null)[] = [];

    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }

    const weeks: (number | null)[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }

    const goToPreviousMonth = () => {
      setCurrentMonth(new Date(year, month - 1, 1));
      setSelectedDate(null);
    };

    const goToNextMonth = () => {
      setCurrentMonth(new Date(year, month + 1, 1));
      setSelectedDate(null);
    };

    const getDateString = (day: number) => `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", height: "100%" }}>
        <div style={{ display: "flex", gap: "1rem", flex: 1 }}>
          <div className="panel" style={{ flex: 2, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <button type="button" onClick={goToPreviousMonth} style={{ padding: "0.5rem 1rem" }}>
                ← Prev
              </button>
              <h3 style={{ margin: 0, flex: 1, textAlign: "center" }}>{project} - {monthName}</h3>
              <button type="button" onClick={goToNextMonth} style={{ padding: "0.5rem 1rem" }}>
                Next →
              </button>
            </div>

            <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "1px", backgroundColor: "var(--border-color)", marginBottom: "1rem" }}>
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div key={day} style={{ padding: "0.5rem", textAlign: "center", backgroundColor: "var(--bg-primary)", fontWeight: "600" }}>
                    {day}
                  </div>
                ))}
              </div>
              <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "1px", backgroundColor: "var(--border-color)", overflow: "hidden" }}>
                {weeks.map((week) =>
                  week.map((day, dayIdx) => {
                    const weekDay = dayIdx;
                    const dateStr = day ? getDateString(day) : null;
                    const dayEntries = dateStr && entriesByDate[dateStr] ? entriesByDate[dateStr] : [];
                    const isSelected = selectedDate === dateStr;
                    const todayStr = new Date().toISOString().slice(0, 10);
                    const isToday = dateStr === todayStr;
                    return (
                      <div
                        key={`${day}-${weekDay}`}
                        onClick={() => {
                          if (dateStr) {
                            setSelectedDate(isSelected ? null : dateStr);
                          }
                        }}
                        style={{
                          padding: "0.5rem",
                          backgroundColor: isSelected
                            ? "var(--accent)"
                            : isToday
                            ? "color-mix(in srgb, var(--accent) 25%, var(--bg-secondary))"
                            : day
                            ? "var(--bg-secondary)"
                            : "var(--bg-tertiary)",
                          cursor: day ? "pointer" : "default",
                          transition: "background-color 0.2s",
                          overflow: "hidden",
                          verticalAlign: "top",
                        }}
                      >
                        {day && (
                          <>
                            <div style={{
                              fontWeight: "700",
                              marginBottom: "0.25rem",
                              color: isSelected ? "#fff" : isToday ? "var(--accent)" : undefined,
                            }}>
                              {day}
                            </div>
                            {dayEntries.length > 0 && (
                              <div style={{
                                fontSize: "0.72rem",
                                fontWeight: "600",
                                color: isSelected ? "var(--accent)" : "var(--accent)",
                                backgroundColor: isSelected ? "rgba(255,255,255,0.25)" : "var(--accent-light)",
                                borderRadius: "10px",
                                padding: "1px 6px",
                                display: "inline-block",
                              }}>
                                {dayEntries.length} task{dayEntries.length !== 1 ? "s" : ""}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="panel" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <form onSubmit={submitAssignment} style={{ marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <h3 style={{ margin: 0 }}>{editingAssignmentId ? "Update Assignment" : "Add Assignment"}</h3>
                <button
                  type="button"
                  onClick={() => setIsAssignmentFormCollapsed(!isAssignmentFormCollapsed)}
                  style={{
                    padding: "0.25rem 0.75rem",
                    background: "none",
                    border: "1px solid var(--border-color)",
                    cursor: "pointer",
                    fontSize: "0.9rem",
                    borderRadius: "4px",
                  }}
                  title={isAssignmentFormCollapsed ? "Expand form" : "Collapse form"}
                >
                  {isAssignmentFormCollapsed ? "▼" : "▲"}
                </button>
              </div>
              {!isAssignmentFormCollapsed && (
                <>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.85rem", fontWeight: "600" }}>
                  Start Date
                  <input
                    type="date"
                    value={assignmentForm.startDate}
                    onChange={(event) => setAssignmentForm({ ...assignmentForm, startDate: event.target.value })}
                    required
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.85rem", fontWeight: "600" }}>
                  Due Date
                  <input
                    type="date"
                    value={assignmentForm.dueDate}
                    onChange={(event) => setAssignmentForm({ ...assignmentForm, dueDate: event.target.value })}
                    required
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.85rem", fontWeight: "600" }}>
                  Task Name
                  <input
                    type="text"
                    value={assignmentForm.taskName}
                    onChange={(event) => setAssignmentForm({ ...assignmentForm, taskName: event.target.value })}
                    placeholder="e.g. Auth Regression Suite"
                    required
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.85rem", fontWeight: "600" }}>
                  Team Member <span style={{ fontWeight: "400", color: "var(--text-secondary)" }}>(optional)</span>
                  <input
                    type="text"
                    value={assignmentForm.teamMember}
                    onChange={(event) => setAssignmentForm({ ...assignmentForm, teamMember: event.target.value })}
                    placeholder="e.g. Michael"
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.85rem", fontWeight: "600" }}>
                  Task Description
                  <textarea
                    value={assignmentForm.task}
                    onChange={(event) => setAssignmentForm({ ...assignmentForm, task: event.target.value })}
                    placeholder="Describe what needs to be done..."
                    style={{ minHeight: "80px" }}
                    required
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.85rem", fontWeight: "600" }}>
                  Status
                  <select
                    value={assignmentForm.status}
                    onChange={(event) => setAssignmentForm({ ...assignmentForm, status: event.target.value as AssignmentStatus })}
                  >
                    <option value="Planned">Planned</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Done">Done</option>
                  </select>
                </label>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
                <button type="submit" style={{ flex: 1, padding: "0.75rem" }}>
                  {editingAssignmentId ? "Update" : "Add"}
                </button>
                {editingAssignmentId && (
                  <>
                    <button
                      type="button"
                      onClick={cancelAssignmentEdit}
                      className="secondary"
                      style={{ flex: 1, padding: "0.75rem" }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteAssignment(editingAssignmentId)}
                      style={{ flex: 1, padding: "0.75rem", backgroundColor: "var(--error-color)" }}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
              </>
              )}
            </form>

            <div style={{ flex: 1, overflowY: "auto" }}>
              {selectedDate ? (() => {
                const todayStr = new Date().toISOString().slice(0, 10);
                const bizDays = calculateBusinessDays(todayStr, selectedDate);
                const isPast = selectedDate < todayStr;
                const isToday = selectedDate === todayStr;
                const daysLabel = isToday
                  ? "Today"
                  : isPast
                  ? `${calculateBusinessDays(selectedDate, todayStr) - 1} business day${calculateBusinessDays(selectedDate, todayStr) - 1 !== 1 ? "s" : ""} ago`
                  : `${bizDays - 1} business day${bizDays - 1 !== 1 ? "s" : ""} away`;
                const selectedAssignments = projectAssignments.filter((a) => a.date === selectedDate);
                return (
                  <>
                    <div style={{ marginBottom: "1rem" }}>
                      <h3 style={{ margin: "0 0 0.25rem" }}>{selectedDate}</h3>
                      <span style={{ fontSize: "0.85rem", color: "var(--accent)", fontWeight: "600" }}>{daysLabel}</span>
                    </div>
                    {selectedAssignments.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                        {selectedAssignments.map((assignment) => (
                          <div
                            key={assignment.id}
                            style={{
                              padding: "1rem",
                              backgroundColor: editingAssignmentId === assignment.id ? "var(--accent-light)" : "var(--bg-secondary)",
                              border: `1px solid ${editingAssignmentId === assignment.id ? "var(--accent)" : "var(--border-color)"}`,
                              borderRadius: "4px",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "0.5rem" }}>
                              <h4 style={{ margin: 0 }}>{assignment.taskName}</h4>
                              <button
                                type="button"
                                onClick={() => editAssignment(assignment)}
                                style={{ padding: "0.25rem 0.5rem", background: "none", border: "none", cursor: "pointer", fontSize: "1.2rem" }}
                              >
                                ✎
                              </button>
                            </div>
                            <p style={{ margin: "0.25rem 0", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                              {assignment.startDate} → {assignment.dueDate}
                              {assignment.startDate && assignment.dueDate && (
                                <span style={{ marginLeft: "0.5rem", color: "var(--accent)" }}>
                                  ({calculateBusinessDays(assignment.startDate, assignment.dueDate)} biz days)
                                </span>
                              )}
                            </p>
                            {assignment.teamMember && (
                              <p style={{ margin: "0.25rem 0", fontSize: "0.9rem" }}>
                                <strong>Team Member:</strong> {assignment.teamMember}
                              </p>
                            )}
                            {assignment.task && (
                              <p style={{ margin: "0.25rem 0", fontSize: "0.9rem" }}>
                                <strong>Description:</strong> {assignment.task}
                              </p>
                            )}
                            <p style={{ margin: "0.25rem 0", fontSize: "0.9rem" }}>
                              <strong>Status:</strong> <span style={{ color: "var(--accent)" }}>{assignment.status}</span>
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ color: "var(--text-secondary)" }}>No assignments scheduled for this day.</p>
                    )}
                  </>
                );
              })() : (
                <p style={{ color: "var(--text-secondary)" }}>Click on a day to view or add assignments.</p>
              )}
          </div>
        </div>
        </div>

        <div className="panel">
          <h3>All Assignments</h3>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
            <input
              type="text"
              value={assignmentSearch}
              onChange={(e) => setAssignmentSearch(e.target.value)}
              placeholder="Search task, description, member…"
              style={{ flex: 1, minWidth: 200 }}
            />
            <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", whiteSpace: "nowrap" }}>
              <span style={{ fontSize: "0.85rem" }}>From:</span>
              <input
                type="date"
                value={assignmentStartDate}
                onChange={(event) => setAssignmentStartDate(event.target.value)}
                style={{ width: "135px" }}
              />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", whiteSpace: "nowrap" }}>
              <span style={{ fontSize: "0.85rem" }}>To:</span>
              <input
                type="date"
                value={assignmentEndDate}
                onChange={(event) => setAssignmentEndDate(event.target.value)}
                style={{ width: "135px" }}
              />
            </label>
            <button
              type="button"
              className="secondary"
              onClick={() => { setAssignmentStartDate(""); setAssignmentEndDate(""); setAssignmentSearch(""); }}
              style={{ padding: "0.4rem 0.9rem", fontSize: "0.85rem", whiteSpace: "nowrap" }}
            >
              Clear
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => exportAssignments("csv")}
              style={{ fontSize: "0.85rem", whiteSpace: "nowrap" }}
            >
              Export CSV
            </button>
          </div>
          <div className="table-wrap">
            <table style={{ fontSize: "0.9rem", tableLayout: "fixed", width: "100%" }}>
              <colgroup>
                <col style={{ width: "11%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "6%" }} />
                <col style={{ width: "34%" }} />
                <col style={{ width: "22%" }} />
                <col style={{ width: "16%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Start Date</th>
                  <th>Due Date</th>
                  <th>Days</th>
                  <th>Task Name</th>
                  <th>Team Member</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {projectAssignmentsByDateRange.map((row) => (
                  <tr key={row.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{row.startDate}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{row.dueDate}</td>
                    <td style={{ textAlign: "center" }}>{calculateBusinessDays(row.startDate, row.dueDate)}</td>
                    <td style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.taskName}</td>
                    <td style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.teamMember || "—"}</td>
                    <td>{row.status}</td>
                  </tr>
                ))}
                {projectAssignmentsByDateRange.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", padding: "1rem" }}>No assignments match the current filters.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  function renderAutomationTab() {
    return (
      <div className="panel">
        <h3>Automation</h3>
        <p>Use this area to manage automated workflows for requirements, tickets, test generation, and scheduled checks.</p>
        <div className="calendar-list">
          <div className="calendar-card">
            <div className="calendar-date">Workflow</div>
            <div className="calendar-content">
              <h4>Requirements sync validation</h4>
              <p>Validate imported requirement fields and flag missing testcase links.</p>
              <span className="calendar-status">Draft</span>
            </div>
          </div>
          <div className="calendar-card">
            <div className="calendar-date">Workflow</div>
            <div className="calendar-content">
              <h4>Ticket priority monitoring</h4>
              <p>Track new High and Critical tickets and surface them in overview health metrics.</p>
              <span className="calendar-status">Planned</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderDevicesTab() {
    return (
      <div className="assignment-layout">
        <form className="panel form-panel" onSubmit={submitDevice}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3 style={{ margin: 0 }}>{editingDeviceId ? "Update Device" : "Add Device"}</h3>
            <button
              type="button"
              onClick={() => setIsDeviceFormCollapsed(!isDeviceFormCollapsed)}
              style={{
                padding: "0.25rem 0.75rem",
                background: "none",
                border: "1px solid var(--border-color)",
                cursor: "pointer",
                fontSize: "0.9rem",
                borderRadius: "4px",
              }}
              title={isDeviceFormCollapsed ? "Expand form" : "Collapse form"}
            >
              {isDeviceFormCollapsed ? "▼" : "▲"}
            </button>
          </div>
          {!isDeviceFormCollapsed && (
            <>
              <div style={{ marginBottom: "1rem", paddingBottom: "1rem", borderBottom: "1px solid var(--border-color)" }}>
                <h4>Import Devices</h4>
                <input
                  type="file"
                  id="import-devices"
                  accept=".csv,.json"
                  onChange={importDevices}
                  style={{ display: "none" }}
                />
                <button
                  type="button"
                  className="secondary"
                  onClick={() => document.getElementById("import-devices")?.click()}
                >
                  Import (CSV/JSON)
                </button>
              </div>
              <div className="form-grid">
                <input
                  placeholder="Device name"
                  value={deviceForm.name}
                  onChange={(event) => setDeviceForm({ ...deviceForm, name: event.target.value })}
                  required
                />
                <input
                  placeholder="Type (e.g. Field Controller)"
                  value={deviceForm.type}
                  onChange={(event) => setDeviceForm({ ...deviceForm, type: event.target.value })}
                  required
                />
                <input
                  placeholder="Status (e.g. Online, Planned)"
                  value={deviceForm.status}
                  onChange={(event) => setDeviceForm({ ...deviceForm, status: event.target.value })}
                  required
                />
                <input
                  placeholder="Notes"
                  value={deviceForm.notes}
                  onChange={(event) => setDeviceForm({ ...deviceForm, notes: event.target.value })}
                />
              </div>
              <div className="button-row">
                <button type="submit">{editingDeviceId ? "Update Device" : "Add Device"}</button>
                {editingDeviceId ? (
                  <>
                    <button className="secondary" type="button" onClick={cancelDeviceEdit}>
                      Cancel
                    </button>
                    <button className="danger" type="button" onClick={() => deleteDevice(editingDeviceId)}>
                      Delete
                    </button>
                  </>
                ) : null}
              </div>
            </>
          )}
        </form>

        <div className="panel">
          <h3>Devices</h3>
          <div className="filter-toolbar">
            <input
              placeholder="Search device name or type"
              value={deviceSearch}
              onChange={(event) => setDeviceSearch(event.target.value)}
            />
            <select
              value={deviceStatusFilter}
              onChange={(event) => setDeviceStatusFilter(event.target.value)}
            >
              <option value="All">All Statuses</option>
              <option value="Online">Online</option>
              <option value="Planned">Planned</option>
              <option value="Offline">Offline</option>
            </select>
            <button
              type="button"
              className="secondary"
              onClick={() => exportDevices("csv")}
            >
              Export CSV
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {projectDevices.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>{row.type}</td>
                    <td>{row.status}</td>
                    <td>{row.notes}</td>
                    <td>
                      <button
                        className="icon-button"
                        type="button"
                        aria-label={`Edit ${row.name}`}
                        title={`Edit ${row.name}`}
                        onClick={() => editDevice(row)}
                      >
                        ✎
                      </button>
                    </td>
                  </tr>
                ))}
                {projectDevices.length === 0 ? (
                  <tr>
                    <td colSpan={5}>No devices are configured for this project.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  function renderSimulatorTab() {
    return (
      <div className="assignment-layout">
        <form className="panel form-panel" onSubmit={submitSimulator}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h3 style={{ margin: 0 }}>{editingSimulatorId ? "Update Scenario" : "Add Scenario"}</h3>
            <button
              type="button"
              onClick={() => setIsSimulatorFormCollapsed(!isSimulatorFormCollapsed)}
              style={{
                padding: "0.25rem 0.75rem",
                background: "none",
                border: "1px solid var(--border-color)",
                cursor: "pointer",
                fontSize: "0.9rem",
                borderRadius: "4px",
              }}
              title={isSimulatorFormCollapsed ? "Expand form" : "Collapse form"}
            >
              {isSimulatorFormCollapsed ? "▼" : "▲"}
            </button>
          </div>
          {!isSimulatorFormCollapsed && (
            <>
              <div style={{ marginBottom: "1rem", paddingBottom: "1rem", borderBottom: "1px solid var(--border-color)" }}>
                <h4>Import Simulator Scenarios</h4>
                <input
                  type="file"
                  id="import-simulators"
                  accept=".csv,.json"
                  onChange={importSimulators}
                  style={{ display: "none" }}
                />
                <button
                  type="button"
                  className="secondary"
                  onClick={() => document.getElementById("import-simulators")?.click()}
                >
                  Import (CSV/JSON)
                </button>
              </div>
              <div className="form-grid">
                <input
                  placeholder="Scenario name"
                  value={simulatorForm.name}
                  onChange={(event) => setSimulatorForm({ ...simulatorForm, name: event.target.value })}
                  required
                />
                <input
                  placeholder="Description"
                  value={simulatorForm.description}
                  onChange={(event) => setSimulatorForm({ ...simulatorForm, description: event.target.value })}
                  required
                />
                <input
                  placeholder="Status (e.g. Draft, Planned, Running)"
                  value={simulatorForm.status}
                  onChange={(event) => setSimulatorForm({ ...simulatorForm, status: event.target.value })}
                  required
                />
              </div>
              <div className="button-row">
                <button type="submit">{editingSimulatorId ? "Update Scenario" : "Add Scenario"}</button>
                {editingSimulatorId ? (
                  <>
                    <button className="secondary" type="button" onClick={cancelSimulatorEdit}>
                      Cancel
                    </button>
                    <button className="danger" type="button" onClick={() => deleteSimulator(editingSimulatorId)}>
                      Delete
                    </button>
                  </>
                ) : null}
              </div>
            </>
          )}
        </form>

        <div className="panel">
          <h3>Simulator Scenarios</h3>
          <div className="filter-toolbar">
            <input
              placeholder="Search scenario name or description"
              value={simulatorSearch}
              onChange={(event) => setSimulatorSearch(event.target.value)}
            />
            <select
              value={simulatorStatusFilter}
              onChange={(event) => setSimulatorStatusFilter(event.target.value)}
            >
              <option value="All">All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="Planned">Planned</option>
              <option value="Running">Running</option>
              <option value="Completed">Completed</option>
            </select>
            <button
              type="button"
              className="secondary"
              onClick={() => exportSimulators("csv")}
            >
              Export CSV
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {projectSimulators.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>{row.description}</td>
                    <td>{row.status}</td>
                    <td>
                      <button
                        className="icon-button"
                        type="button"
                        aria-label={`Edit ${row.name}`}
                        title={`Edit ${row.name}`}
                        onClick={() => editSimulator(row)}
                      >
                        ✎
                      </button>
                    </td>
                  </tr>
                ))}
                {projectSimulators.length === 0 ? (
                  <tr>
                    <td colSpan={4}>No simulator scenarios are configured for this project.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  function renderTestCaseTab() {
    const sourceOptions =
      tcForm.sourceType === "requirement"
        ? projectRequirements.map((item) => item.requirement)
        : projectTickets.map((item) => item.ticket);

    return (
      <div className="tab-layout">
        <form className="panel form-panel" onSubmit={createManualTestCase}>
          <h3>Manual Test Case Template</h3>
          <div className="form-grid">
            <select
              value={tcForm.sourceType}
              onChange={(event) => setTcForm({ ...tcForm, sourceType: event.target.value as "requirement" | "ticket", sourceId: "" })}
            >
              <option value="requirement">From Requirement</option>
              <option value="ticket">From Ticket</option>
            </select>

            <select
              value={tcForm.sourceId}
              onChange={(event) => setTcForm({ ...tcForm, sourceId: event.target.value })}
              required
            >
              <option value="">Select source</option>
              {sourceOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>

            <textarea
              placeholder="Precondition"
              value={tcForm.precondition}
              onChange={(event) => setTcForm({ ...tcForm, precondition: event.target.value })}
              required
            />
            <textarea
              placeholder="Test steps"
              value={tcForm.steps}
              onChange={(event) => setTcForm({ ...tcForm, steps: event.target.value })}
              required
            />
            <textarea
              placeholder="Expected result"
              value={tcForm.expectedResult}
              onChange={(event) => setTcForm({ ...tcForm, expectedResult: event.target.value })}
              required
            />
          </div>
          <button type="submit">Generate Manual Test Case</button>
        </form>

        <div className="panel">
          <h3>{project} Test Cases</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Source</th>
                  <th>Precondition</th>
                  <th>Steps</th>
                  <th>Expected Result</th>
                </tr>
              </thead>
              <tbody>
                {projectTestCases.map((row) => (
                  <tr key={row.id}>
                    <td>{row.title}</td>
                    <td>
                      {row.sourceType}: {row.sourceId}
                    </td>
                    <td>{row.precondition}</td>
                    <td>{row.steps}</td>
                    <td>{row.expectedResult}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  function renderLearningTab() {
    return (
      <div className="tab-layout">
        <div className="panel form-panel">
          <h3>Ingest Documentation (Excel/PDF)</h3>
          <input type="file" accept=".xlsx,.xls,.pdf" multiple onChange={ingestLearningDocuments} />
          <p>Project chunks indexed: {projectChunks.length}</p>
          {learningStatus ? <p className="status-note">{learningStatus}</p> : null}

          <form className="chat-form" onSubmit={askLearningQuestion}>
            <textarea
              placeholder={`Ask ${project} documentation...`}
              value={learningQuery}
              onChange={(event) => setLearningQuery(event.target.value)}
            />
            <button type="submit">Ask Projects Assistant</button>
          </form>
        </div>

        <div className="panel">
          <h3>Answer</h3>
          <pre className="answer-block">{learningAnswer || "No response yet."}</pre>

          <h4>Sources</h4>
          <ul className="source-list">
            {learningSources.length === 0 ? <li>No sources selected yet.</li> : null}
            {learningSources.map((source) => (
              <li key={source.id}>
                {source.sourceFile} | {source.section}
              </li>
            ))}
          </ul>

          <h4>Recent Questions</h4>
          <ul className="source-list">
            {projectChats.slice(0, 5).map((chat) => (
              <li key={chat.id}>{chat.question}</li>
            ))}
            {projectChats.length === 0 ? <li>No questions yet.</li> : null}
          </ul>
        </div>
      </div>
    );
  }

  function renderExperienceTab(section: "Resume" | "Technical Skills" | "Certifications" | "Contact Info") {
    const contentBySection = {
      "Resume": {
        title: "Resume",
        description: "View and update your professional summary and work experience highlights.",
      },
      "Technical Skills": {
        title: "Technical Skills",
        description: "Track core tools, languages, frameworks, and proficiency levels.",
      },
      "Certifications": {
        title: "Certifications",
        description: "Maintain active certifications, issue dates, and renewal timelines.",
      },
      "Contact Info": {
        title: "Contact Info",
        description: "Manage your professional contact channels and preferred outreach details.",
      },
    } as const;

    const content = contentBySection[section];
    return (
      <div className="tab-layout">
        <div className="panel">
          <h3>{content.title}</h3>
          <p>{content.description}</p>
        </div>
      </div>
    );
  }

  function renderActiveTab() {
    const experienceTabs: ReadonlyArray<TabName> = [
      "Resume",
      "Technical Skills",
      "Certifications",
      "Contact Info",
    ];

    if (isGuestMode && !experienceTabs.includes(activeTab)) {
      return renderExperienceTab("Resume");
    }

    switch (activeTab) {
      case "Resume":
        return renderExperienceTab("Resume");
      case "Technical Skills":
        return renderExperienceTab("Technical Skills");
      case "Certifications":
        return renderExperienceTab("Certifications");
      case "Contact Info":
        return renderExperienceTab("Contact Info");
      case "Schedule":
        return renderCalendarTab();
      case "Requirements":
        return renderRequirementsTab();
      case "Tickets":
        return renderTicketsTab();
      case "Overview":
        return renderOverviewTab();
      case "Members":
        return renderMembersTab();
      case "Milestones":
        return renderMilestonesTab();
      case "Tasks":
        return renderTasksTab();
      case "Automation":
        return renderAutomationTab();
      case "Devices":
        return renderDevicesTab();
      case "Simulator":
        return renderSimulatorTab();
      case "Test Case Generation":
        return renderTestCaseTab();
      case "Learning":
        return renderLearningTab();
      default:
        return renderOverviewTab();
    }
  }

  if (isLoading) {
    return (
      <div className="app-shell" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", gap: "1rem" }}>
        <p>Loading data from Google Sheets...</p>
      </div>
    );
  }

  if (sheetError) {
    return (
      <div className="app-shell" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", gap: "1.5rem" }}>
        <p style={{ color: "var(--danger-color, #e53e3e)" }}>Error: {sheetError}</p>
        <button type="button" onClick={() => signIn().catch(console.error)}>
          Retry Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>Work</h1>
        </div>
        <div className="topbar-actions">
          {!isGuestMode ? (
            <select value={project} onChange={(event) => handleProjectChange(event.target.value as ProjectName)}>
              <option value="SunGuide">SunGuide</option>
              <option value="NG SELS">NG SELS</option>
            </select>
          ) : null}
          <button
            type="button"
            className="secondary"
            onClick={onBackToHub}
            title="Return to home page"
          >
            Back to Hub
          </button>
          <button type="button" className="secondary" onClick={handleSignOutClick} title="Sign out">
            Sign out
          </button>
        </div>
      </header>

      <nav className="nav-groups">
        <div className="tabs tabs-primary">
          {visibleNavSections.map((section) => (
            <button
              key={section.name}
              className={activeSection === section.name ? "active" : ""}
              onClick={() => selectSection(section.name)}
            >
              {section.name}
            </button>
          ))}
        </div>

        <div className="tabs tabs-secondary">
          {visibleNavSections
            .find((section) => section.name === activeSection)
            ?.tabs.map((tab) => (
              <button
                key={tab.key}
                className={activeTab === tab.key ? "active" : ""}
                onClick={() => selectTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
        </div>
      </nav>

      <main className="content">{renderActiveTab()}</main>
    </div>
  );
}

export default WorkApp;

