import { useEffect, useRef, useState } from "react";
import { api } from "./services/api.js";

const INITIAL_LOADING = {
  health: true,
  spacecraft: true,
  queue: true,
  held: true,
  events: true,
  quarantine: true,
  scenarios: true,
  plan: true,
};

function App() {
  const [health, setHealth] = useState(null);
  const [spacecraft, setSpacecraft] = useState(null);
  const [queue, setQueue] = useState(null);
  const [held, setHeld] = useState(null);
  const [events, setEvents] = useState(null);
  const [quarantine, setQuarantine] = useState(null);
  const [scenarios, setScenarios] = useState(null);
  const [queuePlan, setQueuePlan] = useState(null);
  const [latestRun, setLatestRun] = useState(null);
  const [loading, setLoading] = useState(INITIAL_LOADING);
  const [errors, setErrors] = useState({});
  const [runningScenario, setRunningScenario] = useState(null);
  const [resetting, setResetting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actionError, setActionError] = useState("");
  const mounted = useRef(false);

  async function refreshAll() {
    setRefreshing(true);
    await Promise.all([
      loadSection("health", api.getHealth, setHealth),
      loadSection("spacecraft", api.getSpacecraftState, setSpacecraft),
      loadSection("queue", api.getQueue, setQueue),
      loadSection("held", api.getHeldCommands, setHeld),
      loadSection("events", api.getSecurityEvents, setEvents),
      loadSection("quarantine", api.getQuarantine, setQuarantine),
      loadSection("scenarios", api.getScenarios, setScenarios),
      loadSection("plan", api.getQueuePlan, setQueuePlan),
    ]);
    setRefreshing(false);
  }

  async function loadSection(key, load, setValue) {
    setLoading((current) => ({ ...current, [key]: true }));
    try {
      const value = await load();
      if (mounted.current) {
        setValue(value);
        setErrors((current) => ({ ...current, [key]: "" }));
      }
    } catch (error) {
      if (mounted.current) {
        setErrors((current) => ({ ...current, [key]: error.message }));
      }
    } finally {
      if (mounted.current) {
        setLoading((current) => ({ ...current, [key]: false }));
      }
    }
  }

  useEffect(() => {
    mounted.current = true;
    void refreshAll();
    return () => {
      mounted.current = false;
    };
  }, []);

  async function runScenario(scenario) {
    setRunningScenario(scenario.id);
    setActionError("");
    try {
      const result = await api.runScenario(scenario.id);
      setLatestRun(result);
      await refreshAll();
    } catch (error) {
      setActionError(error.message);
    } finally {
      setRunningScenario(null);
    }
  }

  async function resetDemo() {
    if (!window.confirm("Reset local OrbitGuard prototype state? This clears in-memory demo state.")) {
      return;
    }

    setResetting(true);
    setActionError("");
    try {
      await api.resetDemo();
      setLatestRun(null);
      await refreshAll();
    } catch (error) {
      setActionError(error.message);
    } finally {
      setResetting(false);
    }
  }

  const latestResult = latestRun ? resolvePrimaryResult(latestRun) : null;
  const gatewayOnline = health?.status === "ok";

  return (
    <main className="app-shell">
      <Header
        online={gatewayOnline}
        loading={loading.health}
        error={errors.health}
        refreshing={refreshing}
        resetting={resetting}
        onRefresh={refreshAll}
        onReset={resetDemo}
      />

      {actionError && <div className="action-alert" role="alert">{actionError}</div>}

      <section className="status-section" aria-label="Spacecraft status">
        <SectionHeading eyebrow="FLIGHT SYSTEMS" title="Spacecraft state" meta="LIVE API SNAPSHOT" />
        <SpacecraftStatus state={spacecraft} loading={loading.spacecraft} error={errors.spacecraft} />
      </section>

      <section className="operations-grid">
        <div className="primary-column">
          <DecisionPanel run={latestRun} result={latestResult} />
          <ScenarioPanel
            scenarios={scenarios}
            loading={loading.scenarios}
            error={errors.scenarios}
            runningScenario={runningScenario}
            activeScenarioId={latestRun?.scenario?.id}
            onRun={runScenario}
          />
          <CommandQueue commands={queue} loading={loading.queue} error={errors.queue} />
          <SecurityEvents events={events} loading={loading.events} error={errors.events} />
        </div>

        <aside className="secondary-column">
          <SecurityChecks result={latestResult} />
          <ConsequencePanel result={latestResult} />
          <PlannerPanel result={latestResult} fallbackPlan={queuePlan} loading={loading.plan} error={errors.plan} />
          <HeldCommands commands={held} loading={loading.held} error={errors.held} />
          <QuarantinePanel commands={quarantine} loading={loading.quarantine} error={errors.quarantine} />
        </aside>
      </section>

      <footer className="app-footer">
        <span>ORBITGUARD / MISSION SECURITY OPERATIONS</span>
        <span>SIMULATED STATE · LOCAL PROTOTYPE</span>
      </footer>
    </main>
  );
}

