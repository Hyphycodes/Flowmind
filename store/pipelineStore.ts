import { create } from "zustand";
import {
  pipelineSchema,
  type AgentConfig,
  type AgentRunTrace,
  type ExecutionMode,
  type FieldMapping,
  type FinalOutput,
  type GenerationStyle,
  type GoogleDriveSourceConfig,
  type HandoffPacket,
  type InputSourceMode,
  type NodeStatus,
  type OutputTable,
  type PacketWarning,
  type Pipeline,
  type PipelineNode,
  type ProductBrief,
  type ProductDrop,
  type ProductVariation,
  type QualityTarget,
  type RealityMeter,
  type RemixProposal,
  type RunEvent,
  type RunStep,
  type RunTrace,
  type Take,
  type TeamRunTrace,
  type TeamStrategy,
} from "@/lib/pipeline/schema";
import { hasSupabase } from "@/lib/supabase/client";
import {
  deleteDataset,
  getBuilderPreferences,
  listDatasets,
  saveBuilderPreferences,
  saveDataset,
  saveExport,
  saveRun,
  saveTake,
  upsertPipeline,
} from "@/lib/supabase/queries";
import { emptyPreferences, type BuilderPreferences } from "@/lib/preferences/schema";
import { learnFromAppliedChanges } from "@/lib/preferences/learn";
import type { Dataset } from "@/lib/datasets/schema";
import type { EffortLevel } from "@/lib/pipeline/effort";
import { coordinateTeamNode } from "@/lib/pipeline/teamCoordinator";
import { descendantsOf } from "@/lib/pipeline/graph";
import { applyChangesToPipeline, type EditChange, type EditProposal } from "@/lib/pipeline/editDiff";
import { canEnterTeam } from "@/lib/pipeline/teamView";
import { newId } from "@/lib/pipeline/validate";
import { enrichDataset, datasetFromTable, tableFromDataset } from "@/lib/datasets/utils";
import { applyRepair, type RepairAction } from "@/lib/datasets/repair";
import { runEvals } from "@/lib/evals/runEval";
import { buildTake } from "@/lib/takes/build";
import { generateProductDrop } from "@/lib/product/productDrop";
import { calculateRealityMeter } from "@/lib/product/realityMeter";
import { generateProductBrief } from "@/lib/product/brief";
import { buildRemixProposal } from "@/lib/product/remix";
import { explainProductBlueprint, type ExplainAudience } from "@/lib/product/explain";
import { downloadExportBundle, type ExportContext } from "@/lib/export/bundle";
import { buildExportHealthCheck } from "@/lib/export/healthCheck";
import type { ExportHealthCheck, ExportManifest, ExportMode } from "@/lib/export/schema";
import type { FeatureGateResult } from "@/lib/billing/types";

export type SaveStatus = "idle" | "saving" | "saved" | "error" | "local";
export type RunStatus = "idle" | "running" | "success" | "error";
export type PanelTab = "build" | "run" | "data";
type RunOptions = { onlyNodeId?: string; onlyAgentId?: string; fromNodeId?: string };

export type GenerateDatasetInput = {
  name?: string;
  prompt: string;
  rowCount?: number;
  qualityTarget?: QualityTarget;
  generationStyle?: GenerationStyle;
  scenarioTags?: string[];
  requiredFields?: string[];
  columns?: { key: string; label: string; type?: string }[];
  existingRows?: Record<string, unknown>[];
  datasetId?: string;
};

type Pos = { x: number; y: number };

interface PipelineState {
  pipeline: Pipeline | null;
  selectedNodeId: string | null;
  /** advanced settings panel (NodeInspector) — opened from the popover, not single-click */
  inspectorOpen: boolean;
  /** view stack of entered team ids — zoom into a team's internal canvas (max depth 3) */
  teamPath: string[];

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

  /** Input Studio / Dataset Library (session-global) */
  datasets: Dataset[];
  activeDatasetId: string | null;
  datasetGenerating: boolean;
  inputStudio: { open: boolean; nodeId: string | null };
  modelAvailable: boolean | null;

  /** Execution / Takes */
  executionMode: ExecutionMode;
  takes: Take[];
  activeTakeId: string | null;
  compareTakeIds: string[];

  /** Product layer (Product Drop / Reality Meter / Remix / Brief) */
  productDrop: ProductDrop | null;
  realityMeter: RealityMeter | null;
  productBrief: ProductBrief | null;
  remixProposal: RemixProposal | null;
  remixProposedPipeline: Pipeline | null;
  remixing: boolean;
  explainAudience: ExplainAudience;
  explainText: string | null;

  /** Chat Copilot: pending edit-diff proposal (approve-then-apply, never auto-mutates). */
  editProposal: EditProposal | null;
  editChecked: Record<string, boolean>;
  editing: boolean;

  /** Builder preferences (learned + explicit) + the ask-or-build clarification prompt. */
  preferences: BuilderPreferences | null;
  clarify: { question: string; options: string[]; description: string } | null;

  /** Export system */
  exportOpen: boolean;
  exporting: boolean;
  exportHealth: ExportHealthCheck | null;
  lastExportManifest: ExportManifest | null;

  /** Billing: upgrade prompt shown when a feature gate blocks an action */
  upgradeGate: (FeatureGateResult & { title?: string }) | null;

