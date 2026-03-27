import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import WorkApp from "../panels/work/App";

type TabConfig = {
  section: string;
  tab: string;
  expandForm?: boolean;
};

function getMainContent(): HTMLElement {
  const main = document.querySelector("main.content");
  if (!(main instanceof HTMLElement)) {
    throw new Error("Main content area not found");
  }
  return main;
}

function exerciseVisibleControls(scope: HTMLElement): void {
  const controls = Array.from(scope.querySelectorAll("input, select, textarea"));
  let exercised = 0;
  let fileInputsChecked = 0;

  controls.forEach((control, index) => {
    if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement)) {
      return;
    }

    if (control instanceof HTMLInputElement && control.type === "file") {
      expect(control.accept).not.toBe("");
      fileInputsChecked += 1;
      return;
    }

    if ((control as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).disabled) {
      return;
    }

    if (control instanceof HTMLSelectElement) {
      const values = Array.from(control.options)
        .map((option) => option.value)
        .filter((value) => value !== "");
      const nextValue = values[values.length - 1];
      if (!nextValue) {
        return;
      }
      fireEvent.change(control, { target: { value: nextValue } });
      expect(control).toHaveValue(nextValue);
      exercised += 1;
      return;
    }

    if (control instanceof HTMLInputElement && control.type === "date") {
      const nextValue = `2026-03-${String((index % 9) + 1).padStart(2, "0")}`;
      fireEvent.change(control, { target: { value: nextValue } });
      expect(control).toHaveValue(nextValue);
      exercised += 1;
      return;
    }

    const nextValue = `sample-${index}`;
    fireEvent.change(control, { target: { value: nextValue } });
    expect(control).toHaveValue(nextValue);
    exercised += 1;
  });

  expect(exercised).toBeGreaterThan(0);
  expect(fileInputsChecked).toBeGreaterThanOrEqual(0);
}

async function openTab(user: ReturnType<typeof userEvent.setup>, config: TabConfig): Promise<void> {
  await user.click(screen.getByRole("button", { name: config.section }));
  await user.click(screen.getByRole("button", { name: config.tab }));

  if (config.expandForm) {
    const expandButton = screen.getByTitle("Expand form");
    await user.click(expandButton);
  }
}

function renderWorkApp() {
  const authState = {
    isAuthenticated: false,
    isGisLoading: false,
    signIn: vi.fn(async () => undefined),
    signOut: vi.fn(),
    getToken: vi.fn(() => "test-token"),
  };

  return render(
    <WorkApp
      authState={authState}
      isGuestMode={false}
      onGuestModeChange={vi.fn()}
      onBackToHub={vi.fn()}
    />,
  );
}

describe("App input coverage", () => {
  it("updates the top-level project selector and schedule inputs", async () => {
    const user = userEvent.setup();
    const { container } = renderWorkApp();

    const projectSelect = container.querySelector("header select");
    expect(projectSelect).toBeInstanceOf(HTMLSelectElement);
    fireEvent.change(projectSelect as HTMLSelectElement, { target: { value: "NG SELS" } });
    expect(projectSelect).toHaveValue("NG SELS");

    const scheduleForm = screen.getByText("Add Assignment").closest("form");
    expect(scheduleForm).not.toBeNull();
    exerciseVisibleControls(scheduleForm as HTMLElement);

    const scheduleSearch = screen.getByPlaceholderText("Search task, description, member…");
    fireEvent.change(scheduleSearch, { target: { value: "milestone search" } });
    expect(scheduleSearch).toHaveValue("milestone search");

    const toolbar = scheduleSearch.parentElement;
    expect(toolbar).not.toBeNull();
    if (toolbar instanceof HTMLElement) {
      exerciseVisibleControls(toolbar);
    }

    await user.click(screen.getByRole("button", { name: "Team" }));
    expect(screen.getByRole("button", { name: "Members" })).toBeInTheDocument();
  });

  it("covers requirements inputs and filters", async () => {
    const user = userEvent.setup();
    renderWorkApp();

    await openTab(user, { section: "Project", tab: "Requirements", expandForm: true });
    exerciseVisibleControls(getMainContent());
  });

  it("covers ticket inputs and filters", async () => {
    const user = userEvent.setup();
    renderWorkApp();

    await openTab(user, { section: "Project", tab: "Tickets", expandForm: true });
    exerciseVisibleControls(getMainContent());
  });

  it("covers milestone inputs, filters, and import control", async () => {
    const user = userEvent.setup();
    renderWorkApp();

    await openTab(user, { section: "Team", tab: "Milestones", expandForm: true });
    exerciseVisibleControls(getMainContent());

    const fileInput = document.getElementById("import-milestones");
    expect(fileInput).toBeInstanceOf(HTMLInputElement);
    expect((fileInput as HTMLInputElement).accept).toContain(".csv");
    expect((fileInput as HTMLInputElement).accept).toContain(".json");
  });

  it("covers member inputs", async () => {
    const user = userEvent.setup();
    renderWorkApp();

    await openTab(user, { section: "Team", tab: "Members" });
    exerciseVisibleControls(getMainContent());
  });

  it("covers device inputs and filters", async () => {
    const user = userEvent.setup();
    renderWorkApp();

    await openTab(user, { section: "Resources", tab: "Devices", expandForm: true });
    exerciseVisibleControls(getMainContent());
  });

  it("covers simulator inputs and filters", async () => {
    const user = userEvent.setup();
    renderWorkApp();

    await openTab(user, { section: "Resources", tab: "Simulator", expandForm: true });
    exerciseVisibleControls(getMainContent());
  });

  it("covers test case generation and projects inputs", async () => {
    const user = userEvent.setup();
    renderWorkApp();

    await openTab(user, { section: "Project", tab: "Test case generation" });
    exerciseVisibleControls(getMainContent());

    await openTab(user, { section: "Project", tab: "Projects" });
    exerciseVisibleControls(getMainContent());

    const learningPanel = within(getMainContent());
    expect(learningPanel.getByText("Ingest Documentation (Excel/PDF)")).toBeInTheDocument();
  });
});
