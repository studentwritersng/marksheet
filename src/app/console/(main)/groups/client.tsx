"use client";

import { useActionState, useState, useTransition } from "react";
import {
  createGroupAction,
  updateGroupAction,
  deleteGroupAction,
  addSchoolToGroupAction,
  removeSchoolFromGroupAction,
  createProprietorUserAction,
  toggleProprietorActiveAction,
  toggleGroupAddonAction,
  type GroupsActionResult,
} from "./actions";

interface SchoolOption { id: string; name: string; stage: string; }
interface AddonOption {
  id: string; name: string;
  basicPrice: number | null; standardPrice: number | null; premiumPrice: number | null;
}
interface GroupMembershipVM {
  id: string; schoolId: string; schoolName: string; schoolStage: string; schoolSuspended: boolean;
}
interface ProprietorVM {
  id: string; email: string; isActive: boolean; permissionLevel: string | null;
}
interface GroupAddonSubVM {
  id: string; addonId: string; addonName: string; status: string;
}
interface GroupVM {
  id: string;
  name: string;
  feeGroupStage: string | null;
  createdAt: string;
  memberships: GroupMembershipVM[];
  proprietors: ProprietorVM[];
  addonSubscriptions: GroupAddonSubVM[];
}

function formatPrice(n: number | null) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(n);
}

const STAGE_LABELS: Record<string, string> = {
  basic: "Basic",
  standard: "Standard",
  premium: "Premium",
};

const STAGE_COLORS: Record<string, string> = {
  basic: "bg-slate-800/30 text-slate-400",
  standard: "bg-indigo-900/30 text-indigo-400",
  premium: "bg-amber-900/30 text-amber-400",
};

// ── Create Group Form ────────────────────────────────────────────────────────

function CreateGroupForm({ addons }: { addons: AddonOption[] }) {
  const [state, action, pending] = useActionState<GroupsActionResult, FormData>(createGroupAction, {});

  return (
    <form action={action} className="bg-white/5 border border-white/10 rounded-xl p-5 space-y-3">
      <div>
        <label className="text-xs text-white/50 block mb-1">Group name</label>
        <input name="name" required placeholder='e.g. "XYZ Group of Schools"' className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white placeholder:text-white/20" />
      </div>
      <div>
        <label className="text-xs text-white/50 block mb-1">Pricing tier</label>
        <select name="feeGroupStage" defaultValue="" className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-sm text-white">
          <option value="">— Use each school's own tier —</option>
          <option value="basic">Basic</option>
          <option value="standard">Standard</option>
          <option value="premium">Premium</option>
        </select>
        <p className="text-[10px] text-white/40 mt-1">
          When set, all member schools will use this tier's pricing for licenses and addons.
        </p>
      </div>
      <button type="submit" disabled={pending} className="bg-emerald-700 hover:bg-emerald-600 text-white text-sm px-4 py-2 rounded-lg disabled:opacity-60">
        {pending ? "..." : "Create Group"}
      </button>
      {state.error && <p className="text-red-400 text-xs">{state.error}</p>}
      {state.success && <p className="text-emerald-400 text-xs">{state.success}</p>}
    </form>
  );
}

// ── Per-Group Panel ──────────────────────────────────────────────────────────