  saveStatus: SaveStatus;
  generating: boolean;
  /** Architect effort dial — sizes how big a pipeline a description generates. */
  effort: EffortLevel;
  notice: string | null;

  setActivePipeline: (p: Pipeline, run?: RunTrace | null) => void;
  selectNode: (id: string | null) => void;
  openInspector: (id?: string) => void;
  closeInspector: () => void;
  /** Team zoom (view stack) */
  enterTeam: (nodeId: string) => void;
  exitTeam: () => void;
  setTeamPath: (path: string[]) => void;
  /** Drag a node onto another to form / grow a team (undoable). */
  mergeNodeIntoTeam: (draggedId: string, targetId: string) => void;
  setAgentPrompt: (teamId: string, agentId: string, prompt: string) => void;
  undo: () => void;
  patchNode: (id: string, patch: Partial<PipelineNode>) => void;
  setNodePrompt: (id: string, prompt: string) => void;
  /** Team Coordinator: change strategy / add / remove members → re-coordinate
   *  (rebuild controllers + internal wiring + identity) deterministically. */
  setTeamStrategy: (nodeId: string, strategy: TeamStrategy) => void;
  addTeamAgent: (nodeId: string) => void;
  removeTeamAgent: (nodeId: string, agentId: string) => void;
  coordinateTeam: (nodeId: string) => void;
  setNodePosition: (id: string, position: Pos) => void;
  setMockInput: (key: string, value: string) => void;
  renamePipeline: (name: string) => void;

  setPanelTab: (t: PanelTab) => void;
  togglePanel: (open?: boolean) => void;
  setConnectToUI: (v: boolean) => void;
  setActiveTable: (id: string | null) => void;
  setNotice: (n: string | null) => void;
  setEffort: (e: EffortLevel) => void;
  selectPacket: (id: string | null) => void;

  /** Input Studio / Source Layer */
  hydrateDatasets: (seed?: Dataset[]) => Promise<void>;
  upsertDataset: (d: Dataset) => void;
  removeDataset: (id: string) => Promise<void>;
  repairDataset: (id: string, action: RepairAction) => void;
  setActiveDataset: (id: string | null) => void;
  openInputStudio: (nodeId?: string | null) => void;
  closeInputStudio: () => void;
  generateDataset: (input: GenerateDatasetInput, opts?: { bindNodeId?: string | null }) => Promise<Dataset | null>;
  setSourceMode: (nodeId: string, mode: InputSourceMode) => void;
  applyDatasetToNode: (nodeId: string, datasetId: string) => void;
  setNodeScenario: (nodeId: string, scenarioTag: string | null) => void;
  applyFieldMapping: (mapping: FieldMapping) => void;
  bindTakeTableToSource: (nodeId: string, tableId: string, snapshot: boolean) => void;
  setNodeDriveSource: (nodeId: string, drive: GoogleDriveSourceConfig) => void;

  /** Execution / Takes */
  setExecutionMode: (mode: ExecutionMode) => void;
  hydrateTakes: (seed?: Take[]) => void;
  selectTake: (id: string | null) => void;
  toggleCompareTake: (id: string) => void;
  clearCompare: () => void;

  /** Product layer */
  refreshProduct: () => void;
  startRemix: (actionId: string) => void;
  applyRemix: () => void;
  cancelRemix: () => void;
  addProductVariation: (variation: ProductVariation) => void;
  explain: (audience: ExplainAudience) => void;

  /** Chat Copilot — edit by talking (diff proposal → checkmark approval → mechanical apply) */
  proposeEdit: (request: string, opts?: { remixAction?: string }) => Promise<void>;
  toggleEditChange: (id: string) => void;
  applyEditProposal: (which: "selected" | "all") => void;
  discardEditProposal: () => void;

  /** Builder preferences + ask-or-build clarification */
  hydratePreferences: () => Promise<void>;
  forgetPreference: (id: string) => void;
  addExplicitPreference: (statement: string) => void;
  answerClarification: (answer: string) => void;
  dismissClarification: () => void;

  /** Export system */
  openExport: () => void;
  closeExport: () => void;
  openUpgrade: (gate: FeatureGateResult & { title?: string }) => void;
  closeUpgrade: () => void;
  runExport: (modes: ExportMode[]) => Promise<void>;

  generate: (description: string, effort?: EffortLevel, opts?: { clarified?: boolean }) => Promise<void>;
  runPipeline: (options?: RunOptions) => Promise<void>;
  rerunTeam: (nodeId: string) => Promise<void>;
  runSoloAgent: (nodeId: string, agentId: string) => Promise<void>;
}

function applyStatuses(p: Pipeline, fn: (n: PipelineNode) => NodeStatus): Pipeline {
  return { ...p, nodes: p.nodes.map((n) => ({ ...n, status: fn(n) })) };
}

