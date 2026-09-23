# Unloop

Interrupt doomscrolling—briefly, kindly, privately.

Unloop is an open-source, non-profit, privacy-first mobile app. It gives you a short interruption (about 5–15 seconds) so the rational mind can choose again. It does not punish, track, or monetize your attention.

**Contact:** [unloopyourself.dev@gmail.com](mailto:unloopyourself.dev@gmail.com)

## Status

Phase 0 scaffolding started: npm workspaces + `@unloop/core` (TypeScript + Vitest). **No Expo app yet.** See [`AGENTS.md`](AGENTS.md) and [`factory/STATUS.md`](factory/STATUS.md).

## Develop

```bash
npm install
npm test
npm run check-boundaries
```

## Documentation

| Doc | Contents |
|-----|----------|
| [`docs/manifesto.md`](docs/manifesto.md) | Ethics and product philosophy |
| [`docs/vision.md`](docs/vision.md) | Longer-term vision |
| [`docs/architecture.md`](docs/architecture.md) | Domain modules and ports |
| [`docs/roadmap.md`](docs/roadmap.md) | Phased delivery |
| [`docs/decisions.md`](docs/decisions.md) | Architecture Decision Records |
| [`docs/research.md`](docs/research.md) | Research notes |
| [`docs/ideas_parking_lot.md`](docs/ideas_parking_lot.md) | Out-of-MVP ideas |

## Working on this repo

1. Read [`AGENTS.md`](AGENTS.md).
2. Check [`factory/STATUS.md`](factory/STATUS.md) and [`factory/BACKLOG.md`](factory/BACKLOG.md).
3. Run `scripts/check-boundaries.sh` when changing dependencies or Core/app boundaries.

License: [AGPL-3.0](LICENSE).
