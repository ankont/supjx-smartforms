# SuperSoftJx - SmartForms

SmartForms 2.0.2 (`plg_system_smartforms`) places whole Custom Field Groups in Joomla article, article-category and user editing forms. It is an independent, optional Joomla 5/6 system plugin. Native editing works without SmartBrowser; SmartBrowser remains unchanged and does not require this plugin.

Version 2.0.1 removes the extra placement margins so moved fieldsets inherit the same template spacing as native regions, and keeps Placement Target before Placement Mode when loading context-specific options.

Version 2.0.2 prevents Cassiopeia's adjacent-fieldset rule from adding a gap before the first visible toggle panel when its preceding panels are hidden. Spacing after real visible fieldsets remains intact.

## Supported forms and targets

| Context | Targets | Supported layouts |
| --- | --- | --- |
| `com_content.article` | Article Text (`article-text`), Content Settings (`content-settings`), Publishing (`publishing`), Metadata (`metadata`) | Native administrator and frontend article edit; SmartBrowser administrator and frontend article edit |
| `com_content.categories` | Category Description (`category-description`), Content Settings, Publishing, Metadata | Native administrator category edit; SmartBrowser category edit |
| `com_users.user` | Account Details (`user-account`), Basic Settings (`user-settings`) | Native administrator user edit, native frontend profile edit; SmartBrowser user edit |

The native frontend article form combines status/settings with publication fields in its Publishing tab. Use **Publishing** there; it has no separate Content Settings region. Frontend profile Basic Settings appear only when Joomla enables frontend user parameters. Hidden/missing targets, unrelated forms and unrecognized layouts leave their groups in the original position. Joomla has no corresponding native frontend article-category editing form.

Images/links, associations, permissions, registration and other component/category contexts are outside this release's scope.

## Installation and use

1. Install `build/output/plg_system_smartforms-v2.0.2.zip` and enable **System - SuperSoftJx - SmartForms**.
2. Create/edit a Field Group in the article, article-category or user context.
3. Open **Form Placements** and select a target. The choices are restricted to that group's context.
4. Select **Replace / Toggle**, **Before** or **After** and save.

Multiple targets can coexist in one form. Each has independent ordering, visibility and its own switcher. Toggle initially displays the first configured group, following Joomla's rendered ordering. Click the active fieldset title and its arrow to choose another group or the native region. The title appears once; the menu lives in the legend. Arrow keys and Home/End navigate, Enter/Space select, Escape closes, and Tab resumes normal form navigation. Clicking outside closes the menu.

Before/after groups remain visible with any toggle selection. Fields and editors are neither cloned, disabled nor recreated. Toggle changes visibility only; values in all regions still submit. HTML5 and Joomla validation reveal the affected region and its tab. Only the new menu moves between headings during selection.

## Storage and the 2.0 change

The Note remains the only persisted configuration. Directives use semantic target IDs rather than DOM control IDs:

| Example | Behavior |
| --- | --- |
| `@article-text^` | Toggle with Article Text |
| `@category-description-` | Before Category Description |
| `@user-account+` | After Account Details |

Every listed target supports `^`, `-` and `+`. Tokens are case-sensitive and whitespace-delimited. The first supported token wins. Preparing/saving removes only supported tokens for the current context, deduplicates them and preserves the rest of the note, including unknown or wrong-context directives. The visible Note and Field Group list hide recognized directives. Editing controls retain their submitted values after validation failures; saving rejects composed notes exceeding the native 255-character limit.

**As requested, 2.0 does not migrate or interpret the old `@jform_articletext` directives.** They remain ordinary editable note text. Re-select placements through Form Placements and remove old tokens from the Note when upgrading existing groups. The actual native Article Text control ID/name remains unchanged.

`smartforms_target`, `smartforms_mode` and `smartforms_present` are transient root form controls; no table or custom storage is introduced. Save callers without the SmartForms marker retain their note. Disabling the plugin exposes the full stored note through Joomla after reloading the form.

## Architecture

- `Placement/Targets.php`: shared context/target catalog and translated labels, independent of DOM IDs.
- `Placement/Directive.php` and `GroupPlacement.php`: context-aware parsing, composition, transient form settings and length validation.
- `Adapter/FormAdapter.php`: read-only mapping of the actual Joomla form fieldsets/control IDs to rendered groups, retaining Joomla ordering and context/permission filtering.
- `media/js/smartbrowser-adapter.js` and `native-adapter.js`: separate recognition and target discovery for SmartBrowser, native administration, frontend article editing and frontend profiles. Native bare regions receive a presentation fieldset before editor initialization. Existing controls and labels are retained.
- `media/js/form-adapter.js`: shared safe DOM moves, whole-group checks, empty-tab retirement and target-tab activation.
- `media/js/placement-engine.js`: independent placement controllers per target, menu accessibility, visibility and validation recovery. It does not know component layout selectors.
- `Extension/SmartForms.php`: typed Joomla PrepareData/PrepareForm/BeforeSave events, WebAssetManager loading and context-scoped Field Group list presentation through AfterDispatch.

A classic head asset starts at the document's interactive transition, before deferred/module editor initialization. Build sources stay separate; `build/build-assets.mjs` creates the installation bundle. A late-injected initialized iframe requires state-preserving `Element.moveBefore`; upgraded custom elements with connection callbacks require `connectedMoveCallback`. Otherwise the affected group stays in its original position. This preserves editor state rather than recreating it.

No Joomla core, SmartBrowser layouts, SmartLink fields, existing selectors or save controllers are changed. Adapters can be extended for additional inspected layouts without changing target identities or Note storage.

## Build and verification

Run `build.bat` or `powershell -ExecutionPolicy Bypass -File build/build.ps1`. The package follows project conventions: manifest version, `plugin/` source, portable ZIP paths and `build/output/plg_system_smartforms-v{version}.zip`.

```powershell
npm.cmd ci
npx.cmd playwright install chromium
$env:SMARTFORMS_JOOMLA_ROOT = 'C:/path/to/joomla'
npm.cmd test
python tests/verify-package.py
```

`SMARTFORMS_BROWSER_EXECUTABLE` selects installed Chrome/Edge; `SMARTFORMS_PLAYWRIGHT_MODULE` can select an existing local Playwright module. Tests use local Joomla APIs and editor assets with a disconnected database driver. Browser fixtures reproduce inspected native/SmartBrowser markup and POST to a local endpoint; no live Joomla rows are written.

See [tests/TESTING.md](tests/TESTING.md). Verification used Joomla 6.0.4 and SmartBrowser 3.6.22. No live Joomla 5, JCE, production installation or third-party template overrides were available. Template overrides changing the inspected region contracts need adapter changes; missing regions fail safely.
