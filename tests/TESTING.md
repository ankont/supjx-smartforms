# SmartForms 2.2.0 verification

Verified on 2026-11-15 using PHP, Node.js, installed Chrome, Joomla 6.0.4 APIs/assets and SmartBrowser 3.6.22 source layout contracts.

- Parser/note checks cover all five modes, short/verbose aliases, canonical saving, mixed-alias deduplication, UTF-8 note boundaries, first-token policy, duplicates, unknown/malformed directives, create/edit, failed-save retry and marker-free callers.
- Native Joomla Form/events cover transient controls, options validation, shortened tab title, showon rendering, real core Field Group XML and params layout, note composition and context-scoped list presentation.
- Extended lifecycle checks cover every target/mode in all four contexts, context-only option lists, native validation/save events, list hiding, legacy directive preservation, foreign directives, form/control mapping, rendered ordering and route scope.
- Original browser coverage verifies TinyMCE iframe/document/editor identity, CodeMirror identity, unsaved values, menu keyboard controls and dismissal, real HTML5/Joomla validation, administrator/frontend SmartBrowser article layouts, old-browser move fallback, safe inactivity on unsupported layouts, and late-initialized editor safeguards.
- Eight additional browser scenarios cover SmartBrowser article/category/user, native administrator article/category/user, native frontend article edit and native frontend profile edit. Every available target has two toggle groups plus before/after groups at once. Checks include independent menus, native region access, group ordering when source and destination share a parent, bare native regions, preserved controls/editor state, validation reveal and tab activation, empty-source-tab removal, responsive accordion layouts and actual HTTP POST of all values without duplicate controls.
- Native frontend Content Settings has no separate core region: its groups stay in their original tab. This missing-target behavior is explicitly exercised.
- Horizontal browser scenarios cover all eight adapter/context combinations, category Options, simultaneous Before/After/Toggle/Left/Right, per-side ordering, equal-width desktop columns, mobile stacking, preserved editors and submitted values. Single-side layouts without Toggle and late native iframe safety are also checked.
- Package checks verify PHP syntax, XML/JSON versions, language coverage, root manifest, declared files, ZIP paths and byte equality with source.

Browser fixtures serve the real local Joomla tab component, validator, TinyMCE and CodeMirror assets. PHP tests use the real Form and typed events with a disconnected database driver. They do not install the plugin or save records to a live Joomla database.

No Joomla 5 runtime, JCE installation or third-party template override was available. Joomla 5 compatibility follows the existing project's typed-event and WebAssetManager conventions. Live installation and site-specific template/editor behavior remain deployment checks.

Tag integration checks read the actual SmartTag TagFields context constant and core tag form XML. Native event checks cover all seven tag targets and five modes, context-restricted options, save/retry and list presentation. Browser scenarios reproduce native tag Details and the Options tab containing options/image-intro/image-fulltext fieldsets, including horizontal placement, editors, validation, mobile stacking and POST of tag-owned values. These are fixture/API checks; they do not save rows through a live SmartTag installation.