function Header({ online, loading, error, refreshing, resetting, onRefresh, onReset }) {
  return (
    <header className="topbar">
      <div className="brand-lockup">
        <div className="brand-mark" aria-hidden="true"><span>OG</span></div>
        <div>
          <div className="brand-name">ORBIT<span>GUARD</span></div>
          <div className="brand-subtitle">Mission Security Operations Center</div>
        </div>
      </div>
      <div className="topbar-right">
        <div className={`connection-state ${online ? "is-online" : loading ? "is-pending" : "is-offline"}`}>
          <span className="connection-dot" />
          <span>{loading ? "CHECKING API" : online ? "GATEWAY ONLINE" : "CONNECTION LOST"}</span>
          {error && <span className="connection-detail">{error}</span>}
        </div>
        <span className="prototype-tag">PROTOTYPE / SIMULATION</span>
        <button className="button button-quiet" type="button" onClick={onRefresh} disabled={refreshing}>
          <RefreshGlyph />{refreshing ? "Refreshing" : "Refresh"}
        </button>
        <button className="button button-reset" type="button" onClick={onReset} disabled={resetting}>
          {resetting ? "Resetting" : "Reset demo"}
        </button>
      </div>
    </header>
  );
}

function SectionHeading({ eyebrow, title, meta }) {
  return (
    <div className="section-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h2>{title}</h2>
      </div>
      {meta && <span className="section-meta">{meta}</span>}
    </div>
  );
}

function SpacecraftStatus({ state, loading, error }) {
  if (loading && !state) return <div className="loading-block">Loading spacecraft state...</div>;
  if (!state) return <div className="empty-block">{error || "Spacecraft state unavailable"}</div>;

  const metrics = [
    { label: "Battery", value: state.battery, unit: "%", kind: "meter" },
    { label: "Fuel", value: state.fuel, unit: "%", kind: "meter" },
    { label: "Temperature", value: state.temperature, unit: "°C" },
    { label: "Mode", value: state.mode, kind: "mode" },
    { label: "Radio", value: state.radio },
    { label: "Antenna", value: state.antenna },
    { label: "Camera", value: state.camera },
    { label: "Orientation", value: state.orientation },
    { label: "Mission phase", value: state.missionPhase },
    { label: "Images captured", value: state.imagesCaptured },
  ].filter((metric) => metric.value !== undefined && metric.value !== null);

  return (
    <div className="status-grid">
      {metrics.map((metric) => (
        <div className={`status-tile ${metric.kind === "mode" ? "status-mode" : ""}`} key={metric.label}>
          <span className="tile-label">{metric.label}</span>
          <strong className="tile-value">{metric.value}{metric.unit ?? ""}</strong>
          {metric.kind === "meter" && (
            <span className="meter-track"><span style={{ width: `${Math.min(100, Math.max(0, Number(metric.value)))}%` }} /></span>
          )}
        </div>
      ))}
      {error && <div className="inline-warning">Refresh failed: {error}</div>}
    </div>
  );
}

