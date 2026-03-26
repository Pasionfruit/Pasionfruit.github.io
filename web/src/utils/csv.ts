import { Ticket, TicketPriority, TicketStatus } from "../types/domain";

interface RawRow {
  [key: string]: unknown;
}

function normalizeKeyMap(row: RawRow): Record<string, string> {
  const keys = Object.keys(row);
  const map: Record<string, string> = {};
  for (const key of keys) {
    map[key.toLowerCase().trim()] = key;
  }
  return map;
}

function pick(row: RawRow, map: Record<string, string>, ...candidates: string[]): string {
  for (const candidate of candidates) {
    const original = map[candidate.toLowerCase()];
    if (original) {
      const value = row[original];
      return value === undefined || value === null ? "" : String(value).trim();
    }
  }
  return "";
}

function normalizeStatus(input: string): TicketStatus {
  const value = input.toLowerCase();
  if (value.includes("progress")) {
    return "In Progress";
  }
  if (value.includes("done") || value.includes("closed") || value.includes("resolved")) {
    return "Done";
  }
  if (value.includes("block")) {
    return "Blocked";
  }
  return "Open";
}

function normalizePriority(input: string): TicketPriority {
  const value = input.toLowerCase();
  if (value.includes("critical") || value.includes("highest") || value.includes("p1")) {
    return "Critical";
  }
  if (value.includes("high") || value.includes("p2")) {
    return "High";
  }
  if (value.includes("medium") || value.includes("normal") || value.includes("p3")) {
    return "Medium";
  }
  return "Low";
}

export function mapRowToTicket(row: RawRow, project: "SunGuide" | "NG SELS"): Omit<Ticket, "id"> | null {
  const map = normalizeKeyMap(row);
  const ticket = pick(row, map, "ticket", "ticket key", "issue key", "key");
  const summary = pick(row, map, "summary", "title");

  if (!ticket || !summary) {
    return null;
  }

  return {
    project,
    ticket,
    summary,
    priority: normalizePriority(pick(row, map, "priority", "severity")),
    failureBuild: pick(row, map, "failure build", "failing build", "failed build"),
    fixedBuild: pick(row, map, "fixed build", "fix build", "resolved build"),
    status: normalizeStatus(pick(row, map, "status", "state")),
    associatedTestCases: pick(row, map, "associated test cases", "associated testcases", "test cases", "testcases"),
    resolutionNotes: pick(row, map, "resolution notes", "notes", "resolution"),
  };
}
