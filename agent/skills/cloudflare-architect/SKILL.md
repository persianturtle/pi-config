---
name: cloudflare-architect
description: Architect's guide for Cloudflare's Developer Platform. Use to evaluate Cloudflare architectural tradeoffs, design Cloudflare native systems, or select optimal serverless primitives for state, storage, workflows, and AI.
---

# Cloudflare Developer Platform

## Primary Reference: Architecting on Cloudflare

The definitive reference for this skill is the book **[Architecting on Cloudflare](https://architectingoncloudflare.com/)** by Jamie Lord. The entire book is searchable online and provides:

- Architectural decision frameworks (not just tutorials)
- Honest assessment of limitations with specific thresholds
- Production reality including testing, operations, and cost modelling
- Migration playbooks from hyperscaler patterns
- Comparison of Cloudflare primitives against AWS, Azure, and GCP alternatives

**The book reflects the platform as of April 2026.** Platform specifics (limits, pricing, APIs) evolve. Always verify current values in Cloudflare's documentation and use the research workflow below.

### Book Structure

| Part                          | Topic                                                       | Chapters |
| ----------------------------- | ----------------------------------------------------------- | -------- |
| I: Foundation                 | Platform mental models, strategic assessment                | 1–2      |
| II: Core Compute              | Workers, full-stack apps, local dev                         | 3–5      |
| III: Stateful Systems         | Durablef Objects, Workflows, Queues, Containers, Realtime   | 6–10     |
| IV: Data & Storage            | D1, R2, KV, Hyperdrive, storage decisions                   | 11–14    |
| V: The AI Stack               | Workers AI, Vectorize, RAG, Agents SDK                      | 15–18    |
| VI: Production                | Cost modelling, observability, security                     | 19–21    |
| VII: Architecture & Decisions | Patterns, multi-tenant, when NOT to use Cloudflare          | 22–24    |
| VIII: Migration               | Playbooks from AWS Lambda, containers, traditional backends | 25–26    |

## Research & Verification Workflow

The book is a strong reference but not a substitute for real-time verification. Always follow this workflow when answering questions about Cloudflare:

### Step 1: Search the book for relevant content

Use **browser-tools** to search the book for the specific topic. The book's search is searchable — try keyword-based queries first.

```bash
# Start Chrome (if not already running)
node {baseDir}/browser-start.ts

# Search the book for a specific topic
node {baseDir}/browser-nav.ts "https://architectingoncloudflare.com/?q=workers"
node {baseDir}/browser-nav.ts "https://architectingoncloudflare.com/?q=durable+objects"
node {baseDir}/browser-nav.ts "https://architectingoncloudflare.com/?q=r2+storage"
node {baseDir}/browser-nav.ts "https://architectingoncloudflare.com/?q=workers+ai"
node {baseDir}/browser-nav.ts "https://architectingoncloudflare.com/?q=d1+database"

# Extract relevant content from search results
node {baseDir}/browser-content.ts --current

# Stop Chrome when done (mandatory)
node {baseDir}/browser-stop.ts
```

If the book search doesn't yield enough detail, navigate directly to relevant chapters.

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

4. **When to use something else** — Chapter 24 of the book catalogues specific failure thresholds and scenarios where hyperscalers remain the better choice. Always check this before committing to Cloudflare.

## Cloudflare Developer Platform Primitives

| Primitive       | Category         | Use Case                                          |
| --------------- | ---------------- | ------------------------------------------------- |
| Workers         | Core Compute     | Serverless functions at the edge (V8 isolates)    |
| Durable Objects | Stateful Systems | Strongly-consistent state, coordination, sessions |
| Workflows       | Stateful Systems | Durable execution, multi-step processes           |
| Queues          | Stateful Systems | Async processing, decoupling                      |
| Containers      | Stateful Systems | Non-JS runtimes, long-running processes           |
| Realtime        | Stateful Systems | Audio/video at the edge (WebRTC)                  |
| D1              | Data & Storage   | Edge SQLite (serverless relational DB)            |
| R2              | Data & Storage   | Object storage, zero egress fees                  |
| KV              | Data & Storage   | Key-value store, edge caching                     |
| Hyperdrive      | Data & Storage   | Accelerated connections to existing DBs           |
| Workers AI      | AI Stack         | Inference at the edge (Llama, etc.)               |
| Vectorize       | AI Stack         | Vector embeddings store                           |
| AI Search       | AI Stack         | RAG without pipelines                             |
| Agents SDK      | AI Stack         | Autonomous AI agents                              |
| Cloudflare Mesh | Networking       | Secure private networking for agents/Workers      |

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