function GroupPanel({ g, availableSchools, addons }: { g: GroupVM; availableSchools: SchoolOption[]; addons: AddonOption[] }) {
  const [editOpen, setEditOpen] = useState(false);
  const [addSchoolOpen, setAddSchoolOpen] = useState(false);
  const [addPropOpen, setAddPropOpen] = useState(false);
  const [delPending, startDel] = useTransition();
  const [delMessage, setDelMessage] = useState<{ error?: string; success?: string }>({});

  function handleDelete() {
    if (!confirm(`Delete group "${g.name}"? This cannot be undone.`)) return;
    startDel(async () => {
      const res = await deleteGroupAction(g.id);
      setDelMessage(res);
    });
  }

  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-white font-semibold text-lg">{g.name}</h2>
          <p className="text-xs text-white/40 mt-0.5">
            Created {new Date(g.createdAt).toLocaleDateString()}
          </p>
          {g.feeGroupStage && (
            <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-900/30 text-indigo-300 text-[10px] uppercase tracking-wider font-semibold">
              <span className="material-symbols-outlined text-[12px]">payments</span>
              Pricing tier: {STAGE_LABELS[g.feeGroupStage]}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setEditOpen(!editOpen)} className="text-[11px] text-white/40 hover:text-white/70 underline">
            {editOpen ? "Close" : "Edit"}
          </button>
          <button onClick={handleDelete} disabled={delPending} className="text-[11px] text-red-400 hover:text-red-300 underline disabled:opacity-50">
            {delPending ? "..." : "Delete"}
          </button>
        </div>
      </div>

      {delMessage.error && <p className="text-red-400 text-xs">{delMessage.error}</p>}
      {delMessage.success && <p className="text-emerald-400 text-xs">{delMessage.success}</p>}

      {editOpen && <EditGroupForm g={g} />}

      {/* Schools */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs text-white/50 uppercase tracking-wider font-semibold">
            Member schools ({g.memberships.length})
          </h3>
          <button onClick={() => setAddSchoolOpen(!addSchoolOpen)} className="text-[10px] text-white/40 hover:text-white/70 underline">
            {addSchoolOpen ? "Cancel" : "+ Add school"}
          </button>
        </div>
        {g.memberships.length === 0 ? (
          <p className="text-xs text-white/30 italic py-2">No schools added yet.</p>
        ) : (
          <ul className="space-y-1">
            {g.memberships.map((m) => (
              <SchoolRow key={m.id} m={m} />
            ))}
          </ul>
        )}
        {addSchoolOpen && <AddSchoolForm groupId={g.id} availableSchools={availableSchools} />}
      </div>

      {/* Proprietors */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs text-white/50 uppercase tracking-wider font-semibold">
            Proprietor accounts ({g.proprietors.length})
          </h3>
          <button onClick={() => setAddPropOpen(!addPropOpen)} className="text-[10px] text-white/40 hover:text-white/70 underline">
            {addPropOpen ? "Cancel" : "+ Create proprietor"}
          </button>
        </div>
        {g.proprietors.length === 0 ? (
          <p className="text-xs text-white/30 italic py-2">No proprietor accounts yet. Create one so the proprietor can log in.</p>
        ) : (
          <ul className="space-y-1">
            {g.proprietors.map((p) => (
              <ProprietorRow key={p.id} p={p} />
            ))}
          </ul>
        )}
        {addPropOpen && <CreateProprietorForm groupId={g.id} />}
      </div>

      {/* Group Addons */}
      <div>
        <h3 className="text-xs text-white/50 uppercase tracking-wider font-semibold mb-2">
          Group-level addons
        </h3>
        {addons.length === 0 ? (
          <p className="text-xs text-white/30 italic">No addons available.</p>
        ) : (
          <ul className="space-y-1">
            {addons.map((a) => {
              const sub = g.addonSubscriptions.find((s) => s.addonId === a.id);
              return (
                <GroupAddonRow key={a.id} gId={g.id} a={a} sub={sub} feeGroupStage={g.feeGroupStage} />
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── School Row (with remove button) ──────────────────────────────────────────

function SchoolRow({ m }: { m: GroupMembershipVM }) {
  const [pending, start] = useTransition();
  function handleRemove() {
    if (!confirm(`Remove ${m.schoolName} from this group?`)) return;
    start(() => { void removeSchoolFromGroupAction(m.id); });
  }
  return (
    <li className="flex items-center justify-between bg-white/5 rounded p-2 text-xs">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-[14px] text-white/40">domain</span>
        <span className="text-white">{m.schoolName}</span>
        <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded ${STAGE_COLORS[m.schoolStage] ?? ""}`}>
          {STAGE_LABELS[m.schoolStage] ?? m.schoolStage}
        </span>
        {m.schoolSuspended && (
          <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-900/30 text-red-300">
            Suspended
          </span>
        )}
      </div>
      <button onClick={handleRemove} disabled={pending} className="text-[10px] text-white/30 hover:text-red-400 underline disabled:opacity-50">
        {pending ? "..." : "Remove"}
      </button>
    </li>
  );
}

// ── Proprietor Row (with toggle button) ──────────────────────────────────────

function ProprietorRow({ p }: { p: ProprietorVM }) {
  const [pending, start] = useTransition();
  function handleToggle() {
    start(() => { void toggleProprietorActiveAction(p.id, !p.isActive); });
  }
  return (
    <li className="flex items-center justify-between bg-white/5 rounded p-2 text-xs">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-[14px] text-white/40">person</span>
        <span className="text-white">{p.email}</span>
        <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded ${p.permissionLevel === "full" ? "bg-emerald-900/30 text-emerald-300" : "bg-slate-800 text-slate-300"}`}>
          {p.permissionLevel}
        </span>
        {!p.isActive && <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-900/30 text-red-300">Inactive</span>}
      </div>
      <button onClick={handleToggle} disabled={pending} className="text-[10px] text-white/30 hover:text-white/70 underline disabled:opacity-50">
        {pending ? "..." : (p.isActive ? "Deactivate" : "Activate")}
      </button>
    </li>
  );
}

// ── Group Addon Row (with toggle button) ──────────────────────────────────────

function GroupAddonRow({ gId, a, sub, feeGroupStage }: { gId: string; a: AddonOption; sub: GroupAddonSubVM | undefined; feeGroupStage: string | null }) {
  const [pending, start] = useTransition();
  const isActive = sub?.status === "active";
  const stage = feeGroupStage as "basic" | "standard" | "premium" | null;
  const price = stage === "basic" ? a.basicPrice : stage === "standard" ? a.standardPrice : stage === "premium" ? a.premiumPrice : null;
  function handleToggle() {
    start(() => {
      const fd = new FormData();
      fd.set("groupId", gId);
      fd.set("addonId", a.id);
      fd.set("activate", isActive ? "0" : "1");
      void toggleGroupAddonAction({} as GroupsActionResult, fd);
    });
  }
  return (
    <li className="flex items-center justify-between bg-white/5 rounded p-2 text-xs">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-[14px] text-white/40">{isActive ? "check_circle" : "radio_button_unchecked"}</span>
        <span className={`text-white ${isActive ? "" : "opacity-50"}`}>{a.name}</span>
        {isActive && (
          <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-900/30 text-emerald-300">
            Active{feeGroupStage ? ` @ ${formatPrice(price)}` : ""}
          </span>
        )}
      </div>
      <button onClick={handleToggle} disabled={pending} className={`text-[10px] underline disabled:opacity-50 ${isActive ? "text-red-400 hover:text-red-300" : "text-emerald-400 hover:text-emerald-300"}`}>
        {pending ? "..." : (isActive ? "Suspend" : "Activate")}
      </button>
    </li>
  );
}

// ── Edit Group Form ──────────────────────────────────────────────────────────

function EditGroupForm({ g }: { g: GroupVM }) {
  const [state, action, pending] = useActionState<GroupsActionResult, FormData>(updateGroupAction, {});
  return (
    <form action={action} className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-2">
      <input type="hidden" name="groupId" value={g.id} />
      <div>
        <label className="text-[10px] text-white/50 block mb-0.5">Name</label>
        <input name="name" defaultValue={g.name} required className="w-full bg-white/5 border border-white/10 rounded p-1.5 text-xs text-white" />
      </div>
      <div>
        <label className="text-[10px] text-white/50 block mb-0.5">Pricing tier</label>
        <select name="feeGroupStage" defaultValue={g.feeGroupStage ?? ""} className="w-full bg-white/5 border border-white/10 rounded p-1.5 text-xs text-white">
          <option value="">— No override —</option>
          <option value="basic">Basic</option>
          <option value="standard">Standard</option>
          <option value="premium">Premium</option>
        </select>
      </div>
      <button type="submit" disabled={pending} className="bg-emerald-700 hover:bg-emerald-600 text-white text-xs px-3 py-1.5 rounded disabled:opacity-60">
        {pending ? "..." : "Save"}
      </button>
      {state.error && <p className="text-red-400 text-[10px]">{state.error}</p>}
      {state.success && <p className="text-emerald-400 text-[10px]">{state.success}</p>}
    </form>
  );
}

// ── Add School to Group Form ─────────────────────────────────────────────────

function AddSchoolForm({ groupId, availableSchools }: { groupId: string; availableSchools: SchoolOption[] }) {
  const [state, action, pending] = useActionState<GroupsActionResult, FormData>(addSchoolToGroupAction, {});
  return (
    <form action={action} className="bg-white/5 border border-white/10 rounded-lg p-3 mt-2 space-y-2">
      <input type="hidden" name="groupId" value={groupId} />
      <select name="schoolId" required className="w-full bg-white/5 border border-white/10 rounded p-1.5 text-xs text-white">
        <option value="">— Select a school —</option>
        {availableSchools.map((s) => (
          <option key={s.id} value={s.id}>{s.name} ({STAGE_LABELS[s.stage]})</option>
        ))}
      </select>
      <button type="submit" disabled={pending} className="bg-emerald-700 hover:bg-emerald-600 text-white text-xs px-3 py-1.5 rounded disabled:opacity-60">
        {pending ? "..." : "Add"}
      </button>
      {state.error && <p className="text-red-400 text-[10px]">{state.error}</p>}
      {state.success && <p className="text-emerald-400 text-[10px]">{state.success}</p>}
    </form>
  );
}

// ── Create Proprietor Form ───────────────────────────────────────────────────

function CreateProprietorForm({ groupId }: { groupId: string }) {
  const [state, action, pending] = useActionState<GroupsActionResult, FormData>(createProprietorUserAction, {});
  return (
    <form action={action} className="bg-white/5 border border-white/10 rounded-lg p-3 mt-2 space-y-2">
      <input type="hidden" name="groupId" value={groupId} />
      <div className="grid grid-cols-2 gap-2">
        <input name="fullName" placeholder="Full name" required className="bg-white/5 border border-white/10 rounded p-1.5 text-xs text-white placeholder:text-white/20" />
        <input name="email" type="email" placeholder="Email (used to login)" required className="bg-white/5 border border-white/10 rounded p-1.5 text-xs text-white placeholder:text-white/20" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input name="password" type="password" placeholder="Initial password (min 8 chars)" required minLength={8} className="bg-white/5 border border-white/10 rounded p-1.5 text-xs text-white placeholder:text-white/20" />
        <select name="permissionLevel" required defaultValue="view_only" className="bg-white/5 border border-white/10 rounded p-1.5 text-xs text-white">
          <option value="view_only">View-only (read-only dashboard)</option>
          <option value="full">Full (can initiate transfers & view all)</option>
        </select>
      </div>
      <button type="submit" disabled={pending} className="bg-emerald-700 hover:bg-emerald-600 text-white text-xs px-3 py-1.5 rounded disabled:opacity-60">
        {pending ? "..." : "Create Proprietor Account"}
      </button>
      {state.error && <p className="text-red-400 text-[10px]">{state.error}</p>}
      {state.success && <p className="text-emerald-400 text-[10px]">{state.success}</p>}
    </form>
  );
}

// ── Main Client ──────────────────────────────────────────────────────────────

export function GroupsClient({
  groups,
  availableSchools,
  addons,
}: {
  groups: GroupVM[];
  availableSchools: SchoolOption[];
  addons: AddonOption[];
}) {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">School Groups</h1>
          <p className="text-sm text-white/40 mt-1">
            Group school branches under a proprietor. Multi-Branch is activated at the group level.
          </p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="text-xs text-white/70 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/30">
          {showCreate ? "Cancel" : "New Group"}
        </button>
      </div>

      {showCreate && (
        <CreateGroupForm addons={addons} />
      )}

      {groups.length === 0 && !showCreate && (
        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-8 text-center">
          <span className="material-symbols-outlined text-[48px] text-white/20">workspaces</span>
          <p className="text-sm text-white/40 mt-3">No school groups yet. Create your first group to start activating the Multi-Branch addon.</p>
        </div>
      )}

      <div className="space-y-4">
        {groups.map((g) => (
          <GroupPanel key={g.id} g={g} availableSchools={availableSchools} addons={addons} />
        ))}
      </div>
    </div>
  );
}
