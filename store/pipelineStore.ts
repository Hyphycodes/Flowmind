import { create } from "zustand";
import {
  pipelineSchema,
  type AgentRunTrace,
  type FinalOutput,
  type HandoffPacket,
  type NodeStatus,
  type OutputTable,
  type PacketWarning,
  type Pipeline,
  type PipelineNode,
  type RunEvent,
  type RunStep,
  type RunTrace,
  type TeamRunTrace,
} from "@/lib/pipeline/schema";
import { hasSupabase } from "@/lib/supabase/client";
import { saveRun, upsertPipeline } from "@/lib/supabase/queries";

export type SaveStatus = "idle" | "saving" | "saved" | "error" | "local";
export type RunStatus = "idle" | "running" | "success" | "error";
export type PanelTab = "preview" | "input" | "output" | "packets";
type RunOptions = { onlyNodeId?: string; onlyAgentId?: string };

type Pos = { x: number; y: number };

interface PipelineState {
  pipeline: Pipeline | null;
  selectedNodeId: string | null;

  runStatus: RunStatus;
  runningNodeId: string | null;
  runStartedAt: string | null;
  steps: RunStep[];
  tables: OutputTable[];
  finalOutput: FinalOutput | null;
  runError: string | null;
  activeRunTrace: RunTrace | null;
  teamRunTraces: TeamRunTrace[];
  agentRunTraces: AgentRunTrace[];
  handoffPackets: HandoffPacket[];
  packetWarnings: PacketWarning[];
  selectedPacketId: string | null;
  selectedTeamTraceId: string | null;
  runningTeamId: string | null;
  runningAgentId: string | null;

  panelTab: PanelTab;
  panelOpen: boolean;
  connectToUI: boolean;
  activeTableId: string | null;

  saveStatus: SaveStatus;
  generating: boolean;
  notice: string | null;

  setActivePipeline: (p: Pipeline, run?: RunTrace | null) => void;
  selectNode: (id: string | null) => void;
  patchNode: (id: string, patch: Partial<PipelineNode>) => void;
  setNodePrompt: (id: string, prompt: string) => void;
  setNodePosition: (id: string, position: Pos) => void;
  setMockInput: (key: string, value: string) => void;
  renamePipeline: (name: string) => void;

  setPanelTab: (t: PanelTab) => void;
  togglePanel: (open?: boolean) => void;
  setConnectToUI: (v: boolean) => void;
  setActiveTable: (id: string | null) => void;
  setNotice: (n: string | null) => void;
  selectPacket: (id: string | null) => void;

  generate: (description: string) => Promise<void>;
  runPipeline: (options?: RunOptions) => Promise<void>;
  rerunTeam: (nodeId: string) => Promise<void>;
  runSoloAgent: (nodeId: string, agentId: string) => Promise<void>;
}

