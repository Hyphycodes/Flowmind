<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Flowmind

See [CLAUDE.md](./CLAUDE.md) for the full agent guide.

**Product principle:** the app is not a dashboard — it's an open canvas for composing
intelligence. "Damn, I can see the brain."

**Primary loop (never break):** Describe → Generate/Open Pipeline → Render Canvas → Run →
Fill Output Tables → Update UI Preview → Autosave → Export.

**Architecture:** schema-first (Zod, `lib/pipeline/schema.ts`), canvas consumes pipeline
JSON, generation + runs use real Claude server-side via the AI SDK
(`app/api/generate-pipeline`, `app/api/run`), output tables are first-class, persistence
via Supabase. A `PipelineNode` carries an optional `team` for future multi-agent nodes —
don't remove it.
