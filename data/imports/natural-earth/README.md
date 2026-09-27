# Natural Earth base map

Physical base map layers (land, lakes, rivers) at 1:50m scale. They contain no borders, roads,
cities, or place names: the historical data draws everything political.

- **Where it comes from:** the pinned Natural Earth release recorded in
  [manifest.json](manifest.json), with a checksum of each original download and the processing
  steps.
- **License:** public domain. See [LICENSE.md](LICENSE.md).
- **To re-import or update:** change `RELEASE` in
  [scripts/import-natural-earth.ts](../../../scripts/import-natural-earth.ts), then run
  `npm run import:natural-earth` and review the diff.
