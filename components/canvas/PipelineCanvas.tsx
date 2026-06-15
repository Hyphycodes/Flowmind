"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { usePipelineStore } from "@/store/pipelineStore";
import { hexFor } from "@/lib/ui/colors";
import { SOURCE_MODE_LABEL } from "@/lib/datasets/sourceModes";
import { contractStatusColor } from "@/lib/contracts/check";
import { resolveTeamView, layoutAgents } from "@/lib/pipeline/teamView";
import { AgentNode } from "./AgentNode";
import { DataEdge } from "./DataEdge";
import { FloatingCanvasControls } from "./FloatingCanvasControls";

const nodeTypes = { agent: AgentNode };
const edgeTypes = { data: DataEdge };

const MEMBER_ACCENTS = ["violet", "blue", "teal", "green", "orange", "pink", "cyan"] as const;
const NON_MERGEABLE = new Set(["input", "output"]);

function Flow() {
  const pipeline = usePipelineStore((s) => s.pipeline);
  const datasets = usePipelineStore((s) => s.datasets);
  const selectedNodeId = usePipelineStore((s) => s.selectedNodeId);
  const runStatus = usePipelineStore((s) => s.runStatus);
  const runningNodeId = usePipelineStore((s) => s.runningNodeId);
  const runningAgentId = usePipelineStore((s) => s.runningAgentId);
  const agentRunTraces = usePipelineStore((s) => s.agentRunTraces);
  const teamPath = usePipelineStore((s) => s.teamPath);
  const selectNode = usePipelineStore((s) => s.selectNode);
  const setNodePosition = usePipelineStore((s) => s.setNodePosition);
  const enterTeam = usePipelineStore((s) => s.enterTeam);
  const exitTeam = usePipelineStore((s) => s.exitTeam);
  const closeInspector = usePipelineStore((s) => s.closeInspector);
  const mergeNodeIntoTeam = usePipelineStore((s) => s.mergeNodeIntoTeam);
  const undo = usePipelineStore((s) => s.undo);
  const rf = useReactFlow();
  const [tool, setTool] = useState<"select" | "pan">("pan");
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const pathKey = teamPath.join(">");
  const view = useMemo(() => resolveTeamView(pipeline, teamPath), [pipeline, teamPath]);
  const inTeam = view.team != null;
  const teamId = view.crumbs[view.crumbs.length - 1]?.id;

  const statusSig = pipeline ? pipeline.nodes.map((n) => `${n.id}:${n.status}`).join("|") : "";
  const nodeList = pipeline?.nodes;
  const datasetSig = datasets.map((d) => `${d.id}:${d.rows.length}:${d.qualityScore ?? ""}`).join("|");
  const agentSig = agentRunTraces.map((t) => `${t.teamNodeId}:${t.agentId}:${t.status}`).join("|");

  const nodes: Node[] = useMemo(() => {
    if (!pipeline) return [];

    // Inside a team → render the team's agents as nodes (ephemeral layered layout).
    if (inTeam && view.team) {
      const agents = view.team.agents;
      const pos = layoutAgents(agents, view.team.internalEdges);
      let memberIdx = 0;
      return agents.map((a) => {
        const color = a.isController ? "violet" : MEMBER_ACCENTS[memberIdx++ % MEMBER_ACCENTS.length];
        const status =
          runningAgentId === a.id
            ? "running"
            : [...agentRunTraces].reverse().find((t) => t.teamNodeId === teamId && t.agentId === a.id)?.status ?? "idle";
        return {
          id: a.id,
          type: "agent",
          position: pos[a.id] ?? { x: 0, y: 0 },
          data: {
            id: a.id,
            type: "agent",
            title: a.name || a.role || a.id,
            role: a.role,
            description: a.role,
            color,
            status,
            inputs: [],
            outputs: [],
            isController: a.isController,
            controllerKind: a.controllerKind,
            dropTarget: false,
          },
          selected: a.id === selectedNodeId,
        };
      });
    }

    return pipeline.nodes.map((n) => {
      let sourceBadge: { label: string; meta: string } | undefined;
      if (n.source) {
        const ds = n.source.datasetId ? datasets.find((d) => d.id === n.source!.datasetId) : undefined;
        const rows = ds ? ds.rows.length : n.source.rowCount;
        const quality = ds?.qualityScore;
        const parts = [rows != null ? `${rows} rows` : null, quality != null ? `${quality}%` : null].filter(Boolean);
        sourceBadge = { label: SOURCE_MODE_LABEL[n.source.mode], meta: parts.join(" · ") };
      }
      return {
        id: n.id,
        type: "agent",
        position: n.position,
        data: { ...(n as unknown as Record<string, unknown>), sourceBadge, dropTarget: n.id === dropTargetId },
        selected: n.id === selectedNodeId,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeList, statusSig, selectedNodeId, datasetSig, pathKey, dropTargetId, agentSig, runningAgentId]);

  const edges: Edge[] = useMemo(() => {
    if (!pipeline) return [];

    if (inTeam && view.team) {
      const ids = new Set(view.team.agents.map((a) => a.id));
      return (view.team.internalEdges ?? [])
        .filter((e) => ids.has(e.source) && ids.has(e.target))
        .map((e, i) => ({
          id: `ie-${e.source}-${e.target}-${i}`,
          source: e.source,
          target: e.target,
          type: "data",
          data: { color: "#8b5cf6", animated: false },
        }));
    }

    const statusOf = new Map(pipeline.nodes.map((n) => [n.id, n.status]));
    return pipeline.edges.map((e) => {
      const src = pipeline.nodes.find((n) => n.id === e.source);
      const color = hexFor({ color: src?.color, type: src?.type });
      const animated =
        runStatus === "running" &&
        (statusOf.get(e.source) === "success" || e.target === runningNodeId || statusOf.get(e.target) === "running");
      const cStatus = e.contract?.status;
      const contractColor =
        cStatus === "ok"
          ? contractStatusColor("passing")
          : cStatus === "warning"
            ? contractStatusColor("warning")
            : cStatus === "error"
              ? contractStatusColor("failing")
              : undefined;
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        type: "data",
        data: { color, label: e.label, animated, contractColor },
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipeline?.edges, runStatus, runningNodeId, statusSig, pathKey]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      for (const c of changes) {
        if (c.type === "position" && c.position) setNodePosition(c.id, c.position);
      }
    },
    [setNodePosition],
  );

  // Drag-to-merge (top level only): highlight the hovered target, merge on drop.
  const onNodeDrag = useCallback(
    (_: unknown, n: Node) => {
      if (teamPath.length !== 0) return;
      const hits = rf
        .getIntersectingNodes({ id: n.id })
        .filter((h) => h.id !== n.id && !NON_MERGEABLE.has((h.data as { type?: string })?.type ?? ""));
      setDropTargetId(hits[0]?.id ?? null);
    },
    [rf, teamPath.length],
  );

  const onNodeDragStop = useCallback(
    (_: unknown, n: Node) => {
      if (teamPath.length === 0 && dropTargetId && dropTargetId !== n.id) {
        mergeNodeIntoTeam(n.id, dropTargetId);
      }
      setDropTargetId(null);
    },
    [dropTargetId, mergeNodeIntoTeam, teamPath.length],
  );

  const onNodeDoubleClick = useCallback(
    (_: unknown, n: Node) => {
      const node = teamPath.length === 0 ? pipeline?.nodes.find((x) => x.id === n.id) : undefined;
      if (node?.team) enterTeam(n.id);
      else void rf.fitView({ nodes: [{ id: n.id }], duration: 420, maxZoom: 1.4 });
    },
    [enterTeam, pipeline?.nodes, rf, teamPath.length],
  );

  // Keyboard: Esc exits a team (or closes the popover/inspector); ⌘/Ctrl+Z undoes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const editing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (editing) return;
      if (e.key === "Escape") {
        if (teamPath.length > 0) exitTeam();
        else if (selectedNodeId) selectNode(null);
        else closeInspector();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [teamPath.length, selectedNodeId, exitTeam, selectNode, closeInspector, undo]);

  return (
    <>
      {view.crumbs.length > 0 && <Breadcrumb />}
      <motion.div
        key={pathKey}
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="h-full w-full"
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={() => {}}
          onNodeClick={(_, n) => selectNode(n.id)}
          onNodeDoubleClick={onNodeDoubleClick}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          onPaneClick={() => selectNode(null)}
          fitView
          fitViewOptions={{ padding: 0.28, maxZoom: 1 }}
          minZoom={0.2}
          maxZoom={2.4}
          panOnDrag={tool === "pan"}
          selectionOnDrag={tool === "select"}
          zoomOnDoubleClick={false}
          proOptions={{ hideAttribution: true }}
          className="!bg-transparent"
        >
          <Background variant={BackgroundVariant.Dots} gap={26} size={1} color="#ffffff14" />
          <MiniMap
            position="bottom-left"
            pannable
            zoomable
            className="!mb-[64px] !ml-4 !rounded-xl"
            style={{ width: 196, height: 128, background: "#0b0b13", border: "1px solid #ffffff14" }}
            maskColor="rgba(7,7,12,0.72)"
            nodeColor={(n) => hexFor({ color: (n.data as { color?: string }).color, type: (n.data as { type?: string }).type })}
            nodeStrokeWidth={0}
            nodeBorderRadius={6}
          />
          <FloatingCanvasControls tool={tool} setTool={setTool} />
        </ReactFlow>
      </motion.div>
    </>
  );
}

function Breadcrumb() {
  const pipeline = usePipelineStore((s) => s.pipeline);
  const teamPath = usePipelineStore((s) => s.teamPath);
  const setTeamPath = usePipelineStore((s) => s.setTeamPath);
  const view = useMemo(() => resolveTeamView(pipeline, teamPath), [pipeline, teamPath]);

  return (
    <div className="absolute left-4 top-4 z-20 flex items-center gap-0.5 rounded-full px-2 py-1 text-[12px] glass-strong fm-fade-up">
      <button onClick={() => setTeamPath([])} className="rounded px-1.5 py-0.5 text-ink-dim transition hover:text-ink">
        Pipeline
      </button>
      {view.crumbs.map((c, i) => (
        <span key={c.id} className="flex items-center gap-0.5">
          <ChevronRight size={12} className="text-ink-faint" />
          <button
            onClick={() => setTeamPath(teamPath.slice(0, i + 1))}
            className={i === view.crumbs.length - 1 ? "rounded px-1.5 py-0.5 font-medium text-ink" : "rounded px-1.5 py-0.5 text-ink-dim transition hover:text-ink"}
          >
            {c.label}
          </button>
        </span>
      ))}
    </div>
  );
}

export function PipelineCanvas() {
  return (
    <div className="flow-canvas relative h-full w-full">
      <ReactFlowProvider>
        <Flow />
      </ReactFlowProvider>
    </div>
  );
}
