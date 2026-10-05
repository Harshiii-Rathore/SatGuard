# OrbitGuard

OrbitGuard is a deterministic Node.js/Express prototype of a cybersecurity gateway and modeled command-safety workflow for a simulated spacecraft. Its values and constraints are for hackathon demonstration only.

## Automated Verification

Run `npm run verify` from the project root. The verifier starts an isolated Express process on a temporary free port, exercises the registered HTTP endpoints, command/security/scenario workflows, state-mutation boundaries, and the frontend production build. It writes a machine-readable report to `verification/results/verification-results.json` and prints a human-readable summary.

`PASS` means the observed HTTP behavior matched the check. `FAIL` means a required contract or invariant did not hold and causes a non-zero exit code. `WARN` is non-critical; `SKIP` identifies behavior that cannot be configured through the public HTTP API. A failure includes a safe expected/actual summary for diagnosis; secrets and signatures are not reported.

Start the backend with `npm start`. For the dashboard, use `npm run dev` from `frontend/`.