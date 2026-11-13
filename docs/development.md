# Development and verification

This guide covers changes to the application and teaching materials. For ordinary
local use, see the [project README](../README.md); for shared hosting, see the
[deployment guide](../deploy/README.md). The [repository layout](repository-layout.md)
describes source directories and which generated files belong in version control.

## Development setup

Run commands from the repository root. Pixi's `dev` environment contains the
application and development tools; dependencies are resolved in `pixi.lock`.

```sh
pixi install --locked -e dev
pixi run --locked -e dev web
```

Open `http://127.0.0.1:8000/`. Reload the browser after changing browser code and
restart the application after changing server code. Calculation code runs in
separate worker processes; newly submitted jobs load changes to that code.

To use a different port and limit the instance to two concurrent calculations,
each with a 600-second timeout:

```sh
pixi run -e dev web --port 8001 --max-jobs 2 --job-timeout 600
```

## Running checks

### Routine checks

```sh
pixi run -e dev pre-commit run --all-files
pixi run -e dev test-web
node --test tests/*.cjs
```

These check Python formatting and basic static errors, the Python application and
numerical utilities, and browser-side logic, respectively. Node.js must be
installed separately; it is not needed to run the application. Inspect changed
interfaces in a browser as well. Changes to Hub integration also need a login
test on a real Hub.

### Accessible presentation

The app and website offer a **Barrierearmer Arbeitsmodus**, persisted locally and
selectable directly with `?text=1` (`?text=0` overrides the stored choice). A native
radio group selects **Grafisch** or **Barrierearm**; both choices must handle `change`,
including the switch back to the graphical layout. Both modes use the same scientific
calculation data and actions. The accessible app is a linear, single-column workflow
with one inline structure selector, fixed tasks, inputs, calculation status, and the
current result report. Tasks are a named section before the inputs, loaded automatically
for the active mode and step. Their outer open/close buttons are absent in accessible
mode, and Escape cannot hide the section or move focus. Individual task disclosures
remain under student control. A loading error offers an inline retry; a still-focused
explicit retry returns to the heading on success. Automatic loads preserve focus.
Requests are invalidated on close/mode changes so late responses cannot replace the
wrong task version or reopen the graphical panel. Its previous open/closed preference is
retained. `presentation.js` relocates existing nodes with restoration markers and
restores their original positions, values and disclosure state. Repeated updates must
not reparent focused controls. The unit converter uses its original fields inline rather
than opening a dialog; the fundamentals link follows it in DOM and tab order. Native
structure, substituent, atom and path choices remain where a scientific choice is
required. Substituents and atom/bond tools each use one disclosure. Supporting 2D
formulas retain alternative text, and this mode avoids initializing WebGL. The website
puts compact navigation in the reading flow and omits the duplicate outline.

`accessibility.js` builds a compact report directly from saved calculation results. The
optional HTML download renders the same report sections; there is no separate
remembered-observation collection or capture/remove/clear workflow. Reports show the
selected result, its chemical source identity and status, and only contextually related
comparisons. Technical IDs never appear in student-facing app text or HTML reports,
including optional data. Name collisions use human calculation numbers. Internal state
and explicit machine-data exports retain IDs. Geometry comparisons use stored parent
links. A cis/trans pair requires explicit valid substitution settings, converged minima,
and (for spectral comparisons) valid spectra. Derivative identity is normalized over
independent reversal of each ring and exchange of the two rings (eight orientations),
ignoring configuration. Missing or ambiguous partners are not replaced with an arbitrary
latest structure. No derivative ranking is performed.

The spectrum report prioritizes up to five transitions with the largest positive, finite
oscillator strengths inside the inclusive curve observation window, then displays them
by descending oscillator strength, then energy and original transition index for ties.
All additional positive-strength visible transitions appear directly below, without
repeating rows already in the strongest five. The complete transition table uses the
same order and retains zero-strength states; it remains optional, together with
stored-curve maxima and color. Oscillator strength is not measured absorbance. `Emax`
remains the highest sampled value of the full broadened spectrum, matching the graphical
task quantity, with flat, tied and boundary cases identified. The same-energy probe
automatically compares both configurations of a uniquely matching pair at an energy
chosen by the student. Interpolation and color estimation use the full broadened data,
not just the five displayed transitions. Every automatically paired spectrum keeps its
own coverage warning and observation window. A probe outside one window explains that
source-specific gap while retaining values available for the other source. Local curve
maxima and visible-range coverage remain in additional spectral data; plateau locations
are intervals of stored samples, and edge values are not described as inner peaks.

Solution color and weighted transmission are descriptive required quantities in both
task routes. In accessible mode they are one primary report section for the selected
structure and its unique cis/trans partner. No task ranks derivatives by color; the
CIE76 color distance appears only in the machine-readable JSON export.
Solution-color words and the graphical swatch use the same color calculation. Near-white
transmission is described as nearly colorless. The result states once that its fixed
absorbance scale has no specified concentration or path length. Color-space details
belong to optional methods. Atom/bond exploration, named atom distances and path tables
remain available as secondary data; both azo angles are reported directly for the
displayed optimization/path geometry. Actual reaction paths and their short structure
choices are directly open; optimization iteration tables remain optional.
Transition-structure validation has one direct result in accessible mode, while
algorithms remain in existing methods. Technical ring-index lists are omitted in favor
of chemical atom positions.

