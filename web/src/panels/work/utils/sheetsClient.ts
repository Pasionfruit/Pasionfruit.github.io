import type {
  AssignmentItem,
  ChatExchange,
  Device,
  IngestedChunk,
  Requirement,
  SimulatorScenario,
  TeamActionItem,
  TeamMember,
  TestCase,
  Ticket,
} from "../types/domain";
import type { GroceryListItem, StorePriceEntry } from "../../cooking/types";

const SHEET_ID = import.meta.env.VITE_GOOGLE_SHEET_ID as string;
const API_BASE = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}`;

let getTokenFn: (() => string) | null = null;

export function setTokenGetter(fn: () => string): void {
  getTokenFn = fn;
}

function token(): string {
  if (!getTokenFn) throw new Error("Token getter not initialised — call setTokenGetter first");
  return getTokenFn();
}

async function apiRequest(method: string, path: string, body?: unknown): Promise<unknown> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sheets API ${res.status}: ${text}`);
  }

  // 204 No Content (clear endpoint returns this)
  if (res.status === 204) return null;
  return res.json();
}

// Reads rows from a tab, skipping the header row. Returns raw string[][]
async function readRows(tabName: string): Promise<string[][]> {
  const data = (await apiRequest(
    "GET",
    `/values/${encodeURIComponent(tabName)}`
  )) as { values?: string[][] };
  const rows = data.values ?? [];
  return rows.slice(1); // drop header row
}

// Clears a tab then writes headers + rows from A1
async function writeRows(tabName: string, headers: string[], rows: string[][]): Promise<void> {
  const encoded = encodeURIComponent(tabName);
  // Clear all existing content in the tab
  await apiRequest("POST", `/values/${encoded}:clear`, {});
  // Write headers + data starting at A1
  await apiRequest("PUT", `/values/${encoded}?valueInputOption=RAW`, {
    range: tabName,
    majorDimension: "ROWS",
    values: [headers, ...rows],
  });
}

// ---- Column ordering (must match Google Sheet header rows) ----

const COLS = {
  requirements:    ["id", "project", "requirement", "description", "functionBlock", "status", "relatedTestCases", "failedTestCases", "notes"],
  tickets:         ["id", "project", "ticket", "summary", "priority", "failureBuild", "fixedBuild", "status", "associatedTestCases", "resolutionNotes"],
  assignments:     ["id", "project", "date", "startDate", "dueDate", "teamMember", "taskName", "task", "status"],
  teamActions:     ["id", "project", "teamMember", "action", "dueDate", "status"],
  teamMembers:     ["id", "project", "name", "position", "pointOfContact"],
  devices:         ["id", "project", "name", "type", "status", "notes"],
  simulators:      ["id", "project", "name", "description", "status"],
  testCases:       ["id", "project", "title", "sourceType", "sourceId", "precondition", "steps", "expectedResult"],
  ingestedChunks:  ["id", "project", "sourceFile", "sourceType", "section", "text"],
  chatExchanges:   ["id", "project", "question", "answer", "sourceChunkIds", "createdAt"],
  groceryList:     ["id", "item", "type", "quantity", "store"],
  storePrices:     ["id", "item", "store", "price", "unitPrice"],
};

// ---- Serialisation helpers ----

function rowToObj(cols: string[], row: string[]): Record<string, string> {
  const obj: Record<string, string> = {};
  for (let i = 0; i < cols.length; i++) {
    obj[cols[i]] = row[i] ?? "";
  }
  return obj;
}

function objToRow(cols: string[], obj: Record<string, unknown>): string[] {
  return cols.map((col) => {
    const val = obj[col];
    if (Array.isArray(val)) return JSON.stringify(val);
    return String(val ?? "");
  });
}

// ---- Public API ----

export async function loadRequirements(): Promise<Requirement[]> {
  const rows = await readRows("requirements");
  return rows
    .filter((r) => r[0])
    .map((r) => rowToObj(COLS.requirements, r) as unknown as Requirement);
}

export async function saveRequirements(data: Requirement[]): Promise<void> {
  await writeRows(
    "requirements",
    COLS.requirements,
    data.map((r) => objToRow(COLS.requirements, r as unknown as Record<string, unknown>))
  );
}

export async function loadTickets(): Promise<Ticket[]> {
  const rows = await readRows("tickets");
  return rows
    .filter((r) => r[0])
    .map((r) => rowToObj(COLS.tickets, r) as unknown as Ticket);
}

export async function saveTickets(data: Ticket[]): Promise<void> {
  await writeRows(
    "tickets",
    COLS.tickets,
    data.map((r) => objToRow(COLS.tickets, r as unknown as Record<string, unknown>))
  );
}

export async function loadTestCases(): Promise<TestCase[]> {
  const rows = await readRows("testCases");
  return rows
    .filter((r) => r[0])
    .map((r) => rowToObj(COLS.testCases, r) as unknown as TestCase);
}

