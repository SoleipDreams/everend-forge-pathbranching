import { useEffect, useRef, useState } from "react";
import type { BranchingProject } from "../domain.js";
import type { ProjectFileState } from "../projectPersistence.js";
import { exportBridgeBundleDialog } from "../projectPersistence.js";
import { buildEverendOfflineBundle } from "../bridgeBundle.js";
import {
  DEFAULT_EVEREND_BRIDGE_SETTINGS,
  EverendBridgeClient,
  getEverendBridgeSession,
  normalizeBridgeEndpoint,
  startEverendBridgeService,
  statusEverendBridgeService,
  stopEverendBridgeService,
  type EverendBridgeSettings,
  type EverendBridgeSession,
  type EverendBridgeStatus,
} from "../everendBridge.js";

const SETTINGS_KEY = "everend.pathbranching.bridge";

function loadSettings(): EverendBridgeSettings {
  try { return { ...DEFAULT_EVEREND_BRIDGE_SETTINGS, ...JSON.parse(window.localStorage.getItem(SETTINGS_KEY) ?? "{}") as Partial<EverendBridgeSettings> }; } catch { return DEFAULT_EVEREND_BRIDGE_SETTINGS; }
}

function saveSettings(settings: EverendBridgeSettings): void {
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function projectStoryId(project?: BranchingProject): string {
  return project?.storyId ?? "active-story";
}

type EverendBridgeServerState = "unknown" | "offline" | "online";
type EverendBridgeTab = "dashboard" | "connection" | "sync";

export function EverendBridgePanel({ project, fileState }: { project?: BranchingProject; fileState: ProjectFileState }) {
  const [settings, setSettings] = useState<EverendBridgeSettings>(() => loadSettings());
  const [activeTab, setActiveTab] = useState<EverendBridgeTab>("dashboard");
  const [status, setStatus] = useState<EverendBridgeStatus>({ state: "disconnected", message: "Disconnected.", revision: 0 });
  const [serverState, setServerState] = useState<EverendBridgeServerState>("offline");
  const [serverMessage, setServerMessage] = useState("Not checked yet.");
  const [session, setSession] = useState<EverendBridgeSession>();
  const [pairingCode, setPairingCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string>();
  const client = useRef<EverendBridgeClient | undefined>(undefined);

  useEffect(() => {
    saveSettings({ ...settings });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => client.current?.disconnect(), []);

  useEffect(() => {
    if (!settings.autoSync || status.state !== "connected" || !project || settings.mode !== "live") return;
    const timer = window.setTimeout(() => {
      try { client.current?.publishSnapshot(project); setNotice("Auto-sync snapshot sent."); }
      catch (error) { setNotice(error instanceof Error ? error.message : String(error)); }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [project, settings.autoSync, settings.mode, status.state]);

  const update = <K extends keyof EverendBridgeSettings>(key: K, value: EverendBridgeSettings[K]) => {
    setSettings((current) => { const next = { ...current, [key]: value }; saveSettings(next); return next; });
  };

  const refresh = async (endpointOverride?: string) => {
    setBusy(true);
    try {
      const current = await getEverendBridgeSession(endpointOverride ?? settings.endpoint);
      setSession(current);
      setServerState("online");
      setServerMessage(`Listening on ${current.endpoint}.`);
      setNotice("Bridge session refreshed.");
    } catch (error) {
      setServerState("offline");
      setServerMessage("The local daemon is not reachable.");
      setNotice(error instanceof Error ? error.message : String(error));
    }
    finally { setBusy(false); }
  };

  const adoptServiceResult = (result: { output?: string; message?: string }) => {
    if (!result.output) return undefined;
    try {
      const remote = JSON.parse(result.output) as { endpoint?: string };
      if (remote.endpoint) { update("endpoint", remote.endpoint); return remote.endpoint; }
    } catch { /* status output can be a human-readable error */ }
    return undefined;
  };

  const connect = async (endpointOverride?: string) => {
    if (!project) { setNotice("Open a PathBranching story before connecting the narrative author."); return; }
    setBusy(true);
    const endpoint = endpointOverride ?? settings.endpoint;
    try {
      const nextClient = client.current ?? new EverendBridgeClient();
      client.current = nextClient;
      await nextClient.connect({ endpoint, projectId: project.projectId, storyId: projectStoryId(project), pairingCode: pairingCode || undefined, autoReconnect: true, onStatus: (nextStatus) => { setStatus(nextStatus); if (nextStatus.state === "connected") { setServerState("online"); setServerMessage(`Listening on ${endpoint}.`); } else if (nextStatus.state === "disconnected" || nextStatus.state === "error") { setServerState("offline"); setServerMessage("The server or PathBranching connection is offline."); } }, onMessage: (message) => { if (message.messageType === "welcome" || message.messageType === "heartbeat") void refresh(endpoint); if (message.messageType === "inventory" || message.messageType === "changeSet" || message.messageType === "validationReport" || message.messageType === "applyResult") setNotice(`Unity ${message.messageType} received; review is required before changing PathBranching narrative data.`); } });
      setSession(nextClient.currentSession);
      setServerState("online");
      setServerMessage(`Listening on ${nextClient.currentSession?.endpoint ?? endpoint}.`);
      if (settings.autoSync) nextClient.publishSnapshot(project);
      setNotice(settings.autoSync ? "Connected and initial snapshot sent." : "Connected. Use Publish snapshot to send the current story.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setServerState("offline");
      setServerMessage(message);
      setNotice(message);
    }
    finally { setBusy(false); }
  };

  const start = async () => {
    setBusy(true);
    try {
      try {
        const running = await getEverendBridgeSession(settings.endpoint);
        setSession(running);
        setServerState("online");
        setServerMessage(`Listening on ${running.endpoint}.`);
        if (project) await connect(running.endpoint);
        else setNotice("Bridge already running. Open a story to connect PathBranching.");
        return;
      } catch { /* start the bundled sidecar below */ }
      const result = await startEverendBridgeService({ executable: settings.daemonExecutable, port: Number(new URL(normalizeBridgeEndpoint(settings.endpoint)).port || 47831), showTerminal: settings.showTerminal, projectId: project?.projectId, storyId: projectStoryId(project) });
      setNotice(result.message || "Bridge service started.");
      setServerState("unknown");
      setServerMessage("Start requested. Checking the daemon…");
      await new Promise((resolve) => window.setTimeout(resolve, 350));
      const discoveredEndpoint = adoptServiceResult(result);
      await refresh(discoveredEndpoint);
      if (project) await connect(discoveredEndpoint);
      else setNotice("Daemon started. Open a story to connect PathBranching.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setServerState("offline");
      setServerMessage(message);
      setNotice(message);
    }
    finally { setBusy(false); }
  };

  const stop = async () => {
    setBusy(true);
    try {
      const result = await stopEverendBridgeService({ executable: settings.daemonExecutable, port: Number(new URL(normalizeBridgeEndpoint(settings.endpoint)).port || 47831) });
      client.current?.disconnect();
      setStatus({ state: "disconnected", message: "Disconnected.", revision: 0 });
      setServerState("offline");
      setServerMessage("The daemon was stopped.");
      setNotice(result.message || "Bridge service stopped.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setServerMessage(message);
      setNotice(message);
    }
    finally { setBusy(false); }
  };

  const toggleService = async () => {
    if (serverState === "online") await stop();
    else await start();
  };

  const disconnect = () => {
    client.current?.disconnect();
    setStatus({ state: "disconnected", message: "Disconnected.", revision: status.revision });
    setServerState("offline");
    setServerMessage("PathBranching is disconnected from the daemon.");
  };

  const check = async () => {
    setBusy(true);
    try {
      const current = await getEverendBridgeSession(settings.endpoint);
      setSession(current);
      setServerState("online");
      setServerMessage(`Listening on ${current.endpoint}.`);
      setNotice("Bridge server is online.");
    } catch (directError) {
      try {
        const result = await statusEverendBridgeService(Number(new URL(normalizeBridgeEndpoint(settings.endpoint)).port || 47831));
        const discoveredEndpoint = adoptServiceResult(result);
        setNotice(result.message || "Bridge status checked.");
        await refresh(discoveredEndpoint);
      } catch {
        setServerState("offline");
        setServerMessage("The local daemon is not reachable.");
        setNotice(directError instanceof Error ? directError.message : String(directError));
      }
    }
    finally { setBusy(false); }
  };

  useEffect(() => {
    void check();
    // The dashboard should reflect an already-running daemon as soon as it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const publish = () => {
    if (!project) { setNotice("Open a PathBranching story before publishing."); return; }
    try { client.current?.publishSnapshot(project); setNotice("Snapshot queued for Unity."); }
    catch (error) { setNotice(error instanceof Error ? error.message : String(error)); }
  };

  const exportBundle = async () => {
    if (!project) { setNotice("Open a PathBranching story before exporting a bundle."); return; }
    setBusy(true);
    try { const result = await exportBridgeBundleDialog(buildEverendOfflineBundle(project, settings.profileId)); setNotice(result?.message ?? `Offline bundle exported to ${result?.path ?? "selected folder"}.`); }
    catch (error) { setNotice(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  };

  const statusLabel = serverState === "online" ? "Servidor activo" : serverState === "unknown" ? "Comprobando servidor" : "Servidor apagado";
  const statusButtonLabel = serverState === "online" ? "Activo" : serverState === "unknown" ? "Comprobando…" : "Apagado";
  const connectionLabel = status.state === "connected" ? "Conectado" : status.state === "connecting" || status.state === "reconnecting" ? "Conectando" : "Desconectado";

  return <section className="settings-subsection everend-bridge-panel">
    <div className="settings-page-title compact">
      <h3>Everend Forge Bridge</h3>
      <p>Controla el daemon local y la conexión entre PathBranching y Unity.</p>
    </div>
    <div className="bridge-tabs" role="tablist" aria-label="Everend Forge Bridge sections">
      <button type="button" className={activeTab === "dashboard" ? "active" : ""} onClick={() => setActiveTab("dashboard")} role="tab" aria-selected={activeTab === "dashboard"}>Dashboard</button>
      <button type="button" className={activeTab === "connection" ? "active" : ""} onClick={() => setActiveTab("connection")} role="tab" aria-selected={activeTab === "connection"}>Connection</button>
      <button type="button" className={activeTab === "sync" ? "active" : ""} onClick={() => setActiveTab("sync")} role="tab" aria-selected={activeTab === "sync"}>Sync</button>
    </div>

    {activeTab === "dashboard" ? <div className="bridge-dashboard-tab">
      <div className={`bridge-server-card ${serverState}`}>
        <div className="bridge-server-copy">
          <span className="bridge-eyebrow">Estado del servidor</span>
          <strong>{statusLabel}</strong>
          <small>{serverMessage}</small>
        </div>
        <span className={`bridge-server-status ${serverState}`}><span className="bridge-server-dot" aria-hidden="true" /> {statusButtonLabel}</span>
      </div>
      <button type="button" className={`bridge-service-toggle ${serverState === "online" ? "stop" : "start"}`} onClick={() => void toggleService()} disabled={busy}>
        {serverState === "online" ? "Stop service" : "Start service"}
      </button>
    </div> : null}

    {activeTab === "connection" ? <div className="bridge-tab-panel">
      <div className="settings-grid">
        <label><span>Mode</span><select value={settings.mode} onChange={(event) => update("mode", event.target.value as EverendBridgeSettings["mode"])}><option value="live">Live</option><option value="manual">Manual export</option></select></label>
        <label><span>Endpoint</span><input value={settings.endpoint} onChange={(event) => update("endpoint", event.target.value)} /></label>
        <label><span>Daemon executable</span><input value={settings.daemonExecutable} onChange={(event) => update("daemonExecutable", event.target.value)} placeholder="Path to everend-forge-bridge executable" /></label>
        <label><span>Profile</span><input value={settings.profileId} onChange={(event) => update("profileId", event.target.value)} /></label>
        <label><span>Project ID</span><input value={project?.projectId ?? "No project loaded"} readOnly /></label>
        <label><span>Story ID</span><input value={project?.storyId ?? "No story loaded"} readOnly /></label>
        <label><span>Show daemon terminal</span><input type="checkbox" checked={settings.showTerminal} onChange={(event) => update("showTerminal", event.target.checked)} /></label>
      </div>
      <div className="bridge-connection-row">
        <span className={`bridge-connection-pill ${status.state}`}><span className="bridge-connection-dot" aria-hidden="true" /> Conexión: {connectionLabel}</span>
        <span className="bridge-connection-detail">{status.message} · revisión {status.revision}</span>
      </div>
      <div className="bridge-actions">
        <button type="button" onClick={check} disabled={busy}>Refresh status</button>
        <button type="button" className="bridge-primary-action" onClick={() => void connect()} disabled={busy || settings.mode !== "live"}>Connect</button>
        <button type="button" onClick={disconnect} disabled={status.state === "disconnected"}>Disconnect</button>
      </div>
      <div className="settings-grid">
        <label><span>Unity pairing code</span><input value={pairingCode} onChange={(event) => setPairingCode(event.target.value)} placeholder="Only needed when configured by the daemon" /></label>
        <label><span>Session</span><input value={session?.sessionId ?? "Not loaded"} readOnly /></label>
        <label><span>Connected clients</span><input value={session?.connectedClients.map((client) => `${client.role}:${client.clientId}`).join(", ") || "None"} readOnly /></label>
        <label><span>Remote revision</span><input value={session?.revision ?? "Unknown"} readOnly /></label>
      </div>
      {notice ? <p className="bridge-status-note">{notice}</p> : null}
    </div> : null}

    {activeTab === "sync" ? <div className="bridge-tab-panel">
      <div className="settings-grid">
        <label><span>Auto-sync snapshot</span><input type="checkbox" checked={settings.autoSync} onChange={(event) => update("autoSync", event.target.checked)} /></label>
        <label><span>Output root</span><input value={settings.outputRoot} onChange={(event) => update("outputRoot", event.target.value)} /></label>
        <label><span>Locale</span><input value={settings.locale} onChange={(event) => update("locale", event.target.value)} /></label>
        <label><span>Source folder</span><input value={fileState.universePath ?? "Not opened"} readOnly /></label>
      </div>
      <div className="bridge-actions">
        <button type="button" className="bridge-primary-action" onClick={publish} disabled={status.state !== "connected" || !project}>Publish snapshot</button>
        <button type="button" onClick={() => void exportBundle()} disabled={busy || !project}>Export offline bundle</button>
      </div>
      {notice ? <p className="bridge-status-note">{notice}</p> : null}
    </div> : null}
  </section>;
}