`ScientificDisplay` is the shared display formatter for both modes, tables, reports,
chart ticks/tooltips and converter outputs. Absolute electronic energies retain up to
four decimal places for student subtraction; differences/barriers use three significant
digits. Spectral maxima/transitions normally use two decimal places,
wavelengths/distances whole nm/pm, angles one decimal place, strengths/absorption two
significant digits, and percentages one decimal place. False percentage endpoints and
ambiguous frequency-threshold rounding are identified. Tiny nonzero strengths and
differences use compact scientific notation with German spoken alternatives in
text/table math spans. Local comparison precision can increase to four
places/significant digits; remaining rounding equality is identified rather than
implying exact equality. Converter outputs use four significant digits as ungrouped,
parseable decimal strings and never rewrite the active input. No display rounding
changes calculations, selection, thresholds, data order or machine-readable exports. One
central rounding note is in existing methods; no precision option is added.

App table wrappers become tab stops only while horizontally overflowing, including after
disclosure/zoom changes. Standalone HTML exports retain static focusable wrappers as a
reliable keyboard-scroll fallback without application JavaScript. Curve probes and all
three converter fields accept one comma or dot without relying on number-input locale
handling. Negative energy differences remain valid, while photon wavelengths must be
positive. Atom numbers are indices of the stored coordinates, distinct from chemical
ring positions. Old stored sessions without `atom_graph` require recreating structures
for bond exploration.

`guide.html` retains the graphical exercises. `guide-accessible.html` contains nine
autonomous, equivalent exercises and is the shared source for both the accessible app
and `scripts/build_protocol.py --text`. Both task routes apply course filtering.
Preserve the graphical tasks and `protokollvorlage.docx` when adjusting the accessible
workflow. The text protocol requires selected numeric evidence and student
interpretation, without requiring report or raw-data exports. Required spectral tasks
use transition energies/strengths, curve maxima, same-energy absorption, descriptive
color predictions and student interpretation. Both task routes require the same
quantities and contain no optional deliverables. In both, the group comparison of the
free derivatives uses one photon energy chosen by the group within the common
1.5–5.5 eV observation window; the app does not choose or rank them. Build
the protocol using the document-authoring runtime and render and inspect every page.
Both protocol downloads are available in the Marburg course. No voice service or
generative model is required.

Run `node --test tests/*.cjs` and `pytest tests/test_accessibility.py` alongside the
routine checks. Tests cover native mode selection in both directions, restoration of
actual controls, automatic report/export agreement, pair identity and ambiguity,
transition filtering, visible weak lines, probes, convergence, validation and autonomous
task/protocol consistency. Manual keyboard, screen-reader, zoom and graphical checks
remain necessary; automated tests do not establish WCAG conformance.

