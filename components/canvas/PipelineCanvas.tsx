"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import { usePipelineStore } from "@/store/pipelineStore";
import { hexFor } from "@/lib/ui/colors";
import { SOURCE_MODE_LABEL } from "@/lib/datasets/sourceModes";
import { contractStatusColor } from "@/lib/contracts/check";
import { AgentNode } from "./AgentNode";
import { DataEdge } from "./DataEdge";
import { FloatingCanvasControls } from "./FloatingCanvasControls";

const nodeTypes = { agent: AgentNode };
const edgeTypes = { data: DataEdge };

function Flow() {
  const pipeline = usePipelineStore((s) => s.pipeline);
  const datasets = usePipelineStore((s) => s.datasets);
  const selectedNodeId = usePipelineStore((s) => s.selectedNodeId);
  const runStatus = usePipelineStore((s) => s.runStatus);
  const runningNodeId = usePipelineStore((s) => s.runningNodeId);
  const selectNode = usePipelineStore((s) => s.selectNode);
  const setNodePosition = usePipelineStore((s) => s.setNodePosition);
  const [tool, setTool] = useState<"select" | "pan">("pan");

  const statusSig = pipeline ? pipeline.nodes.map((n) => `${n.id}:${n.status}`).join("|") : "";
  const nodeList = pipeline?.nodes;
  const datasetSig = datasets.map((d) => `${d.id}:${d.rows.length}:${d.qualityScore ?? ""}`).join("|");

  const nodes: Node[] = useMemo(() => {
    if (!pipeline) return [];
    return pipeline.nodes.map((n) => {
      let sourceBadge: { label: string; meta: string } | undefined;
      if (n.source) {
        const ds = n.source.datasetId ? datasets.find((d) => d.id === n.source!.datasetId) : undefined;
        const rows = ds ? ds.rows.length : n.source.rowCount;
        const quality = ds?.qualityScore;
        const parts = [
          rows != null ? `${rows} rows` : null,
          quality != null ? `${quality}%` : null,
        ].filter(Boolean);
        sourceBadge = { label: SOURCE_MODE_LABEL[n.source.mode], meta: parts.join(" · ") };
      }
      return {
        id: n.id,
        type: "agent",
        position: n.position,
        data: { ...(n as unknown as Record<string, unknown>), sourceBadge },
        selected: n.id === selectedNodeId,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeList, statusSig, selectedNodeId, datasetSig]);

  const edges: Edge[] = useMemo(() => {
    if (!pipeline) return [];
    const statusOf = new Map(pipeline.nodes.map((n) => [n.id, n.status]));
    return pipeline.edges.map((e) => {
      const src = pipeline.nodes.find((n) => n.id === e.source);
      const color = hexFor({ color: src?.color, type: src?.type });
      const animated =
        runStatus === "running" &&
        (statusOf.get(e.source) === "success" ||
          e.target === runningNodeId ||
          statusOf.get(e.target) === "running");
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
  }, [pipeline?.edges, runStatus, runningNodeId, statusSig]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      for (const c of changes) {
        if (c.type === "position" && c.position) setNodePosition(c.id, c.position);
      }
    },
    [setNodePosition],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={() => {}}
      onNodeClick={(_, n) => selectNode(n.id)}
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
        nodeColor={(n) => hexFor({ color: (n.data as any)?.color, type: (n.data as any)?.type })}
        nodeStrokeWidth={0}
        nodeBorderRadius={6}
      />
      <FloatingCanvasControls tool={tool} setTool={setTool} />
    </ReactFlow>
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
