// MTPLX-managed settings mirror. Remove this marker to take ownership.
export default function (pi: any) {
  let timer: any;
  let syncInFlight: any;
  let clientThinking: any;
  let sessionKey: any;

  const readSettings = async (ctx: any) => {
    const model = ctx.model;
    if (model?.provider !== "mtplx") {
      ctx.ui.setStatus("mtplx-controls", undefined);
      return;
    }
    try {
      const key = String(ctx.sessionManager.getSessionId()) + ":" + model.id;
      if (sessionKey !== key) {
        sessionKey = key;
        clientThinking = undefined;
      }
      const registry = ctx.modelRegistry;
      const auth = registry.getApiKeyAndHeaders
        ? await registry.getApiKeyAndHeaders(model)
        : { ok: true, apiKey: await registry.getApiKey(model) };
      if (!auth.ok) throw new Error(auth.error);
      const headers: any = {};
      for (const [name, value] of Object.entries({ ...model.headers, ...auth.headers })) {
        if (typeof value === "string") headers[name] = value;
      }
      if (auth.apiKey) headers.Authorization = "Bearer " + auth.apiKey;
      // Pi installs a global HTTP dispatcher whose idle connection reuse can
      // delay these small polls. Keep control-plane reads off pooled sockets.
      headers.Connection = "close";
      const base = String(auth.baseUrl || model.baseUrl).replace(/[/]+$/, "");
      const response = await fetch(base + "/mtplx/settings", {
        headers, signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error("settings HTTP " + response.status);
      const settings = await response.json();
      if (settings.managed_client_controls === "app") {
        const effort = settings.enable_thinking === false ? "off" : settings.reasoning_effort;
        if (!["off", "low", "medium", "high", "xhigh"].includes(effort)) {
          throw new Error("unsupported MTPLX reasoning effort: " + effort);
        }
        clientThinking ??= pi.getThinkingLevel();
        if (pi.getThinkingLevel() !== effort) pi.setThinkingLevel(effort);
        ctx.ui.setStatus("mtplx-controls", "MTPLX controls reasoning: " + effort);
      } else {
        if (clientThinking !== undefined) pi.setThinkingLevel(clientThinking);
        clientThinking = undefined;
        ctx.ui.setStatus("mtplx-controls", undefined);
      }
    } catch (error) {
      ctx.ui.setStatus("mtplx-controls", "MTPLX settings sync failed: " + String(error));
    }
  };
  const syncThinking = (ctx: any) => {
    syncInFlight ??= readSettings(ctx).finally(() => { syncInFlight = undefined; });
    return syncInFlight;
  };
  const startSync = async (_event: any, ctx: any) => {
    if (timer) clearInterval(timer);
    await syncThinking(ctx);
    timer = setInterval(() => { if (ctx.isIdle()) void syncThinking(ctx); }, 3000);
    timer.unref?.();
  };
  pi.on("session_start", startSync);
  pi.on("session_switch", startSync);
  pi.on("model_select", startSync);
  pi.on("before_agent_start", async (_event: any, ctx: any) => { await syncThinking(ctx); });
  pi.on("session_shutdown", () => { if (timer) clearInterval(timer); });

}