The JSON color comparison uses the CIE76 Euclidean distance in CIELAB with
D65 reference white, calculated from the same clipped sRGB triples as the swatch.
It does not rank derivatives automatically or predict measured colors at a
specified concentration. The value is a color-space distance, not an energy
difference or a proportional scale of perceived differences. See the
[W3C color conversion and difference discussion](https://www.w3.org/TR/css-color-4/#color-conversion-code)
for color-space background; D65 is used consistently here rather than CSS Lab's
D50 white. Tests check neutral anchors, symmetry and zero self-distance.

### Chemistry regression tests

These longer-running calculations are excluded from routine runs and are run
explicitly:

| Command | Purpose |
| --- | --- |
| `pixi run -e dev test-ts` | Real minimum-to-transition-structure calculations and saved failure cases. |
| `pixi run -e dev test-science` | The parent molecule's planarity and cis/trans energy ordering in the model. |
| `PHOTOSWITCHLAB_CHEMISTRY_TESTS=1 pixi run -e dev test-web` | Additional chemistry workflow checks. |

For a reported transition-structure search failure, add a reproducible regression
case and run the complete `test-ts` suite when verifying the fix. During debugging,
`pixi run -e dev test-ts -k trans-2-Me` selects matching test names.

Tests retain structures and search diagnostics in pytest's temporary directory.
See the [screening guide](ts-screening.md) for broader coverage and collecting
exact starting structures. These checks assess numerical behavior within the
model, not agreement with experiment.

## Editing the website and figures

Student-facing material is German, addresses students as **Sie**, and assumes
first-year chemistry knowledge without prior theoretical chemistry. Developer
documentation and code identifiers are English. See the
[scientific documentation](README.md) for the calculation definitions and their
interpretation.

The fundamentals live in `site/`; exercise instructions live in the app. Keep
conceptual explanations on the website and implementation-specific method details
in the app's optional help.

### Preview and build

```sh
pixi run -e dev site
```

The preview runs at `http://127.0.0.1:3000/` and rebuilds and reloads after changes
to content, styles, scripts, or figures. Use `--port 3002` if needed. A failed
rebuild prints its error and leaves the last successful preview available.
Restart the preview after changing the Python builder itself.

Branding is shared with the app through
`src/photoswitchlab/web/static/branding.json`: the app and website use
`project_name` (**PhotoSwitchLab**) and the default subtitle
**Computerexperiment**. Use `pixi run -e dev site --course marburg` to preview the
local suffix ** · ACh-PR · Marburg**, or `pixi run -e site build-site --course marburg`
for a local website build. `PHOTOSWITCHLAB_COURSE=marburg` also selects this branding for
the app and website CLI; explicit `--course` arguments take precedence. The
public teaching website is built with the default branding. The app's guide link
opens the public introduction or the Marburg course page according to this setting.
The course page contains university access, protocol and submission requirements.
Blocks marked `<!-- course:marburg -->` through `<!-- /course -->` in app HTML
are rendered only for that course. Shared exercises remain in `guide.html`;
protocol requirements and group assignments are additions. The public app has
no protocol download. The fundamentals remain shared.

The website's Binder launch is pinned in `binder/launch.json`. Update its `ref`
after publishing app or environment changes. The launch display uses Binder's
public event stream and opens `photoswitchlab/` when the session is ready;
without JavaScript, its link opens Binder's own launch page.

For website-only work, use the lightweight `site` environment:

```sh
pixi run --locked -e site site
pixi run --locked -e site test-site
pixi run --locked -e site build-site
```

Production output goes to `site/_build/`. Relative URLs support both domain-root
and project-path hosting. GitHub Actions tests and builds pull requests and
deploys `main`; GitHub Pages must be configured to deploy through Actions.

### Website sources

| Source | Purpose |
| --- | --- |
| `site/theory/*.md` | Fundamentals chapters. |
| `scripts/build_site.py` | Builder; `PAGE_GROUPS` defines navigation groups and page order. Labels come from each page's Markdown title. |
| `site/template.html` | Page template. |
| `site/assets/teaching.css` | Website styles. |
| `src/photoswitchlab/web/static/header.css` | Shared app/site header styles and `--page-inset`; copied by the site builder. |

Use source-relative Markdown links. The builder supports tables, fenced code,
explicit heading IDs, and Markdown inside HTML marked `markdown="1"`.
Use `<details>`/`<summary>` for optional reading and `<figure>`/`<figcaption>`
for illustrations. Dollar-delimited equations become native MathML at build
time. Referenced assets are copied automatically; missing files fail the build.

### Figures

```sh
pixi run -e dev python figures/scripts/generate.py
```

This regenerates the published SVGs. Each figure also has an independently
runnable source. See [figure sources](../figures/README.md) for individual exports
and typography conventions. Inspect changed figures at their published display
sizes before committing the source and generated SVG together.

## Updating tasks and the protocol

The graphical task source is `src/photoswitchlab/web/static/guide.html`; the autonomous
accessible equivalent is `src/photoswitchlab/web/static/guide-accessible.html`. Each `details.task` has a
stable ID, a title in `summary`, and required deliverables in a `.protocol-output`
paragraph. `scripts/build_protocol.py` reads those titles and deliverables and
adds the protocol's answer fields and tables.

When changing an exercise:

1. Update its instructions and required deliverables in `guide.html`.
2. Update the corresponding answer fields and tables in `scripts/build_protocol.py`
   when quantities, molecules, or expected responses change. Check that the
   website's learning goals still match the exercises.
3. Regenerate the DOCX if its titles, deliverables, or answer fields changed.
   Make maintained edits in the HTML and generator, not directly in the Word file.
4. Check that task wording, units, terminology, and protocol fields agree, and
   inspect the document layout before release.

For generation, activate a separate Python authoring environment with
`python-docx` and `lxml` installed, then run from the repository root:

```sh
python scripts/build_protocol.py
```

The script replaces `src/photoswitchlab/web/static/materials/protokollvorlage.docx`.
This file is bundled with the application and served under `static/materials/`,
including through the Hub proxy. Commit the regenerated template with its source
changes; keep completed student protocols outside the repository.

For layout verification, open the generated DOCX in Microsoft Word or LibreOffice
Writer and export it to PDF. Inspect every page for clipped text, broken tables,
missing symbols, and awkward page breaks; correct the generator and repeat if
needed. The repository does not bundle a document renderer. Keep the PDF local;
the published download remains the editable DOCX. Document-authoring tools are
not application dependencies.

## Compatibility and source conventions

- Keep descriptive task IDs stable when changing titles or page order: the
  protocol generator uses them to identify exercises.
- Preserve chapter heading IDs referenced by the app and the legacy anchors in
  `site/theory.md`, which forward older `/theory/#…` links to the current chapters.
- Student-facing substituent labels use CH₃, OCH₃, and N(CH₃)₂. The API, saved
  settings, and benchmark identifiers retain `Me`, `OMe`, and `NMe2`. Translate
  these at display time rather than changing stored identifiers or chemistry inputs.
