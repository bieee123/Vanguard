import { updateApplication, createApplication, deleteApplication } from "@/server/actions/applications";
import type { Application } from "@prisma/client";

const CRITICALITIES = ["critical", "high", "medium", "low"] as const;

export function ApplicationForm({ application }: { application?: Application }) {
  const isEdit = Boolean(application);
  return (
    <form action={isEdit ? updateApplication : createApplication} className="space-y-3 max-w-xl">
      {application && <input type="hidden" name="id" value={application.id} />}
      <div>
        <label className="label" htmlFor="name">
          Name *
        </label>
        <input id="name" name="name" required className="input" defaultValue={application?.name} />
      </div>
      <div>
        <label className="label" htmlFor="description">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          className="input"
          defaultValue={application?.description ?? ""}
        />
      </div>
      <div>
        <label className="label" htmlFor="repoUrl">
          Repository URL
        </label>
        <input
          id="repoUrl"
          name="repoUrl"
          className="input font-mono"
          placeholder="https://github.com/org/repo"
          defaultValue={application?.repoUrl ?? ""}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="criticality">
            Criticality
          </label>
          <select
            id="criticality"
            name="criticality"
            className="input"
            defaultValue={application?.criticality ?? "medium"}
          >
            {CRITICALITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="owningTeam">
            Owning team
          </label>
          <input
            id="owningTeam"
            name="owningTeam"
            className="input"
            defaultValue={application?.owningTeam ?? ""}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button className="btn btn-primary">{isEdit ? "Save changes" : "Create Application"}</button>
      </div>
    </form>
  );
}

export function DeleteApplicationButton({ id }: { id: string }) {
  return (
    <form action={deleteApplication}>
      <input type="hidden" name="id" value={id} />
      <button className="btn btn-danger">Delete</button>
    </form>
  );
}
