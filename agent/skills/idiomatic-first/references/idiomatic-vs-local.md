# Idiomatic vs local: worked shapes

Read this when you have a candidate "more idiomatic" option and need to decide whether
it is actually worth raising, or when the choice is close enough that you are tempted
to take the safe way out.

## The four tests a candidate has to pass

1. **Is the alternative actually the documented pattern**, or your taste? Evidence:
   the library's own docs page and its source. If the docs show composition A and the
   repo does B, you have a case. If the docs show nothing and you merely prefer B, you
   do not.
2. **Does it delete code?** Idiomatic usually means less custom code. If your option
   only adds structure, it is over-engineering wearing a costume.
3. **Does anything actually depend on the current shape?** Tests, visual baselines,
   other call sites, another repo. Zero coverage is not "free to change" — it means a
   regression lands silently, which is a cost you have to price, not ignore.
4. **Would you defend it in six months?** Including the pixels and the churn.

## Worked example: hand-rolled group vs the documented composition

Situation: a sidebar renders sections as `<div class="mt-3">` plus a `<p>` label plus a
`role="list"` on the nav, with a comment saying "each group is a heading over a list of
links". The library ships `SidebarGroup` → `SidebarGroupLabel` + `SidebarGroupContent`,
and its docs say that is the shape. The prior PR deliberately avoided the components.

What a correct investigation looks like:

- Docs state the intended composition. That is evidence for the idiomatic shape.
- **Upstream source contradicts half the reasoning**: the label renders a `div`
  deliberately to avoid disturbing the page heading outline, and there are zero `role=`
  attributes anywhere in the file. So the `role="list"` claim is a local addition, not
  something upstream would do.
- Local facts decide the rest: neither app uses the components; both set a container
  padding class that would stack against the library's own per-group padding; the
  icon-collapse mode that the label's hiding logic serves is not enabled in either app.
- Read: this is a **consistency change, not an accessibility fix**. The accessibility
  argument that justified it does not survive contact with the source, because the label
  stays an anonymous `div` either way and the `role="list"` is hand-written in both
  versions.

Three options, correctly ordered, one recommendation:

1. Adopt the components (`Group` + `Label` + `Menu role="list"`), dropping the wrapper
   div and the hand-managed spacing. Most idiomatic; visibly different; no test or
   visual baseline covers the sidebar, so verification is a deliberate eyeball pass.
2. Keep the local shape, fix the comment (which misdescribes the code as a heading),
   and put the effort into the thing that is actually unresolved.
3. Adopt the components but override their padding/sizing to stay pixel-identical.

Recommendation: 1 if the visual pass is on the table, otherwise 2 — **and say that out
loud.** Option 3 is the one to refuse: idiomatic in name only, three overrides whose
only purpose is to keep a wash, permanently coupled to the library's internal spacing.

Failure mode to watch for in your own output: presenting 1, 2, 3 in that order and
then recommending 2 because it is cheapest to verify. Ordering by blast radius and
recommending the smallest is the exact bias this skill exists to break. If you cannot
recommend the better option, the honest output is "2, because X is unverified and I
will not reshape UI I cannot check" — not a menu that lets the human pick the outcome
you already think is wrong.

## Worked example: deriving state instead of syncing it

Asking a component to "keep the display name in sync with the `profile` prop" invites:

```tsx
const [name, setName] = useState(profile.name);
useEffect(() => setName(profile.name), [profile.name]);   // minimal diff
```

The idiomatic shape derives it — no state, no effect, no stale render. Note what this
has in common with the sidebar case: **the correct answer removes code.** When
"more idiomatic" means "more moving parts", suspect the diagnosis.

## Starter list: shape smells worth checking (verify per version)

Each of these has a documented alternative in most modern stacks. Confirm the installed
version supports it and read the docs before recommending.

| Smell | Usual idiomatic answer |
| --- | --- |
| Effect that only copies a prop/derived value into state | Derive it during render, or key the component to reset it |
| Manual cache/`Map` keyed by an argument | The framework's memo/loader/caching primitive |
| Hand-rolled fetch + loading + error state in each component | The data layer already in the repo (loader, `useQuery`, server component) |
| `try/catch` around a call that already returns a typed error | Let it propagate to the boundary that can act on it |
| Discriminated-union result tuples invented locally | The error convention already used across the repo |
| Deep `if` ladders selecting behaviour | A lookup table or the strategy the framework provides |
| Local wrapper around a third-party component that only forwards props | Use the component directly; add the wrapper when it earns behaviour |
| Manual CSS duplicating a component's documented composition | The composition in the docs; override only what is genuinely wrong |
| Per-file `AbortController` boilerplate | The client/request layer's cancellation, if one exists |

Treat this table as a prompt to go read, not as authority. It is wrong often.

## Cost accounting, done honestly

When comparing shapes, list what each one *adds to the maintenance load*, not just what
it adds to the diff:

- lines of custom code left behind (wrapper + its tests + its bug surface)
- coupling to internals you do not control (e.g. a library's spacing classes)
- invariants a future reader must hold in their head
- verification you owe but cannot automate

Then weigh against the risk of the change: unknown rendering behaviour, no test coverage,
visual or API churn. Both directions have real costs. Refusing an idiomatic change
because it needs an eyeball pass is legitimate — pretending it was never the better
shape is not.
