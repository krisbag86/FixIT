import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ScheduleTask, User } from "@/lib/types";

vi.mock("server-only", () => ({}));

const admin: User = {
  id: "usr_admin",
  name: "Admin",
  email: "admin@bagietka.pl",
  role: "ADMIN",
  isActive: true,
  isScheduleMember: true
};

const agent: User = {
  ...admin,
  id: "usr_agent",
  name: "Agent",
  email: "agent@bagietka.pl",
  role: "AGENT"
};

const task: ScheduleTask = {
  id: "schedule-task-1",
  date: "2026-08-10",
  title: "Sprawdzenie backupu",
  isCompleted: false,
  assigneeId: agent.id,
  createdById: admin.id,
  updatedById: admin.id,
  createdAt: "2026-08-10T08:00:00.000Z",
  updatedAt: "2026-08-10T08:00:00.000Z"
};

describe("schedule actions", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("@/lib/auth");
    vi.doUnmock("@/lib/data-store");
    vi.doUnmock("next/cache");
  });

  function installMocks(user: User, foundTask: ScheduleTask = task) {
    const createScheduleTask = vi.fn(async () => foundTask);
    const toggleScheduleTask = vi.fn(async () => ({ ...foundTask, isCompleted: true }));
    const mocks = {
      copyPreviousScheduleWeek: vi.fn(),
      createScheduleTask,
      deleteScheduleTask: vi.fn(async () => true),
      findScheduleTask: vi.fn(async () => foundTask),
      setScheduleDuty: vi.fn(),
      toggleScheduleTask,
      updateScheduleTask: vi.fn(async () => foundTask)
    };
    vi.doMock("@/lib/auth", () => ({ requireUser: vi.fn(async () => user) }));
    vi.doMock("@/lib/data-store", () => mocks);
    vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }));
    return mocks;
  }

  it("allows an administrator to create a sanitized task", async () => {
    const mocks = installMocks(admin);
    const { createScheduleTaskAction } = await import("@/app/admin/schedule/actions");
    const formData = new FormData();
    formData.set("date", "2026-08-10");
    formData.set("assigneeId", agent.id);
    formData.set("title", "  <b>Sprawdzenie backupu</b>  ");

    await createScheduleTaskAction(formData);

    expect(mocks.createScheduleTask).toHaveBeenCalledWith({
      date: "2026-08-10",
      assigneeId: agent.id,
      title: "Sprawdzenie backupu",
      description: undefined,
      actorId: admin.id
    });
  });

  it("blocks agents from creating tasks", async () => {
    const mocks = installMocks(agent);
    const { createScheduleTaskAction } = await import("@/app/admin/schedule/actions");
    const formData = new FormData();
    formData.set("date", "2026-08-10");
    formData.set("assigneeId", agent.id);
    formData.set("title", "Sprawdzenie backupu");

    await expect(createScheduleTaskAction(formData)).rejects.toThrow("Brak uprawnień do grafiku.");
    expect(mocks.createScheduleTask).not.toHaveBeenCalled();
  });

  it("allows an agent to complete only their own task", async () => {
    const ownMocks = installMocks(agent);
    const { toggleScheduleTaskAction } = await import("@/app/admin/schedule/actions");
    const formData = new FormData();
    formData.set("id", task.id);

    await toggleScheduleTaskAction(formData);
    expect(ownMocks.toggleScheduleTask).toHaveBeenCalledWith({ id: task.id, actorId: agent.id });

    vi.resetModules();
    const otherTask = { ...task, assigneeId: "usr_other" };
    const otherMocks = installMocks(agent, otherTask);
    const actions = await import("@/app/admin/schedule/actions");
    await expect(actions.toggleScheduleTaskAction(formData)).rejects.toThrow("Możesz oznaczać tylko własne zadania.");
    expect(otherMocks.toggleScheduleTask).not.toHaveBeenCalled();
  });
});
