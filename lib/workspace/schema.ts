import { z } from "zod";

/** Workspaces (Task 07) — the unit of ownership and access. Every ownable record belongs to a
 *  workspace; access is by *membership at sufficient role*, enforced by RLS. The same product now
 *  serves a solo builder (a personal workspace) and a company (members, roles, shared libraries).
 *  Config-gated like auth — the public demo runs null-workspace and is unaffected. */

export const WORKSPACE_ROLES = ["owner", "admin", "member", "viewer"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

/** Role precedence for client-side gating (RLS is the real boundary). */
export const ROLE_RANK: Record<WorkspaceRole, number> = { owner: 3, admin: 2, member: 1, viewer: 0 };

export function roleAtLeast(role: WorkspaceRole | undefined, min: WorkspaceRole): boolean {
  return role != null && ROLE_RANK[role] >= ROLE_RANK[min];
}

export const ROLE_COPY: Record<WorkspaceRole, string> = {
  owner: "Full control, including deleting the workspace.",
  admin: "Manage members and all content.",
  member: "Create and edit content.",
  viewer: "Read-only — can view and run, not edit.",
};

export const workspaceSchema = z.object({
  id: z.string(),
  name: z.string().default("Workspace"),
  slug: z.string().optional(),
  plan: z.string().optional(),
  /** the caller's role in this workspace (derived from membership; not a column) */
  role: z.enum(WORKSPACE_ROLES).optional(),
  createdAt: z.string().default(() => new Date().toISOString()),
});
export type Workspace = z.infer<typeof workspaceSchema>;

export const membershipSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  userId: z.string().nullable().default(null),
  role: z.enum(WORKSPACE_ROLES).default("member"),
  invitedEmail: z.string().nullish(),
  status: z.enum(["active", "invited"]).default("active"),
  /** joined display fields (best-effort) */
  email: z.string().nullish(),
  displayName: z.string().nullish(),
  createdAt: z.string().default(() => new Date().toISOString()),
});
export type Membership = z.infer<typeof membershipSchema>;
