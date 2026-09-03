import Link from "next/link";
import { prisma } from "@/lib/db";
import { Panel } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/empty-state";
import { createTask, deleteTask } from "@/server/actions/tasks";
import { KanbanBoard, type BoardTask } from "./kanban-board";

const TASK_TYPES = ["recon", "exploitation", "finding_writeup", "retest", "report_section"] as const;

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const { project: projectId } = await searchParams;

  if (!projectId) {
    const projects = await prisma.project.findMany({ orderBy: { code: "asc" }, include: { application: true } });
    return (
      <div className="space-y-4">
        <h1 className="font-display text-xl font-semibold">Tasks</h1>
        {projects.length === 0 ? (
          <EmptyState message="Tasks live inside an engagement." />
        ) : (
          <Panel title="Pick an engagement">
            <ul className="grid grid-cols-2 gap-2">
              {projects.map((p) => (
                <li key={p.id}>
                  <Link href={`/tasks?project=${p.id}`} className="block rounded-sm border border-line-subtle px-3 py-2 hover:bg-hover">
                    <span className="font-mono text-xs">{p.code}</span>{" "}
                    <span className="text-sm">{p.application.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    );
  }

  const project = await prisma.project.findUnique({ where: { id: projectId }, include: { application: true } });
  if (!project) notFoundFallback();

  const [tasks, users] = await Promise.all([
    prisma.task.findMany({
      where: { projectId },
      orderBy: [{ status: "asc" }, { order: "asc" }],
      include: { assignee: { select: { name: true } } },
    }),
    prisma.user.findMany({ orderBy: { name: "asc" } }),
  ]);

  const grouped = tasks.reduce<Record<string, BoardTask[]>>((acc, t) => {
    (acc[t.status] ??= []).push({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      taskType: t.taskType,
      assigneeName: t.assignee?.name,
      dueDate: t.dueDate,
    });
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold">
          Tasks — <span className="font-mono text-fg-muted">{project.code}</span> {project.application.name}
        </h1>
        <Link href="/tasks" className="btn btn-secondary">
          All engagements
        </Link>
      </div>

      <KanbanBoard tasks={grouped} />

      {/* quick add */}
      <Panel title="New Task">
        <form action={createTask} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="projectId" value={projectId} />
          <div className="flex-1 min-w-[16rem]">
            <label className="label" htmlFor="title">
              Title *
            </label>
            <input id="title" name="title" required className="input" />
          </div>
          <div className="w-44">
            <label className="label" htmlFor="taskType">
              Type
            </label>
            <select id="taskType" name="taskType" className="input" defaultValue="">
              <option value="">—</option>
              {TASK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>
          <div className="w-44">
            <label className="label" htmlFor="assigneeId">
              Assignee
            </label>
            <select id="assigneeId" name="assigneeId" className="input" defaultValue="">
              <option value="">—</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="dueDate">
              Due
            </label>
            <input id="dueDate" name="dueDate" type="date" className="input" />
          </div>
          <button className="btn btn-primary">Add</button>
        </form>
      </Panel>

      {/* delete stray cards without opening them */}
      {tasks.length > 0 && (
        <details>
          <summary className="cursor-pointer text-xs text-fg-muted hover:text-fg-secondary">
            Manage ({tasks.length})
          </summary>
          <ul className="mt-2 space-y-1 text-xs">
            {tasks.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2">
                <span className="text-fg-secondary">
                  [{t.status}] {t.title}
                </span>
                <form action={deleteTask}>
                  <input type="hidden" name="id" value={t.id} />
                  <button className="text-signal hover:text-signal">delete</button>
                </form>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function notFoundFallback(): never {
  throw new Error("Engagement not found");
}