export async function saveTestCases(data: TestCase[]): Promise<void> {
  await writeRows(
    "testCases",
    COLS.testCases,
    data.map((r) => objToRow(COLS.testCases, r as unknown as Record<string, unknown>))
  );
}

export async function loadAssignments(): Promise<AssignmentItem[]> {
  const rows = await readRows("assignments");
  return rows
    .filter((r) => r[0])
    .map((r) => rowToObj(COLS.assignments, r) as unknown as AssignmentItem);
}

export async function saveAssignments(data: AssignmentItem[]): Promise<void> {
  await writeRows(
    "assignments",
    COLS.assignments,
    data.map((r) => objToRow(COLS.assignments, r as unknown as Record<string, unknown>))
  );
}

export async function loadTeamMembers(): Promise<TeamMember[]> {
  const rows = await readRows("teamMembers");
  return rows
    .filter((r) => r[0])
    .map((r) => rowToObj(COLS.teamMembers, r) as unknown as TeamMember);
}

export async function saveTeamMembers(data: TeamMember[]): Promise<void> {
  await writeRows(
    "teamMembers",
    COLS.teamMembers,
    data.map((r) => objToRow(COLS.teamMembers, r as unknown as Record<string, unknown>))
  );
}

export async function loadTeamActions(): Promise<TeamActionItem[]> {
  const rows = await readRows("teamActions");
  return rows
    .filter((r) => r[0])
    .map((r) => rowToObj(COLS.teamActions, r) as unknown as TeamActionItem);
}

export async function loadDevices(): Promise<Device[]> {
  const rows = await readRows("devices");
  return rows
    .filter((r) => r[0])
    .map((r) => rowToObj(COLS.devices, r) as unknown as Device);
}

export async function saveDevices(data: Device[]): Promise<void> {
  await writeRows(
    "devices",
    COLS.devices,
    data.map((r) => objToRow(COLS.devices, r as unknown as Record<string, unknown>))
  );
}

export async function loadSimulators(): Promise<SimulatorScenario[]> {
  const rows = await readRows("simulators");
  return rows
    .filter((r) => r[0])
    .map((r) => rowToObj(COLS.simulators, r) as unknown as SimulatorScenario);
}

export async function saveSimulators(data: SimulatorScenario[]): Promise<void> {
  await writeRows(
    "simulators",
    COLS.simulators,
    data.map((r) => objToRow(COLS.simulators, r as unknown as Record<string, unknown>))
  );
}

export async function loadChunks(): Promise<IngestedChunk[]> {
  const rows = await readRows("ingestedChunks");
  return rows
    .filter((r) => r[0])
    .map((r) => rowToObj(COLS.ingestedChunks, r) as unknown as IngestedChunk);
}

export async function saveChunks(data: IngestedChunk[]): Promise<void> {
  await writeRows(
    "ingestedChunks",
    COLS.ingestedChunks,
    data.map((r) => objToRow(COLS.ingestedChunks, r as unknown as Record<string, unknown>))
  );
}

export async function loadChats(): Promise<ChatExchange[]> {
  const rows = await readRows("chatExchanges");
  return rows
    .filter((r) => r[0])
    .map((r) => {
      const obj = rowToObj(COLS.chatExchanges, r);
      return {
        ...obj,
        sourceChunkIds: obj.sourceChunkIds ? (JSON.parse(obj.sourceChunkIds) as string[]) : [],
      } as unknown as ChatExchange;
    });
}

export async function saveChats(data: ChatExchange[]): Promise<void> {
  await writeRows(
    "chatExchanges",
    COLS.chatExchanges,
    data.map((r) => objToRow(COLS.chatExchanges, r as unknown as Record<string, unknown>))
  );
}

export async function loadGroceryList(): Promise<GroceryListItem[]> {
  const rows = await readRows("groceryList");
  return rows
    .filter((r) => r[0])
    .map((r) => rowToObj(COLS.groceryList, r) as unknown as GroceryListItem);
}

export async function saveGroceryList(data: GroceryListItem[]): Promise<void> {
  await writeRows(
    "groceryList",
    COLS.groceryList,
    data.map((r) => objToRow(COLS.groceryList, r as unknown as Record<string, unknown>))
  );
}

export async function loadStorePrices(): Promise<StorePriceEntry[]> {
  const rows = await readRows("storePrices");
  return rows
    .filter((r) => r[0])
    .map((r) => {
      const raw = rowToObj(COLS.storePrices, r);
      return {
        ...raw,
        price: Number(raw.price || 0),
        unitPrice: Number(raw.unitPrice || 0),
      } as StorePriceEntry;
    });
}

export async function saveStorePrices(data: StorePriceEntry[]): Promise<void> {
  await writeRows(
    "storePrices",
    COLS.storePrices,
    data.map((r) => objToRow(COLS.storePrices, r as unknown as Record<string, unknown>))
  );
}
