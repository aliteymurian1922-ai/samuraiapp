# Samurai stabilization changes

- Added production-safe `.gitignore` and removed TypeScript build cache from source.
- Replaced SVG favicon with raster PNG and updated Next.js metadata.
- Split auth cookie constants out of the DB-backed session module so Edge middleware no longer imports Node/DB/server-only code.
- Password reset now invalidates all active sessions for the user.
- Forgot-password API no longer exposes reset URLs in production.
- Replaced hard-coded `drizzle.config.json` with environment-driven `drizzle.config.ts`.
- Added database scripts, test scripts, Node engine requirement, and explicit `server-only` dependency.
- Added Vitest coverage for permissions, project risk scoring, and workload classification.
- Added project README with local setup and quality-control commands.

## Verification limitation

Dependency installation could not finish in the isolated execution environment because outbound package installation timed out. Run the following after cloning/pushing on a machine with npm registry access:

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run build
```