function DecisionPanel({ run, result }) {
  if (!run || !result) {
    return (
      <section className="panel decision-panel decision-empty">
        <div className="panel-topline"><span className="eyebrow">LATEST GATEWAY EVALUATION</span><span className="live-label">AWAITING INPUT</span></div>
        <div className="decision-empty-content">
          <span className="empty-glyph">—</span>
          <div><h2>No command evaluated</h2><p>Run a demo scenario to see a real security and operational decision.</p></div>
        </div>
      </section>
    );
  }

  const decision = result.decision ?? "UNKNOWN";
  const tone = decisionTone(decision);
  const signals = result.signals ?? [];
  const plan = result.planner;
  const safeAlternative = plan?.status === "SAFE_REORDER_FOUND";

  return (
    <section className={`panel decision-panel decision-${tone}`}>
      <div className="panel-topline">
        <span className="eyebrow">LATEST GATEWAY EVALUATION</span>
        <span className="decision-level">{result.level ?? "LEVEL UNAVAILABLE"}</span>
      </div>
      <div className="decision-main">
        <div className={`decision-icon decision-icon-${tone}`} aria-hidden="true">{decisionGlyph(decision)}</div>
        <div className="decision-copy">
          <div className="decision-kicker">{run.scenario?.name?.replaceAll("_", " ") ?? "COMMAND DECISION"}</div>
          <h1>{decision.replaceAll("_", " ")}</h1>
          <p>{result.reason ?? "No decision reason returned"}</p>
        </div>
        <div className="decision-command">
          <span>COMMAND</span>
          <strong>{result.command?.type ?? "Unavailable"}</strong>
          <code>{result.command?.id ?? "No command ID"}</code>
        </div>
      </div>

      {safeAlternative && (
        <div className="reorder-callout">
          <span className="signal-mark">↕</span>
          <div>
            <strong>Unsafe sequence detected — safe execution order found</strong>
            <span>{plan.plannedOrder?.map((item) => item.type).join("  →  ")}</span>
          </div>
          <span className="callout-state">HELD</span>
        </div>
      )}

      {signals.length > 0 && (
        <div className="signal-row">
          {signals.map((signal, index) => <SignalPill signal={signal} key={`${signal.type}-${index}`} />)}
        </div>
      )}
      {run.verification && (
        <div className={`scenario-verification ${run.verification.passed ? "passed" : "failed"}`}>
          <span>{run.verification.passed ? "SCENARIO MATCHED POLICY" : "SCENARIO DID NOT MATCH EXPECTED BEHAVIOR"}</span>
          {!run.verification.passed && <span>{run.verification.checks.filter((check) => !check.passed).map((check) => check.name).join(" · ")}</span>}
        </div>
      )}
    </section>
  );
}

function SecurityChecks({ result }) {
  const checks = result?.security?.checks;
  const stages = [
    ["Authentication", checks?.authentication],
    ["Authorization", checks?.authorization],
    ["Integrity / HMAC", checks?.integrity],
    ["Replay protection", checks?.replay],
  ];

  return (
    <section className="panel compact-panel">
      <PanelHeading title="Security checks" eyebrow="TRUST PIPELINE" />
      {!checks ? <div className="empty-inline">Waiting for command evaluation</div> : (
        <div className="check-list">
          {stages.map(([label, check]) => <CheckRow key={label} label={label} check={check} />)}
        </div>
      )}
    </section>
  );
}

function CheckRow({ label, check }) {
  const passed = check?.passed === true;
  const failed = check?.passed === false;
  const state = passed ? "PASS" : failed ? "FAIL" : "NOT RUN";
  return (
    <div className={`check-row ${passed ? "check-pass" : failed ? "check-fail" : "check-idle"}`}>
      <span className="check-symbol" aria-hidden="true">{passed ? "✓" : failed ? "×" : "·"}</span>
      <span className="check-name">{label}</span>
      <strong>{state}</strong>
    </div>
  );
}

