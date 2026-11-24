# Everend Forge Bridge runtime source

This is the source snapshot used to package the Bridge alongside standalone
PathBranching releases. Local workspace builds prefer the sibling
`everend-forge-bridge` checkout; GitHub release builds use this copy so they do
not depend on files outside the repository.

When Bridge changes, synchronize `src/`, `scripts/build-runtime.mjs`,
`everend-forge-bridge.cmd`, `package.json`, and `package-lock.json` from the
workspace Bridge project. The runtime source is MIT licensed; see
`LICENSE-MIT`.
