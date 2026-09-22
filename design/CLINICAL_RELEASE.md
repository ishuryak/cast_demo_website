# Clinical tutorial release

The reviewed clinical narratives were committed and pushed in
[2509599](https://github.com/ishuryak/cast_demo_website/commit/2509599).
GitHub tests and Pages deployment passed. All three live tutorial pages and
the shared stylesheet matched the committed release after deployment.

## Maintained sources

- [Build instructions and scientific review summary](../clinical/README.md)
- [Shared narrative](../clinical/quiet-narrative.mjs)
- [Clinical notes and walkthrough integration](../scripts/build-clinical-editions.mjs)
- [Oncology article](../clinical/oncology/index.html) and [application](../clinical/oncology/app.js)
- [Shared styling](../clinical/clinical-theme.css) and [figures](../clinical/narrative-figures.mjs)
- [Scientific display checks](../tests/test_clinical_review.mjs)

Run `npm run build:pages` to rebuild the published editions. The build was
repeated and produced no changes to the staged release. Local tests checked
the walkthrough, data and rendering contracts, links and anchors, 24 scenarios
and 120 horizons, and layout at six widths for the methods page and all three
tutorials. The CI workflow repeats the applicable checks.

The educator download remains available and unchanged. R source and frozen
scenario data were not modified. The review did not establish empirical
calibration or clinical validity.

## Prototype disposition

The earlier prototype files, abandoned guided-tour implementation, consultation
requests and detailed local review records were preserved in a local review
archive outside this checkout. They are superseded by the maintained sources
above. Each archived file was verified against its original SHA-256 hash.
The unpublished correspondence draft remains outside the repository and unsent.
