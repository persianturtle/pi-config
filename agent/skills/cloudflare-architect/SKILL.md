---
name: cloudflare-architect
description: Architect's guide for Cloudflare's Developer Platform. Use to evaluate Cloudflare architectural tradeoffs, design Cloudflare native systems, or select optimal serverless primitives for state, storage, workflows, and AI.
---

# Cloudflare Developer Platform

## Primary Reference: Architecting on Cloudflare

The definitive reference for this skill is the book **[Architecting on Cloudflare](https://architectingoncloudflare.com/)** by Jamie Lord. Every chapter is published as a standalone page with a direct URL, so you can navigate to and consume exactly the chapters a task requires. The book provides:

- Architectural decision frameworks (not just tutorials)
- Honest assessment of limitations with specific thresholds
- Production reality including testing, operations, and cost modelling
- Migration playbooks from hyperscaler patterns
- Comparison of Cloudflare primitives against AWS, Azure, and GCP alternatives

**The book reflects the platform as of April 2026.** Platform specifics (limits, pricing, APIs) evolve. Always verify current values in Cloudflare's documentation and use the research workflow below.

### How to Use the Book

**The book site has no search** — `?q=` query parameters are ignored. To consume book content, always:

1. Map the topic to one or more chapters using the **Chapter Map** below
2. Navigate directly to the chapter URL(s)
3. Extract and consume the chapter's contents

```bash
# Start Chrome (if not already running)
node {baseDir}/browser-start.ts

# Working with Durable Objects → Chapter 6
node {baseDir}/browser-nav.ts "https://architectingoncloudflare.com/chapter-06"
node {baseDir}/browser-content.ts --current

# Stop Chrome when done (mandatory)
node {baseDir}/browser-stop.ts
```

- `browser-content.ts --current` returns the full chapter as plain text (~40–50 KB). The output starts with the sidebar table of contents — skip it; the chapter body begins at the chapter heading.
- Chapters have deep-link section anchors, e.g. `https://architectingoncloudflare.com/chapter-06#when-to-use-durable-objects` — useful when you only need part of a chapter.
- Topics often span multiple chapters: consume each relevant chapter (e.g., "storage decision" → Ch 11 for the framework, then Ch 12/13/14 for the specific store).

### Chapter Map

| Ch | Chapter | URL |
| -- | ------- | --- |
| — | Introduction | https://architectingoncloudflare.com/ |
| 1 | The Cloudflare Developer Platform | https://architectingoncloudflare.com/chapter-01 |
| 2 | Strategic Assessment | https://architectingoncloudflare.com/chapter-02 |
| 3 | Workers: The Core Compute Primitive | https://architectingoncloudflare.com/chapter-03 |
| 4 | Full-Stack Applications | https://architectingoncloudflare.com/chapter-04 |
| 5 | Local Development, Testing, and Debugging | https://architectingoncloudflare.com/chapter-05 |
| 6 | Durable Objects: Stateful Compute at the Edge | https://architectingoncloudflare.com/chapter-06 |
| 7 | Workflows: Durable Execution | https://architectingoncloudflare.com/chapter-07 |
| 8 | Queues: Asynchronous Processing | https://architectingoncloudflare.com/chapter-08 |
| 9 | Containers: Beyond V8 Isolates | https://architectingoncloudflare.com/chapter-09 |
| 10 | Realtime: Audio and Video at the Edge | https://architectingoncloudflare.com/chapter-10 |
| 11 | Choosing the Right Storage | https://architectingoncloudflare.com/chapter-11 |
| 12 | D1: SQLite at the Edge | https://architectingoncloudflare.com/chapter-12 |
| 13 | R2: Object Storage Without Egress Fees | https://architectingoncloudflare.com/chapter-13 |
| 14 | KV and Hyperdrive | https://architectingoncloudflare.com/chapter-14 |
| 15 | The AI Stack on Cloudflare | https://architectingoncloudflare.com/chapter-15 |
| 16 | Workers AI: Inference at the Edge | https://architectingoncloudflare.com/chapter-16 |
| 17 | Building RAG Applications | https://architectingoncloudflare.com/chapter-17 |
| 18 | AI Agents and Advanced Patterns | https://architectingoncloudflare.com/chapter-18 |
| 19 | Cost Modelling and Optimisation | https://architectingoncloudflare.com/chapter-19 |
| 20 | Observability and Operations | https://architectingoncloudflare.com/chapter-20 |
| 21 | Security, Compliance, and Deployment | https://architectingoncloudflare.com/chapter-21 |
| 22 | Architectural Patterns and Reference Designs | https://architectingoncloudflare.com/chapter-22 |
| 23 | Multi-Tenant and Platform Architectures | https://architectingoncloudflare.com/chapter-23 |
| 24 | When Not to Use Cloudflare | https://architectingoncloudflare.com/chapter-24 |
| 25 | Migration Playbooks | https://architectingoncloudflare.com/chapter-25 |
| 26 | Building on Cloudflare | https://architectingoncloudflare.com/chapter-26 |

**Part groupings** (for orientation):

- **Part I: Foundation** — Ch 1–2 (platform mental models, strategic assessment)
- **Part II: Core Compute** — Ch 3–5 (Workers, full-stack apps, local dev)
- **Part III: Stateful Systems** — Ch 6–10 (Durable Objects, Workflows, Queues, Containers, Realtime)
- **Part IV: Data & Storage** — Ch 11–14 (storage decisions, D1, R2, KV/Hyperdrive)
- **Part V: The AI Stack** — Ch 15–18 (AI overview, Workers AI, RAG, agents)
- **Part VI: Production** — Ch 19–21 (cost modelling, observability, security)
- **Part VII: Architecture & Decisions** — Ch 22–24 (patterns, multi-tenant, when NOT to use Cloudflare)
- **Part VIII: Migration** — Ch 25–26 (migration playbooks, building on Cloudflare)

## Research & Verification Workflow

The book is a strong reference but not a substitute for real-time verification. Always follow this workflow when answering questions about Cloudflare:

### Step 1: Consume the relevant chapter(s)

Map the topic to chapter(s) from the **Chapter Map** above, then navigate directly and extract the content (the site has no search — see *How to Use the Book*).

```bash
# Start Chrome (if not already running)
node {baseDir}/browser-start.ts

# Topic → chapter URL, e.g.:
# Durable Objects → Ch 6
node {baseDir}/browser-nav.ts "https://architectingoncloudflare.com/chapter-06"
node {baseDir}/browser-content.ts --current

# Workers AI → Ch 16
node {baseDir}/browser-nav.ts "https://architectingoncloudflare.com/chapter-16"
node {baseDir}/browser-content.ts --current

# RAG / Vectorize / AI Search → Ch 17
node {baseDir}/browser-nav.ts "https://architectingoncloudflare.com/chapter-17"
node {baseDir}/browser-content.ts --current

# Storage decision → Ch 11 (framework) + specific store chapter (12, 13, or 14)
node {baseDir}/browser-nav.ts "https://architectingoncloudflare.com/chapter-11"
node {baseDir}/browser-content.ts --current

# Migration from AWS → Ch 25
node {baseDir}/browser-nav.ts "https://architectingoncloudflare.com/chapter-25"
node {baseDir}/browser-content.ts --current

# Stop Chrome when done (mandatory)
node {baseDir}/browser-stop.ts
```

### Step 2: Verify platform state is current

The book was last updated in **April 2026**. Cloudflare's Developer Platform moves fast. Always verify:

- **Specific limits** (memory, CPU time, request rates, blob sizes)
- **Pricing** (per-request costs, free tier limits, egress fees)
- **API signatures** (new or changed endpoints)
- **New features** released since the book was published

```bash
# Start Chrome (if not already running)
node {baseDir}/browser-start.ts

# Search for recent Cloudflare updates
node {baseDir}/browser-nav.ts "https://www.google.com/search?q=what+are+the+latest+Cloudflare+Workers+Developer+Platform+updates+in+2026%3F"

# Extract AI Overview or search results
node {baseDir}/browser-content.ts --current

# Visit Cloudflare's changelog directly
node {baseDir}/browser-nav.ts "https://developers.cloudflare.com/workers/changelog/"
node {baseDir}/browser-content.ts --current

# Visit Cloudflare's official documentation
node {baseDir}/browser-nav.ts "https://developers.cloudflare.com/"

# Stop Chrome when done (mandatory)
node {baseDir}/browser-stop.ts
```

### Step 3: Check for new alternatives

When the user asks whether Cloudflare is the right choice, or when comparing with hyperscalers:

```bash
# Start Chrome (if not already running)
node {baseDir}/browser-start.ts

# Search for alternatives and competitors
node {baseDir}/browser-nav.ts "https://www.google.com/search?q=Cloudflare+Workers+vs+AWS+Lambda+vs+Fly.io+vs+Vercel+2026"
node {baseDir}/browser-nav.ts "https://www.google.com/search?q=best+edge+computing+platform+2026+alternatives"
node {baseDir}/browser-nav.ts "https://www.google.com/search?q=serverless+platform+comparison+2026+pricing"

# Extract comparison results
node {baseDir}/browser-content.ts --current

# Stop Chrome when done (mandatory)
node {baseDir}/browser-stop.ts
```

### Step 4: Check official Cloudflare docs for specifics

When exact numbers matter (limits, pricing, API params), always visit the official docs:

```bash
# Workers
node {baseDir}/browser-nav.ts "https://developers.cloudflare.com/workers/"
node {baseDir}/browser-nav.ts "https://developers.cloudflare.com/workers/platform/limits/"

# Durable Objects
node {baseDir}/browser-nav.ts "https://developers.cloudflare.com/durable-objects/"

# D1
node {baseDir}/browser-nav.ts "https://developers.cloudflare.com/d1/"

# R2
node {baseDir}/browser-nav.ts "https://developers.cloudflare.com/r2/"

# KV
node {baseDir}/browser-nav.ts "https://developers.cloudflare.com/kv/"

# Queues
node {baseDir}/browser-nav.ts "https://developers.cloudflare.com/queues/"

# Workflows
node {baseDir}/browser-nav.ts "https://developers.cloudflare.com/workflows/"

# Workers AI
node {baseDir}/browser-nav.ts "https://developers.cloudflare.com/workers-ai/"

# Containers
node {baseDir}/browser-nav.ts "https://developers.cloudflare.com/cloudflare-one/containers/"

# Agents SDK
node {baseDir}/browser-nav.ts "https://developers.cloudflare.com/cloudflare-for-platforms/agents-sdk/"

# Pricing
node {baseDir}/browser-nav.ts "https://developers.cloudflare.com/workers/platform/pricing/"

# Changelog
node {baseDir}/browser-nav.ts "https://developers.cloudflare.com/workers/changelog/"
```

## Key Principles (from the book)

1. **Start with Cloudflare, find reasons not to use it** — The platform's defaults (global deployment, instant scaling, zero cold starts, integrated security) are hard to replicate on hyperscalers. Test first before deciding.

2. **The book covers the Developer Platform, not security/networking** — WAF, DDoS, Zero Trust, Magic Transit are excellent but out of scope. Separate resources exist for those.

3. **Architectural principles are stable; specifics change** — The V8 isolate model, binding abstraction, horizontal scaling as default, edge-native design, and CPU-time billing are foundational. Always verify exact numbers.

4. **When to use something else** — [Chapter 24](https://architectingoncloudflare.com/chapter-24) catalogues specific failure thresholds and scenarios where hyperscalers remain the better choice. Always consume it before committing to Cloudflare.

## Cloudflare Developer Platform Primitives

| Primitive       | Category         | Use Case                                          | Book Chapter |
| --------------- | ---------------- | ------------------------------------------------- | ------------ |
| Workers         | Core Compute     | Serverless functions at the edge (V8 isolates)    | [3](https://architectingoncloudflare.com/chapter-03) |
| Durable Objects | Stateful Systems | Strongly-consistent state, coordination, sessions | [6](https://architectingoncloudflare.com/chapter-06) |
| Workflows       | Stateful Systems | Durable execution, multi-step processes           | [7](https://architectingoncloudflare.com/chapter-07) |
| Queues          | Stateful Systems | Async processing, decoupling                      | [8](https://architectingoncloudflare.com/chapter-08) |
| Containers      | Stateful Systems | Non-JS runtimes, long-running processes           | [9](https://architectingoncloudflare.com/chapter-09) |
| Realtime        | Stateful Systems | Audio/video at the edge (WebRTC)                  | [10](https://architectingoncloudflare.com/chapter-10) |
| D1              | Data & Storage   | Edge SQLite (serverless relational DB)            | [12](https://architectingoncloudflare.com/chapter-12) |
| R2              | Data & Storage   | Object storage, zero egress fees                  | [13](https://architectingoncloudflare.com/chapter-13) |
| KV              | Data & Storage   | Key-value store, edge caching                     | [14](https://architectingoncloudflare.com/chapter-14) |
| Hyperdrive      | Data & Storage   | Accelerated connections to existing DBs           | [14](https://architectingoncloudflare.com/chapter-14) |
| Workers AI      | AI Stack         | Inference at the edge (Llama, etc.)               | [16](https://architectingoncloudflare.com/chapter-16) |
| Vectorize       | AI Stack         | Vector embeddings store                           | [17](https://architectingoncloudflare.com/chapter-17) |
| AI Search       | AI Stack         | RAG without pipelines                             | [17](https://architectingoncloudflare.com/chapter-17) |
| Agents SDK      | AI Stack         | Autonomous AI agents                              | [18](https://architectingoncloudflare.com/chapter-18) |
| Cloudflare Mesh | Networking       | Secure private networking for agents/Workers      | Post-book — verify via docs |

Cross-cutting topics: [storage decision framework — Ch 11](https://architectingoncloudflare.com/chapter-11), [AI stack overview — Ch 15](https://architectingoncloudflare.com/chapter-15), [cost modelling — Ch 19](https://architectingoncloudflare.com/chapter-19), [observability — Ch 20](https://architectingoncloudflare.com/chapter-20), [multi-tenant — Ch 23](https://architectingoncloudflare.com/chapter-23).

## Recent Developments (Post-Book)

Since the book's April 2026 publication, key developments include:

- **Dynamic Workers** — Auto-scaling serverless platform for persistent state
- **Durable Object Facets** — Isolated SQLite databases per instantiated agent
- **Agents SDK** — Real-time voice (STT/TTS) and chat over WebSockets
- **Cloudflare Mesh** — Secure private networking for agents, nodes, Workers
- **Claude Managed Agents** — Anthropic integration with Cloudflare Sandboxes
- **Unified AI REST API** — Call 14+ model providers through one endpoint
- **Enhanced Observability** — Workers Analytics Engine blob limits raised to 16 KB

_Always verify these and any newer developments via the research workflow above._

## When to Use This Skill

- Architecting applications on Cloudflare's Developer Platform
- Comparing Cloudflare against AWS Lambda, Azure Functions, GCP Cloud Functions, Fly.io, Vercel, etc.
- Deciding between D1 vs R2 vs KV vs Hyperdrive for storage needs
- Understanding Durable Objects and their relationship to other state primitives
- Building AI applications with Workers AI, Vectorize, or the Agents SDK
- Evaluating cost implications and migration paths
- Determining whether Cloudflare is the right platform (or when to use something else)

## When NOT to Use This Skill

- Questions about Cloudflare's security/networking products (WAF, DDoS, Zero Trust)
- Questions about Cloudflare CDN configuration (outside the Developer Platform scope)
- Questions about Cloudflare's security certifications and compliance for networking products