function upsertById<T extends { id: string }>(arr: T[], item: T): T[] {
  const i = arr.findIndex((x) => x.id === item.id);
  if (i === -1) return [...arr, item];
  const copy = arr.slice();
  copy[i] = item;
  return copy;
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

  // Single-level-ish undo for structural edits (e.g. drag-to-merge). Pipeline objects
  // are always replaced (never mutated in place), so a reference is a valid snapshot.
  let history: Pipeline[] = [];
  const pushHistory = (p: Pipeline) => {
    history.push(p);
    if (history.length > 12) history = history.slice(-12);
  };

  return {
    pipeline: null,
    selectedNodeId: null,
    inspectorOpen: false,
    teamPath: [],
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
    panelTab: "build",
    panelOpen: true,
    connectToUI: true,
    activeTableId: null,
    datasets: [],
    activeDatasetId: null,
    datasetGenerating: false,
    inputStudio: { open: false, nodeId: null },
    modelAvailable: null,
    executionMode: "hybrid",
    takes: [],
    activeTakeId: null,
    compareTakeIds: [],
    productDrop: null,
    realityMeter: null,
    productBrief: null,
    remixProposal: null,
    remixProposedPipeline: null,
    remixing: false,
    explainAudience: "founder",
    explainText: null,
    editProposal: null,
    editChecked: {},
    editing: false,
    preferences: null,
    clarify: null,
    exportOpen: false,
    exporting: false,
    exportHealth: null,
    lastExportManifest: null,
    upgradeGate: null,
    saveStatus: "idle",
    generating: false,
    effort: "balanced",
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
        activeDatasetId: null,
        datasetGenerating: false,
        inputStudio: { open: false, nodeId: null },
        takes: [],
        activeTakeId: null,
        compareTakeIds: [],
        remixProposal: null,
        remixProposedPipeline: null,
        remixing: false,
        explainText: null,
        exportOpen: false,
        exportHealth: null,
        lastExportManifest: null,
        panelTab: "build",
        saveStatus: hasSupabase() ? "saved" : "local",
        notice: null,
      });
      get().refreshProduct();
    },

    selectNode: (id) => set({ selectedNodeId: id, inspectorOpen: false }),

    openInspector: (id) => set((s) => ({ selectedNodeId: id ?? s.selectedNodeId, inspectorOpen: true })),
    closeInspector: () => set({ inspectorOpen: false }),

    enterTeam: (nodeId) =>
      set((s) => {
        if (!s.pipeline || s.teamPath.length >= 3) return {};
        if (!canEnterTeam(s.pipeline, s.teamPath, nodeId)) return {};
        return { teamPath: [...s.teamPath, nodeId], selectedNodeId: null, inspectorOpen: false };
      }),
    exitTeam: () =>
      set((s) => (s.teamPath.length === 0 ? {} : { teamPath: s.teamPath.slice(0, -1), selectedNodeId: null, inspectorOpen: false })),
    setTeamPath: (path) => set({ teamPath: path, selectedNodeId: null, inspectorOpen: false }),

    setAgentPrompt: (teamId, agentId, prompt) =>
      mutate((p) => ({
        ...p,
        nodes: p.nodes.map((n) =>
          n.id === teamId && n.team
            ? { ...n, team: { ...n.team, agents: n.team.agents.map((a) => (a.id === agentId ? { ...a, prompt } : a)) } }
            : n,
        ),
      })),

    undo: () => {
      const prev = history.pop();
      if (!prev) return;
      set({ pipeline: prev, selectedNodeId: null, inspectorOpen: false, notice: "Reverted the last change." });
      scheduleSave();
    },

    mergeNodeIntoTeam: (draggedId, targetId) => {
      const p = get().pipeline;
      if (!p || draggedId === targetId) return;
      const dragged = p.nodes.find((n) => n.id === draggedId);
      const target = p.nodes.find((n) => n.id === targetId);
      if (!dragged || !target) return;
      if (["input", "output"].includes(dragged.type) || ["input", "output"].includes(target.type)) {
        set({ notice: "Input and output nodes can't be merged into a team." });
        return;
      }
      pushHistory(p);

      const agentFrom = (n: PipelineNode): AgentConfig => ({
        id: n.id,
        name: n.title,
        role: n.role ?? "",
        prompt: n.prompt ?? "",
        model: n.model,
        modelSelection: n.modelSelection,
        toolAttachments: n.toolAttachments ?? [],
        muted: false,
      });

      let merged: PipelineNode;
      if (target.team) {
        const members = target.team.agents.filter((a) => !a.isController);
        merged = { ...target, team: { ...target.team, agents: [...members, agentFrom(dragged)] } };
      } else {
        const t = agentFrom(target);
        const d = agentFrom(dragged);
        merged = {
          ...target,
          team: { strategy: "sequential", agents: [t, d], lead: undefined, internalEdges: [{ source: t.id, target: d.id }], toolAttachments: [] },
        };
      }
      merged = coordinateTeamNode(merged);

      // Rewire any edges touching the dragged node onto the team; drop self-loops + dupes.
      const seen = new Set<string>();
      const edges = p.edges
        .map((e) => ({
          ...e,
          source: e.source === draggedId ? targetId : e.source,
          target: e.target === draggedId ? targetId : e.target,
        }))
        .filter((e) => e.source !== e.target)
        .filter((e) => {
          const k = `${e.source}>${e.target}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
      const nodes = p.nodes.filter((n) => n.id !== draggedId).map((n) => (n.id === targetId ? merged : n));

      set({
        pipeline: { ...p, nodes, edges, updatedAt: new Date().toISOString() },
        selectedNodeId: targetId,
        inspectorOpen: false,
        notice: target.team
          ? `Added “${dragged.title}” to ${target.title}.`
          : `Formed team “${target.title}”. Press ⌘Z to undo.`,
      });
      scheduleSave();
    },

    patchNode: (id, patch) =>
      mutate((p) => ({ ...p, nodes: p.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) })),

    setNodePrompt: (id, prompt) =>
      mutate((p) => ({ ...p, nodes: p.nodes.map((n) => (n.id === id ? { ...n, prompt } : n)) })),

    setTeamStrategy: (nodeId, strategy) =>
      mutate((p) => ({
        ...p,
        nodes: p.nodes.map((n) =>
          n.id === nodeId && n.team ? coordinateTeamNode({ ...n, team: { ...n.team, strategy } }) : n,
        ),
      })),

    coordinateTeam: (nodeId) =>
      mutate((p) => ({
        ...p,
        nodes: p.nodes.map((n) => (n.id === nodeId && n.team ? coordinateTeamNode(n) : n)),
      })),

    addTeamAgent: (nodeId) =>
      mutate((p) => ({
        ...p,
        nodes: p.nodes.map((n) => {
          if (n.id !== nodeId || !n.team) return n;
          const members = n.team.agents.filter((a) => !a.isController);
          const newAgent = {
            id: `${nodeId}_a_${newId().slice(0, 6)}`,
            name: `Agent ${members.length + 1}`,
            role: "",
            prompt: "",
            model: members[0]?.model ?? "claude-sonnet-4-6",
            toolAttachments: [],
          };
          return coordinateTeamNode({ ...n, team: { ...n.team, agents: [...members, newAgent] } });
        }),
      })),

    removeTeamAgent: (nodeId, agentId) =>
      mutate((p) => ({
        ...p,
        nodes: p.nodes.map((n) => {
          if (n.id !== nodeId || !n.team) return n;
          const members = n.team.agents.filter((a) => !a.isController && a.id !== agentId);
          return coordinateTeamNode({ ...n, team: { ...n.team, agents: members } });
        }),
      })),

    setNodePosition: (id, position) =>
      mutate((p) => {
        // Top level → move the pipeline node. Inside a team → persist the agent's
        // position within the entered team so drags stick on the zoomed-in canvas.
        const path = get().teamPath;
        if (path.length === 0) {
          return { ...p, nodes: p.nodes.map((n) => (n.id === id ? { ...n, position } : n)) };
        }
        return {
          ...p,
          nodes: p.nodes.map((n) =>
            n.id === path[0] && n.team
              ? { ...n, team: { ...n.team, agents: n.team.agents.map((a) => (a.id === id ? { ...a, position } : a)) } }
              : n,
          ),
        };
      }),

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
    setEffort: (effort) => set({ effort }),
    selectPacket: (selectedPacketId) => set({ selectedPacketId, panelTab: "run", panelOpen: true }),

    /* ── Input Studio / Source Layer ──────────────────────────────────── */

    hydrateDatasets: async (seed = []) => {
      const stored = hasSupabase() ? await listDatasets() : [];
      const byId = new Map<string, Dataset>();
      for (const d of stored) byId.set(d.id, d);
      for (const d of get().datasets) byId.set(d.id, d); // keep session generations
      for (const d of seed) byId.set(d.id, enrichDataset(d)); // fixtures win
      set({ datasets: [...byId.values()] });
    },

    upsertDataset: (d) => {
      const enriched = enrichDataset(d);
      set((s) => ({ datasets: [enriched, ...s.datasets.filter((x) => x.id !== enriched.id)] }));
      if (hasSupabase()) void saveDataset(enriched);
    },

    removeDataset: async (id) => {
      set((s) => ({
        datasets: s.datasets.filter((d) => d.id !== id),
        activeDatasetId: s.activeDatasetId === id ? null : s.activeDatasetId,
      }));
      if (hasSupabase()) await deleteDataset(id);
    },

    repairDataset: (id, action) => {
      const d = get().datasets.find((x) => x.id === id);
      if (!d) return;
      get().upsertDataset(applyRepair(d, action));
      set({ notice: `Repaired "${d.name}" — ${action}.` });
    },

    setActiveDataset: (activeDatasetId) =>
      set({ activeDatasetId, panelTab: "data", panelOpen: true }),

    openInputStudio: (nodeId = null) => set({ inputStudio: { open: true, nodeId } }),
    closeInputStudio: () => set({ inputStudio: { open: false, nodeId: null } }),

    generateDataset: async (input, opts = {}) => {
      if (!input.prompt.trim() || get().datasetGenerating) return null;
      set({ datasetGenerating: true, notice: null });
      try {
        const res = await fetch("/api/input-studio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok || !j.dataset) {
          set({ notice: j.error ?? "Dataset generation failed." });
          return null;
        }
        const dataset = enrichDataset(j.dataset as Dataset);
        get().upsertDataset(dataset);
        set({
          activeDatasetId: dataset.id,
          modelAvailable: typeof j.modelAvailable === "boolean" ? j.modelAvailable : get().modelAvailable,
          notice:
            j.modelAvailable === false
              ? "Generated a deterministic demo dataset (no model key)."
              : `Generated "${dataset.name}" — ${dataset.rows.length} rows.`,
        });
        if (opts.bindNodeId) get().applyDatasetToNode(opts.bindNodeId, dataset.id);
        return dataset;
      } catch (err) {
        set({ notice: (err as Error)?.message ?? "Dataset generation failed." });
        return null;
      } finally {
        set({ datasetGenerating: false });
      }
    },

    setSourceMode: (nodeId, mode) =>
      mutate((p) => ({
        ...p,
        nodes: p.nodes.map((n) =>
          n.id === nodeId ? { ...n, source: { ...(n.source ?? {}), mode } } : n,
        ),
      })),

    applyDatasetToNode: (nodeId, datasetId) => {
      const dataset = get().datasets.find((d) => d.id === datasetId);
      if (!dataset) return;
      get().upsertDataset({ ...dataset, connectedNodeId: nodeId });
      mutate((p) => {
        const node = p.nodes.find((n) => n.id === nodeId);
        const tableId = node?.outputs[0] ?? dataset.id;
        const table = tableFromDataset(dataset, nodeId, tableId);
        return {
          ...p,
          datasetIds: Array.from(new Set([...p.datasetIds, datasetId])),
          nodes: p.nodes.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  source: { ...(n.source ?? {}), mode: "input_studio", datasetId, datasetName: dataset.name },
                }
              : n,
          ),
          outputTables: upsertById(p.outputTables, table),
        };
      });
      const node = get().pipeline?.nodes.find((n) => n.id === nodeId);
      const table = tableFromDataset(dataset, nodeId, node?.outputs[0] ?? dataset.id);
      set((s) => ({
        tables: upsertById(s.tables, table),
        activeTableId: table.id,
        notice: `"${dataset.name}" is now the source for ${node?.title ?? "this node"}.`,
      }));
    },

    setNodeDriveSource: (nodeId, drive) =>
      mutate((p) => ({
        ...p,
        nodes: p.nodes.map((n) =>
          n.id === nodeId ? { ...n, source: { ...(n.source ?? {}), mode: "google_drive", drive } } : n,
        ),
      })),

    setNodeScenario: (nodeId, scenarioTag) => {
      const tag = scenarioTag ?? undefined;
      const match = tag ? get().datasets.find((d) => d.scenarioTags?.includes(tag)) : undefined;
      mutate((p) => ({
        ...p,
        nodes: p.nodes.map((n) =>
          n.id === nodeId
            ? { ...n, source: { ...(n.source ?? {}), mode: n.source?.mode ?? "input_studio", scenario: tag } }
            : n,
        ),
      }));
      if (match) get().applyDatasetToNode(nodeId, match.id);
      else
        set({
          notice: tag
            ? `Scenario "${tag}" set. Generate a dataset for it in Input Studio.`
            : "Scenario cleared.",
        });
    },

    applyFieldMapping: (mapping) => {
      mutate((p) => ({
        ...p,
        fieldMappings: [
          mapping,
          ...p.fieldMappings.filter(
            (m) =>
              !(
                m.sourceField === mapping.sourceField &&
                m.targetField === mapping.targetField &&
                m.fromNodeId === mapping.fromNodeId
              ),
          ),
        ],
      }));
      set({ notice: `Mapped \`${mapping.sourceField}\` → \`${mapping.targetField}\`.` });
    },

    bindTakeTableToSource: (nodeId, tableId, snapshot) => {
      const table =
        get().tables.find((t) => t.id === tableId) ??
        get().pipeline?.outputTables.find((t) => t.id === tableId);
      if (!table) return;
      let datasetId: string | undefined;
      if (snapshot) {
        const ds = datasetFromTable(table, {
          name: `${table.name} snapshot`,
          mode: "previous_take",
          takeName: get().pipeline?.name,
        });
        get().upsertDataset(ds);
        datasetId = ds.id;
      }
      mutate((p) => ({
        ...p,
        nodes: p.nodes.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                source: {
                  ...(n.source ?? {}),
                  mode: "previous_take",
                  tableName: table.name,
                  takeName: get().pipeline?.name,
                  snapshot,
                  datasetId: datasetId ?? n.source?.datasetId,
                },
              }
            : n,
        ),
      }));
      set({
        notice: snapshot
          ? `Snapshotted \`${table.name}\` as a dataset for this source.`
          : `Bound \`${table.name}\` as a Previous Take source.`,
      });
    },

    /* ── Execution / Takes ────────────────────────────────────────────── */

    setExecutionMode: (executionMode) => set({ executionMode }),

    hydrateTakes: (seed = []) =>
      set((s) => {
        const byId = new Map<string, Take>();
        for (const t of seed) byId.set(t.id, t);
        for (const t of s.takes) byId.set(t.id, t); // keep this session's runs
        const takes = [...byId.values()];
        return { takes, activeTakeId: s.activeTakeId ?? takes[0]?.id ?? null };
      }),

    selectTake: (activeTakeId) => set({ activeTakeId, panelTab: "run", panelOpen: true }),

    toggleCompareTake: (id) =>
      set((s) => {
        const has = s.compareTakeIds.includes(id);
        if (has) return { compareTakeIds: s.compareTakeIds.filter((x) => x !== id) };
        if (s.compareTakeIds.length >= 5) return {};
        return { compareTakeIds: [...s.compareTakeIds, id] };
      }),

    clearCompare: () => set({ compareTakeIds: [] }),

    /* ── Product layer ────────────────────────────────────────────────── */

    refreshProduct: () => {
      const p = get().pipeline;
      if (!p) {
        set({ productDrop: null, realityMeter: null, productBrief: null });
        return;
      }
      const ctx = {
        latestTakeSuccess:
          get().takes[0]?.status === "success" || get().activeRunTrace?.status === "success",
      };
      const drop = generateProductDrop(p);
      const reality = calculateRealityMeter(p, ctx);
      const brief = generateProductBrief(p, drop, reality);
      set({ productDrop: drop, realityMeter: reality, productBrief: brief, explainText: null });
    },

    startRemix: (actionId) => {
      const p = get().pipeline;
      if (!p) return;
      const result = buildRemixProposal(p, actionId);
      if (!result) {
        set({ notice: "That remix isn't available for this pipeline." });
        return;
      }
      if (result.proposal.changes.length === 0) {
        set({ notice: result.proposal.warnings[0] ?? result.proposal.summary });
        return;
      }
      set({ remixProposal: result.proposal, remixProposedPipeline: result.pipeline, remixing: true });
    },

    applyRemix: () => {
      const { remixProposal: proposal, remixProposedPipeline: proposed, pipeline: cur } = get();
      if (!proposal || !proposed || !cur) return;
      const variation: ProductVariation | null = proposal.variationName
        ? {
            id: newId("var"),
            pipelineId: cur.id,
            name: proposal.variationName,
            description: proposal.summary,
            positioning: undefined,
            targetUser: undefined,
            changes: proposal.changes.map((c) => c.description),
            linkedRemixProposalIds: [proposal.id],
            linkedTakeIds: [],
            createdAt: new Date().toISOString(),
          }
        : null;
      const next: Pipeline = {
        ...proposed,
        remixProposals: [proposal, ...(proposed.remixProposals ?? [])].slice(0, 30),
        productVariations: variation
          ? [variation, ...(proposed.productVariations ?? [])].slice(0, 20)
          : proposed.productVariations,
        updatedAt: new Date().toISOString(),
      };
      set({
        pipeline: applyStatuses(next, () => "idle"),
        remixProposal: null,
        remixProposedPipeline: null,
        remixing: false,
        selectedNodeId: null,
        notice: `Applied: ${proposal.title}${variation ? ` → variation "${variation.name}"` : ""}.`,
      });
      get().refreshProduct();
      scheduleSave();
    },

    cancelRemix: () => set({ remixProposal: null, remixProposedPipeline: null, remixing: false }),

    addProductVariation: (variation) =>
      mutate((p) => ({ ...p, productVariations: [variation, ...p.productVariations].slice(0, 20) })),

    explain: (audience) => {
      const p = get().pipeline;
      const drop = get().productDrop;
      const reality = get().realityMeter;
      if (!p || !drop || !reality) return;
      set({ explainAudience: audience, explainText: explainProductBlueprint(p, drop, reality, audience) });
    },

    /* ── Chat Copilot — edit by talking ───────────────────────────────── */

    proposeEdit: async (request, opts = {}) => {
      const p = get().pipeline;
      if (!p || get().editing) return;
      if (!request.trim() && !opts.remixAction) return;
      set({ editing: true, notice: null });
      try {
        const res = await fetch("/api/edit-pipeline", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pipeline: p,
            request,
            remixAction: opts.remixAction,
            selectedNodeId: get().selectedNodeId ?? undefined,
            preferences: get().preferences ?? undefined,
          }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          set({ notice: j.error ?? "Couldn't propose edits." });
          return;
        }
        const changes: EditChange[] = Array.isArray(j.changes) ? j.changes : [];
        if (changes.length === 0) {
          set({ notice: "No changes needed — the pipeline already does that." });
          return;
        }
        const checked: Record<string, boolean> = {};
        for (const c of changes) checked[c.id] = true;
        set({ editProposal: { changes }, editChecked: checked });
      } catch (err) {
        set({ notice: (err as Error)?.message ?? "Couldn't propose edits." });
      } finally {
        set({ editing: false });
      }
    },

    toggleEditChange: (id) =>
      set((s) => {
        if (!s.editProposal) return {};
        const next = { ...s.editChecked, [id]: !s.editChecked[id] };
        // Unchecking a parent disables (unchecks) any change that depends on it.
        if (!next[id]) {
          for (const c of s.editProposal.changes) {
            if (c.depends_on.includes(id)) next[c.id] = false;
          }
        }
        return { editChecked: next };
      }),

    applyEditProposal: (which) => {
      const { editProposal: proposal, editChecked, pipeline: p } = get();
      if (!proposal || !p) return;
      const selectedIds = new Set(
        proposal.changes.filter((c) => (which === "all" ? true : editChecked[c.id])).map((c) => c.id),
      );
      // Respect depends_on: a change only applies if all its parents are also applying.
      const toApply = proposal.changes.filter(
        (c) => selectedIds.has(c.id) && c.depends_on.every((d) => selectedIds.has(d)),
      );
      if (toApply.length === 0) {
        set({ notice: "Nothing selected to apply." });
        return;
      }
      // One undo snapshot for the whole proposal (the diff reverts in a single ⌘Z).
      pushHistory(p);
      const { pipeline: next, applied, skipped } = applyChangesToPipeline(p, toApply);
      set({
        pipeline: applyStatuses(next, () => "idle"),
        editProposal: null,
        editChecked: {},
        selectedNodeId: null,
        inspectorOpen: false,
        notice:
          skipped.length > 0
            ? `Applied ${applied.length} change${applied.length === 1 ? "" : "s"}; skipped ${skipped.length} that would break the graph. ⌘Z to undo.`
            : `Applied ${applied.length} change${applied.length === 1 ? "" : "s"}. ⌘Z to undo.`,
      });
      get().refreshProduct();
      scheduleSave();

      // Learn from what was actually applied — observed patterns only, persisted best-effort.
      const base = get().preferences ?? emptyPreferences();
      const learned = learnFromAppliedChanges(base, toApply);
      if (learned !== base) {
        set({ preferences: learned });
        if (hasSupabase()) void saveBuilderPreferences(learned);
      }
    },

    discardEditProposal: () => set({ editProposal: null, editChecked: {} }),

    /* ── Builder preferences + ask-or-build clarification ─────────────── */

    hydratePreferences: async () => {
      const stored = hasSupabase() ? await getBuilderPreferences() : null;
      set({ preferences: stored ?? emptyPreferences() });
    },

    forgetPreference: (id) => {
      const prefs = get().preferences;
      if (!prefs) return;
      const next: BuilderPreferences = {
        ...prefs,
        patterns: prefs.patterns.filter((p) => p.id !== id),
        updatedAt: new Date().toISOString(),
      };
      set({ preferences: next });
      if (hasSupabase()) void saveBuilderPreferences(next);
    },

    addExplicitPreference: (statement) => {
      const text = statement.trim();
      if (!text) return;
      const prefs = get().preferences ?? emptyPreferences();
      const next: BuilderPreferences = {
        ...prefs,
        patterns: [
          { id: newId("pref"), kind: "other", statement: text, source: "explicit", weight: 5, lastSeenAt: new Date().toISOString() },
          ...prefs.patterns,
        ],
        updatedAt: new Date().toISOString(),
      };
      set({ preferences: next });
      if (hasSupabase()) void saveBuilderPreferences(next);
    },

    answerClarification: (answer) => {
      const c = get().clarify;
      if (!c) return;
      const combined = answer.trim() ? `${c.description} — ${answer.trim()}` : c.description;
      set({ clarify: null });
      void get().generate(combined, undefined, { clarified: true });
    },

    dismissClarification: () => {
      const c = get().clarify;
      if (!c) return;
      set({ clarify: null });
      void get().generate(c.description, undefined, { clarified: true });
    },

    /* ── Export system ────────────────────────────────────────────────── */

    openExport: () => {
      const p = get().pipeline;
      if (!p) return;
      const datasets = get().datasets.filter(
        (d) => p.datasetIds.includes(d.id) || (d.connectedNodeId && p.nodes.some((n) => n.id === d.connectedNodeId)),
      );
      set({
        exportOpen: true,
        exportHealth: buildExportHealthCheck({ pipeline: p, datasets, hasRun: Boolean(get().activeRunTrace) }),
      });
    },

    closeExport: () => set({ exportOpen: false }),

    openUpgrade: (gate) => set({ upgradeGate: gate }),
    closeUpgrade: () => set({ upgradeGate: null }),

    runExport: async (modes) => {
      const s = get();
      const p = s.pipeline;
      if (!p || s.exporting || modes.length === 0) return;
      set({ exporting: true });
      try {
        const datasets = s.datasets.filter(
          (d) => p.datasetIds.includes(d.id) || (d.connectedNodeId && p.nodes.some((n) => n.id === d.connectedNodeId)),
        );
        const ctx: ExportContext = {
          pipeline: p,
          run: {
            tables: s.tables,
            finalOutput: s.finalOutput,
            packets: s.handoffPackets,
            packetWarnings: s.packetWarnings,
            teamRuns: s.teamRunTraces,
            agentRuns: s.agentRunTraces,
            toolTraces: s.activeRunTrace?.toolTraces,
            runTrace: s.activeRunTrace,
            datasets,
            takes: s.takes,
            evalResults: s.activeRunTrace?.evalResults,
          },
          productDrop: s.productDrop ?? undefined,
          realityMeter: s.realityMeter ?? undefined,
          productBrief: s.productBrief ?? undefined,
        };
        const manifest = await downloadExportBundle(ctx, modes);
        if (hasSupabase()) void saveExport(manifest);
        set({
          lastExportManifest: manifest,
          notice: `Exported ${manifest.fileCount} files · ${modes.length} mode${modes.length > 1 ? "s" : ""}.`,
        });
      } catch (err) {
        set({ notice: (err as Error)?.message ?? "Export failed." });
      } finally {
        set({ exporting: false });
      }
    },

    generate: async (description, effort, opts = {}) => {
      if (!description.trim() || get().generating) return;
      const level = effort ?? get().effort;
      set({ generating: true, notice: null, clarify: null });
      try {
        const res = await fetch("/api/generate-pipeline", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description,
            effort: level,
            clarified: opts.clarified,
            preferences: get().preferences ?? undefined,
          }),
        });
        const j = await res.json().catch(() => ({}));
        // Ask-or-build: surface one inline clarifying question instead of a pipeline.
        if (j.needsClarification) {
          set({
            clarify: {
              question: j.question ?? "What should it do?",
              options: Array.isArray(j.options) ? j.options : [],
              description,
            },
          });
          return;
        }
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
      const scoped = Boolean(options.onlyNodeId || options.fromNodeId);
      // Replay-from-here: the node + its downstream descendants; upstream is seeded, not re-run.
      const subset = options.fromNodeId ? descendantsOf(p, options.fromNodeId) : null;
      const seedTables = scoped ? (get().tables.length ? get().tables : p.outputTables) : [];
      const prior = get().steps;
      const downstream = subset ? subset.size - 1 : 0;
      const replayNotice =
        options.fromNodeId && subset
          ? downstream > 0
            ? `Replaying this node and ${downstream} downstream node${downstream === 1 ? "" : "s"}.`
            : "Replaying this node."
          : null;

      // Step rows. onlyNodeId: just that node. fromNodeId: every node, with the downstream
      // subset reset to idle and upstream rows preserved so the timeline keeps its history.
      const steps: RunStep[] = options.onlyNodeId
        ? p.nodes
            .filter((n) => n.id === options.onlyNodeId)
            .map((n) => ({ nodeId: n.id, title: n.title, status: "idle", durationMs: 0 }))
        : p.nodes.map((n) => {
            if (!subset || subset.has(n.id))
              return { nodeId: n.id, title: n.title, status: "idle" as const, durationMs: 0 };
            return prior.find((s) => s.nodeId === n.id) ?? { nodeId: n.id, title: n.title, status: n.status, durationMs: 0 };
          });

      set({
        runStatus: "running",
        runError: null,
        runningNodeId: null,
        runningTeamId: null,
        runningAgentId: null,
        runStartedAt: new Date().toISOString(),
        finalOutput: null,
        activeRunTrace: null,
        // Preserve upstream traces/packets on a downstream replay; clear them on a full run.
        teamRunTraces: subset ? get().teamRunTraces.filter((t) => !subset.has(t.teamNodeId)) : [],
        agentRunTraces: subset ? get().agentRunTraces.filter((t) => !subset.has(t.teamNodeId)) : [],
        handoffPackets: subset ? get().handoffPackets.filter((pk) => !subset.has(pk.fromNodeId)) : [],
        packetWarnings: subset ? get().packetWarnings.filter((w) => !subset.has(w.fromNodeId)) : [],
        selectedPacketId: null,
        selectedTeamTraceId: null,
        tables: seedTables,
        panelTab: "run",
        panelOpen: true,
        steps,
        pipeline: applyStatuses(p, (n) => (subset && !subset.has(n.id) ? n.status : "idle")),
        notice: replayNotice,
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
          const p = get().pipeline;
          let trace = ev.runTrace ?? null;
          let newTake: Take | null = null;
          if (trace && p) {
            const evalResults = runEvals(p, trace);
            trace = { ...trace, evalResults };
            // Every full run becomes a Take; scoped re-runs (solo agent / single node / replay) don't.
            if (!options.onlyNodeId && !options.fromNodeId) {
              newTake = buildTake({ pipeline: p, trace, evalResults, mode: get().executionMode });
            }
          }
          set((s) => ({
            runStatus: ev.status,
            runningNodeId: null,
            runningTeamId: null,
            runningAgentId: null,
            finalOutput: ev.finalOutput ?? s.finalOutput,
            runError: ev.error ?? null,
            notice: newTake
              ? `Take saved: ${newTake.name} — ${newTake.overallScore ?? 0}/100`
              : ev.error ?? null,
            // A replay's trace covers only the re-run subset; keep the live-accumulated
            // state (upstream preserved + subset re-emitted) rather than overwriting with it.
            activeRunTrace: options.fromNodeId ? s.activeRunTrace : trace ?? s.activeRunTrace,
            teamRunTraces: options.fromNodeId ? s.teamRunTraces : trace?.teamRuns ?? s.teamRunTraces,
            agentRunTraces: options.fromNodeId ? s.agentRunTraces : trace?.agentRuns ?? s.agentRunTraces,
            handoffPackets: options.fromNodeId ? s.handoffPackets : trace?.packets ?? s.handoffPackets,
            packetWarnings: options.fromNodeId ? s.packetWarnings : trace?.packetWarnings ?? s.packetWarnings,
            takes: newTake ? [newTake, ...s.takes].slice(0, 60) : s.takes,
            activeTakeId: newTake ? newTake.id : s.activeTakeId,
          }));
          // Persist only full runs; scoped re-runs/replays don't overwrite the latest run.
          if (p && hasSupabase() && trace && !options.onlyNodeId && !options.fromNodeId) {
            void saveRun(trace);
            if (newTake) void saveTake(newTake);
          }
          get().refreshProduct();
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
            fromNodeId: options.fromNodeId,
            seedTables,
            mode: get().executionMode,
          }),
        });
        if (!res.ok || !res.body) {
          const j = await res.json().catch(() => ({}));
          // Billing gate (402): show the upgrade modal instead of a bare error.
          if (res.status === 402 && j.gate) {
            get().openUpgrade({ ...j.gate, title: "Out of credits" });
          }
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
