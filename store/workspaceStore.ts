import { create } from "zustand";
import { acceptInvites, createWorkspace, listMyWorkspaces } from "@/lib/workspace/queries";
import type { Workspace } from "@/lib/workspace/schema";

/** Active-workspace context (Task 07). The active workspace is a client-side *filter*; access is
 *  always enforced by RLS membership server-side (never trust a client-supplied workspaceId for
 *  access). In the public demo (no auth) there are no workspaces and activeWorkspaceId stays null,
 *  so queries read null-workspace demo rows exactly as before. Kept in memory (no localStorage). */

interface WorkspaceState {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  loaded: boolean;
  hydrate: () => Promise<void>;
  setActive: (id: string | null) => void;
  create: (name: string) => Promise<Workspace | null>;
  activeWorkspace: () => Workspace | null;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  activeWorkspaceId: null,
  loaded: false,

  hydrate: async () => {
    // Claim any pending invites for this user, then load the workspaces they belong to.
    await acceptInvites().catch(() => 0);
    const workspaces = await listMyWorkspaces();
    set((s) => ({
      workspaces,
      loaded: true,
      activeWorkspaceId:
        s.activeWorkspaceId && workspaces.some((w) => w.id === s.activeWorkspaceId)
          ? s.activeWorkspaceId
          : workspaces[0]?.id ?? null,
    }));
  },

  setActive: (id) => set({ activeWorkspaceId: id }),

  create: async (name) => {
    const ws = await createWorkspace(name);
    if (ws) set((s) => ({ workspaces: [ws, ...s.workspaces], activeWorkspaceId: ws.id }));
    return ws;
  },

  activeWorkspace: () => {
    const { workspaces, activeWorkspaceId } = get();
    return workspaces.find((w) => w.id === activeWorkspaceId) ?? null;
  },
}));