function applyStatuses(p: Pipeline, fn: (n: PipelineNode) => NodeStatus): Pipeline {
  return { ...p, nodes: p.nodes.map((n) => ({ ...n, status: fn(n) })) };
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export const usePipelineStore = create<PipelineState>((set, get) => {
  const scheduleSave = () => {
    if (!hasSupabase()) {
      set({ saveStatus: "local" });
      return;
    }
    set({ saveStatus: "saving" });
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      const p = get().pipeline;
      if (!p) return;
      const ok = await upsertPipeline(p);
      set({ saveStatus: ok ? "saved" : "error" });
    }, 850);
  };

  const mutate = (mut: (p: Pipeline) => Pipeline, save = true) => {
    const p = get().pipeline;
    if (!p) return;
    set({ pipeline: { ...mut(p), updatedAt: new Date().toISOString() } });
    if (save) scheduleSave();
  };

  return {
    pipeline: null,
    selectedNodeId: null,
    runStatus: "idle",
    runningNodeId: null,
    runStartedAt: null,
    steps: [],
    tables: [],
    finalOutput: null,
    runError: null,
    activeRunTrace: null,
    teamRunTraces: [],
    agentRunTraces: [],
    handoffPackets: [],
    packetWarnings: [],
    selectedPacketId: null,
    selectedTeamTraceId: null,
    runningTeamId: null,
    runningAgentId: null,
    panelTab: "output",
    panelOpen: true,
    connectToUI: true,
    activeTableId: null,
    saveStatus: "idle",
    generating: false,
    notice: null,

    setActivePipeline: (p, run) => {
      const stepStatus = new Map((run?.steps ?? []).map((s) => [s.nodeId, s.status]));
      const withStatus =
        run?.status === "success"
          ? applyStatuses(p, (n) => stepStatus.get(n.id) ?? "success")
          : applyStatuses(p, () => "idle");
      const tables = run?.tables?.length ? run.tables : p.outputTables;
      set({
        pipeline: withStatus,
        selectedNodeId: null,
        runStatus: run?.status === "success" ? "success" : "idle",
        runningNodeId: null,
        runStartedAt: null,
        steps: run?.steps ?? [],
        tables,
        finalOutput: run?.finalOutput ?? null,
        runError: null,
        activeRunTrace: run ?? null,
        teamRunTraces: run?.teamRuns ?? [],
        agentRunTraces: run?.agentRuns ?? [],
        handoffPackets: run?.packets ?? [],
        packetWarnings: run?.packetWarnings ?? [],
        selectedPacketId: run?.packets?.[0]?.packetId ?? null,
        selectedTeamTraceId: null,
        runningTeamId: null,
        runningAgentId: null,
        activeTableId: tables[0]?.id ?? null,
        saveStatus: hasSupabase() ? "saved" : "local",
        notice: null,
      });
    },

    selectNode: (id) => set({ selectedNodeId: id }),

    patchNode: (id, patch) =>
      mutate((p) => ({ ...p, nodes: p.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) })),

    setNodePrompt: (id, prompt) =>
      mutate((p) => ({ ...p, nodes: p.nodes.map((n) => (n.id === id ? { ...n, prompt } : n)) })),

    setNodePosition: (id, position) =>
      mutate((p) => ({ ...p, nodes: p.nodes.map((n) => (n.id === id ? { ...n, position } : n)) })),

    setMockInput: (key, value) =>
      mutate((p) => ({
        ...p,
        mockInputs: p.mockInputs.map((f) => (f.key === key ? { ...f, value } : f)),
      })),

    renamePipeline: (name) => mutate((p) => ({ ...p, name })),

    setPanelTab: (panelTab) => set({ panelTab, panelOpen: true }),
    togglePanel: (open) => set((s) => ({ panelOpen: open ?? !s.panelOpen })),
    setConnectToUI: (connectToUI) => set({ connectToUI }),
    setActiveTable: (activeTableId) => set({ activeTableId }),
    setNotice: (notice) => set({ notice }),
    selectPacket: (selectedPacketId) => set({ selectedPacketId, panelTab: "packets", panelOpen: true }),

    generate: async (description) => {
      if (!description.trim() || get().generating) return;
      set({ generating: true, notice: null });
      try {
        const res = await fetch("/api/generate-pipeline", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok || !j.pipeline) {
          set({ notice: j.error ?? "Generation failed." });
          return;
        }
        const p = pipelineSchema.parse(j.pipeline);
        get().setActivePipeline(p, null);
        if (j.note) set({ notice: j.note });
        if (hasSupabase()) {
          const ok = await upsertPipeline(p);
          set({ saveStatus: ok ? "saved" : "error" });
        }
      } catch (err) {
        set({ notice: (err as Error)?.message ?? "Generation failed." });
      } finally {
        set({ generating: false });
      }
    },

    runPipeline: async (options = {}) => {
      const p = get().pipeline;
      if (!p || get().runStatus === "running") return;
      const runNodes = options.onlyNodeId ? p.nodes.filter((n) => n.id === options.onlyNodeId) : p.nodes;
      const seedTables = options.onlyNodeId ? (get().tables.length ? get().tables : p.outputTables) : [];

      set({
        runStatus: "running",
        runError: null,
        runningNodeId: null,
        runningTeamId: null,
        runningAgentId: null,
        runStartedAt: new Date().toISOString(),
        finalOutput: null,
        activeRunTrace: null,
        teamRunTraces: [],
        agentRunTraces: [],
        handoffPackets: [],
        packetWarnings: [],
        selectedPacketId: null,
        selectedTeamTraceId: null,
        tables: seedTables,
        panelTab: "output",
        panelOpen: true,
        steps: runNodes.map((n) => ({ nodeId: n.id, title: n.title, status: "idle", durationMs: 0 })),
        pipeline: applyStatuses(p, () => "idle"),
      });

      const setNodeStatus = (id: string, status: NodeStatus) => {
        const cur = get().pipeline;
        if (cur) set({ pipeline: applyStatuses(cur, (n) => (n.id === id ? status : n.status)) });
      };

      const onEvent = (ev: RunEvent) => {
        if (ev.kind === "node-start") {
          set({ runningNodeId: ev.nodeId });
          setNodeStatus(ev.nodeId, "running");
          set((s) => ({
            steps: s.steps.map((st) =>
              st.nodeId === ev.nodeId ? { ...st, status: "running" } : st,
            ),
          }));
        } else if (ev.kind === "team-start") {
          set({ runningTeamId: ev.teamNodeId, selectedTeamTraceId: ev.teamNodeId });
        } else if (ev.kind === "agent-start") {
          set({ runningTeamId: ev.teamNodeId, runningAgentId: ev.agentId });
        } else if (ev.kind === "agent-done") {
          set((s) => ({
            runningAgentId: s.runningAgentId === ev.agentTrace.agentId ? null : s.runningAgentId,
            agentRunTraces: [
              ...s.agentRunTraces.filter((t) => t.id !== ev.agentTrace.id),
              ev.agentTrace,
            ],
          }));
        } else if (ev.kind === "team-done") {
          set((s) => ({
            runningTeamId: s.runningTeamId === ev.teamNodeId ? null : s.runningTeamId,
            selectedTeamTraceId: ev.teamTrace.id,
            teamRunTraces: [
              ...s.teamRunTraces.filter((t) => t.id !== ev.teamTrace.id),
              ev.teamTrace,
            ],
          }));
        } else if (ev.kind === "packet") {
          set((s) => ({
            handoffPackets: [
              ...s.handoffPackets.filter((p) => p.packetId !== ev.packet.packetId),
              ev.packet,
            ],
            packetWarnings: [...s.packetWarnings, ...(ev.warnings ?? [])],
            selectedPacketId: s.selectedPacketId ?? ev.packet.packetId,
          }));
        } else if (ev.kind === "node-done") {
          setNodeStatus(ev.nodeId, ev.status);
          set((s) => ({
            runningNodeId: s.runningNodeId === ev.nodeId ? null : s.runningNodeId,
            tables: ev.tables,
            activeTableId: s.activeTableId ?? ev.tables[0]?.id ?? null,
            handoffPackets: ev.packet
              ? [...s.handoffPackets.filter((p) => p.packetId !== ev.packet!.packetId), ev.packet]
              : s.handoffPackets,
            selectedPacketId: s.selectedPacketId ?? ev.packet?.packetId ?? null,
            steps: s.steps.map((st) =>
              st.nodeId === ev.nodeId
                ? { ...st, status: ev.status, summary: ev.summary, durationMs: ev.durationMs }
                : st,
            ),
          }));
        } else if (ev.kind === "run-done") {
          set({
            runStatus: ev.status,
            runningNodeId: null,
            runningTeamId: null,
            runningAgentId: null,
            finalOutput: ev.finalOutput ?? get().finalOutput,
            runError: ev.error ?? null,
            notice: ev.error ?? null,
            activeRunTrace: ev.runTrace ?? get().activeRunTrace,
            teamRunTraces: ev.runTrace?.teamRuns ?? get().teamRunTraces,
            agentRunTraces: ev.runTrace?.agentRuns ?? get().agentRunTraces,
            handoffPackets: ev.runTrace?.packets ?? get().handoffPackets,
            packetWarnings: ev.runTrace?.packetWarnings ?? get().packetWarnings,
          });
          const cur = get();
          if (cur.pipeline && hasSupabase() && ev.runTrace) {
            void saveRun(ev.runTrace);
          }
        }
      };

      try {
        const res = await fetch("/api/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pipeline: p,
            onlyNodeId: options.onlyNodeId,
            onlyAgentId: options.onlyAgentId,
            seedTables,
          }),
        });
        if (!res.ok || !res.body) {
          const j = await res.json().catch(() => ({}));
          set({
            runStatus: "error",
            runError: j.error ?? "Run failed.",
            notice: j.error ?? "Run failed.",
            runningTeamId: null,
            runningAgentId: null,
            pipeline: applyStatuses(p, () => "idle"),
          });
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (line) {
              try {
                onEvent(JSON.parse(line) as RunEvent);
              } catch {
                /* ignore partial */
              }
            }
          }
        }
      } catch (err) {
        set({
          runStatus: "error",
          runError: (err as Error)?.message ?? "Run failed.",
          notice: (err as Error)?.message ?? "Run failed.",
          runningNodeId: null,
          runningTeamId: null,
          runningAgentId: null,
        });
      }
    },

    rerunTeam: async (nodeId) => {
      await get().runPipeline({ onlyNodeId: nodeId });
    },

    runSoloAgent: async (nodeId, agentId) => {
      await get().runPipeline({ onlyNodeId: nodeId, onlyAgentId: agentId });
    },
  };
});