function ConsequencePanel({ result }) {
  const consequence = result?.consequence;
  if (!consequence) {
    return <PanelEmpty title="Consequence analysis" eyebrow="MODELED OUTCOME" message="No consequence result for the latest evaluation." />;
  }

  const isSafe = consequence.safe === true;
  const metrics = [
    ["Battery", consequence.initialState?.battery, consequence.finalState?.battery, "%"],
    ["Fuel", consequence.initialState?.fuel, consequence.finalState?.fuel, "%"],
    ["Temperature", consequence.initialState?.temperature, consequence.finalState?.temperature, "°C"],
  ].filter(([, initial, final]) => initial !== undefined || final !== undefined);

  return (
    <section className="panel compact-panel consequence-panel">
      <PanelHeading title="Consequence analysis" eyebrow="MODELED OUTCOME" />
      <div className={`safety-banner ${isSafe ? "safe" : "unsafe"}`}>
        <span>{isSafe ? "✓" : "!"}</span>
        <div><strong>{isSafe ? "SAFE UNDER MODELED CONSTRAINTS" : "UNSAFE CONSEQUENCE"}</strong><small>Prototype policy analysis only</small></div>
      </div>
      {metrics.length > 0 && (
        <div className="state-deltas">
          {metrics.map(([label, initial, final, unit]) => (
            <div className="state-delta" key={label}>
              <span>{label}</span>
              <strong>{formatValue(initial, unit)} <i>→</i> {formatValue(final, unit)}</strong>
            </div>
          ))}
        </div>
      )}
      <div className="simulation-steps">
        <div className="mini-heading">SIMULATED COMMANDS <span>{consequence.steps?.length ?? 0}</span></div>
        {consequence.steps?.length ? consequence.steps.map((step, index) => (
          <div className="simulation-step" key={`${step.order}-${step.command?.id ?? index}`}>
            <span className={`step-state ${step.success ? "success" : "failure"}`}>{step.success ? "✓" : "×"}</span>
            <div><strong>{step.command?.type ?? "Unknown command"}</strong><small>{step.result?.message ?? step.error?.message ?? "No result message"}</small></div>
            <span className="step-order">{step.order}</span>
          </div>
        )) : <div className="empty-inline">No simulated steps returned</div>}
      </div>
      {consequence.violations?.length > 0 && (
        <div className="violation-list">
          {consequence.violations.map((violation, index) => <div className="violation" key={`${violation.code}-${index}`}><strong>{violation.code}</strong><span>{violation.message}</span></div>)}
        </div>
      )}
    </section>
  );
}

function PlannerPanel({ result, fallbackPlan, loading, error }) {
  const planner = result?.planner ?? fallbackPlan;
  if (!planner) return <PanelEmpty title="Execution planner" eyebrow="ORDER ANALYSIS" message={loading ? "Loading planner result..." : error || "No planner result available"} />;

  const statusText = {
    SAFE_AS_IS: "Current order is safe",
    SAFE_REORDER_FOUND: "Safe alternative found",
    NO_SAFE_PLAN: "No safe execution order found",
    PLANNING_LIMIT_EXCEEDED: "Queue exceeds prototype planning limit",
    INVALID_INPUT: "Planner input is invalid",
  }[planner.status] ?? planner.status ?? "Planner status unavailable";
  const order = (items) => items?.length
    ? items.map((item) => item.type ?? "Unknown").join(" → ")
    : "No commands in sequence";

  return (
    <section className="panel compact-panel planner-panel">
      <PanelHeading title="Execution planner" eyebrow="ORDER ANALYSIS" />
      <div className={`planner-status ${planner.status === "SAFE_REORDER_FOUND" ? "warning" : planner.status === "NO_SAFE_PLAN" ? "danger" : planner.status === "SAFE_AS_IS" ? "good" : "neutral"}`}>
        <span>{planner.status === "SAFE_REORDER_FOUND" ? "↕" : planner.status === "NO_SAFE_PLAN" ? "×" : planner.status === "SAFE_AS_IS" ? "✓" : "!"}</span>
        <strong>{statusText}</strong>
      </div>
      {planner.status === "PLANNING_LIMIT_EXCEEDED" && planner.currentOrderSafe && <p className="planner-note">The original order is safe; the planner did not search beyond its configured limit.</p>}
      <div className="order-block">
        <span>CURRENT ORDER</span><p>{order(planner.originalOrder)}</p>
      </div>
      {planner.plannedOrder && planner.status !== "SAFE_AS_IS" && (
        <div className="order-block recommended">
          <span>SAFE ALTERNATIVE</span><p>{order(planner.plannedOrder)}</p>
        </div>
      )}
      {planner.reason && <p className="planner-reason">{planner.reason}</p>}
    </section>
  );
}

function CommandQueue({ commands, loading, error }) {
  return (
    <section className="panel list-panel">
      <PanelHeading title="Command queue" eyebrow="PENDING EXECUTION" count={commands?.length} />
      {loading && !commands ? <div className="loading-block">Loading command queue...</div> : error && !commands ? <div className="empty-block">{error}</div> : !commands?.length ? <div className="empty-block">No pending commands</div> : (
        <div className="table-scroll">
          <table>
            <thead><tr><th>Order</th><th>Command</th><th>Status</th><th>Command ID</th><th>Created</th></tr></thead>
            <tbody>{commands.map((command) => (
              <tr key={command.id}>
                <td className="mono">{command.sequence ?? "—"}</td>
                <td className="command-type">{command.type}</td>
                <td><StatusTag value={command.status} /></td>
                <td className="mono id-cell">{command.id}</td>
                <td className="time-cell">{formatDate(command.createdAt)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {error && commands && <div className="inline-warning">Refresh failed: {error}</div>}
    </section>
  );
}

function HeldCommands({ commands, loading, error }) {
  return (
    <section className="panel compact-panel held-panel">
      <PanelHeading title="Held for review" eyebrow="NO AUTO-APPROVAL" count={commands?.length} />
      {loading && !commands ? <div className="loading-block">Loading held commands...</div> : error && !commands ? <div className="empty-inline">{error}</div> : !commands?.length ? <div className="empty-inline">No commands currently held</div> : (
        <div className="record-list">
          {commands.map((item) => (
            <article className="record-item" key={item.id}>
              <div className="record-title"><strong>{item.type}</strong><StatusTag value={item.status} /></div>
              <span className="mono record-id">{item.id}</span>
              <p>{item.holdDetails?.reason ?? "Held for review"}</p>
              <small>Operator: {item.holdDetails?.operatorId ?? "Unavailable"} · {formatDate(item.holdDetails?.heldAt ?? item.createdAt)}</small>
              {item.holdDetails?.planner?.plannedOrder && <small className="record-plan">Plan: {item.holdDetails.planner.plannedOrder.map((command) => command.type).join(" → ")}</small>}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function QuarantinePanel({ commands, loading, error }) {
  return (
    <section className="panel compact-panel quarantine-panel">
      <PanelHeading title="Quarantined commands" eyebrow="ISOLATED RECORDS" count={commands?.length} />
      {loading && !commands ? <div className="loading-block">Loading quarantine...</div> : error && !commands ? <div className="empty-inline">{error}</div> : !commands?.length ? <div className="empty-inline">No quarantined commands</div> : (
        <div className="record-list">
          {commands.map((item) => (
            <article className="record-item" key={item.id}>
              <div className="record-title"><strong>{item.command?.type ?? item.commandId ?? "Unidentified request"}</strong><StatusTag value="QUARANTINED" /></div>
              <span className="mono record-id">{item.commandId ?? "No command ID"}</span>
              <p>{item.reason}</p>
              <small>Operator: {item.operatorId ?? "Unknown"} · {formatDate(item.timestamp)}</small>
              {item.signals?.length > 0 && <small className="record-plan">{item.signals.map((signal) => signal.type).join(" · ")}</small>}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function SecurityEvents({ events, loading, error }) {
  return (
    <section className="panel list-panel events-panel">
      <PanelHeading title="Security events" eyebrow="INCIDENT TIMELINE" count={events?.length} />
      {loading && !events ? <div className="loading-block">Loading security events...</div> : error && !events ? <div className="empty-block">{error}</div> : !events?.length ? <div className="empty-block">No security events recorded</div> : (
        <div className="event-list">
          {events.map((event) => (
            <article className="event-row" key={event.id}>
              <div className="event-time">{formatDate(event.timestamp)}</div>
              <span className={`severity-marker severity-${String(event.severity ?? "info").toLowerCase()}`} />
              <div className="event-main">
                <div className="event-title"><strong>{event.type?.replaceAll("_", " ") ?? "EVENT"}</strong><StatusTag value={event.severity} /></div>
                <p>{event.message}</p>
                <small>{event.operatorId ?? "Unknown operator"}{event.commandId ? ` · ${event.commandId}` : ""}{event.decision ? ` · ${event.decision}` : ""}</small>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function ScenarioPanel({ scenarios, loading, error, runningScenario, activeScenarioId, onRun }) {
  return (
    <section className="panel scenario-panel">
      <div className="scenario-heading">
        <PanelHeading title="Demo scenarios" eyebrow="LOCAL PROTOTYPE CONTROLS" />
        <span className="scenario-reset-note">Each run starts from a deterministic baseline</span>
      </div>
      {loading && !scenarios ? <div className="loading-block">Loading scenarios...</div> : error && !scenarios ? <div className="empty-block">{error}</div> : !scenarios?.length ? <div className="empty-block">No scenarios returned by backend</div> : (
        <div className="scenario-grid">
          {scenarios.map((scenario) => (
            <button
              className={`scenario-card ${scenario.category === "OPERATIONAL_SAFETY" ? "scenario-hero" : ""} ${activeScenarioId === scenario.id ? "scenario-active" : ""}`}
              type="button"
              key={scenario.id}
              onClick={() => onRun(scenario)}
              disabled={Boolean(runningScenario)}
            >
              <span className="scenario-category">{scenario.category}</span>
              <strong>{scenario.title}</strong>
              <span className="scenario-description">{scenario.description}</span>
              <span className="scenario-action">{runningScenario === scenario.id ? "Running scenario…" : activeScenarioId === scenario.id ? "Run again ↗" : "Run scenario ↗"}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function PanelHeading({ title, eyebrow, count }) {
  return (
    <div className="panel-heading">
      <div><div className="eyebrow">{eyebrow}</div><h2>{title}</h2></div>
      {count !== undefined && <span className="panel-count">{count}</span>}
    </div>
  );
}

function PanelEmpty({ title, eyebrow, message }) {
  return <section className="panel compact-panel"><PanelHeading title={title} eyebrow={eyebrow} /><div className="empty-inline">{message}</div></section>;
}

function SignalPill({ signal }) {
  return <span className={`signal-pill severity-${String(signal.severity ?? "medium").toLowerCase()}`} title={signal.message}>{signal.type?.replaceAll("_", " ") ?? "SIGNAL"}</span>;
}

function StatusTag({ value }) {
  const normalized = String(value ?? "UNKNOWN").toUpperCase();
  return <span className={`status-tag status-${normalized.toLowerCase().replaceAll("_", "-")}`}>{normalized.replaceAll("_", " ")}</span>;
}

function resolvePrimaryResult(run) {
  const result = run.result;
  if (result?.replaySubmission) return result.replaySubmission;
  if (result?.submissions?.length) return result.submissions[result.submissions.length - 1];
  if (result?.restrictedPing) return result.restrictedPing;
  if (result?.permittedSafetyCommand && result.restrictedPing) return result.restrictedPing;
  if (result?.firstSubmission && result?.replaySubmission) return result.replaySubmission;
  return result;
}

function decisionTone(decision) {
  if (["ALLOW"].includes(decision)) return "good";
  if (["WATCH", "HOLD"].includes(decision)) return "warning";
  if (["QUARANTINE", "RESTRICTED", "SAFE_MODE", "REJECTED"].includes(decision)) return "danger";
  return "neutral";
}

function decisionGlyph(decision) {
  if (decision === "ALLOW") return "✓";
  if (decision === "WATCH" || decision === "HOLD") return "!";
  if (["QUARANTINE", "RESTRICTED", "SAFE_MODE", "REJECTED"].includes(decision)) return "×";
  return "·";
}

function formatDate(value) {
  if (!value) return "Time unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "medium" }).format(date);
}

function formatValue(value, unit) {
  return value === undefined || value === null ? "—" : `${value}${unit}`;
}

function RefreshGlyph() {
  return <span className="refresh-glyph" aria-hidden="true">↻</span>;
}

export default App;