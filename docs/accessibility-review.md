# Accessibility implementation and review

This report records the initial implementation and four review/correction cycles
requested for PhotoSwitchLab. The developer implements changes; independent
reviewers inspect nonvisual access (B) and the sighted student experience (S).
The coordinating agent consolidates findings before each correction round.

## Scope and design constraints

- Cover the application, teaching website, and protocol template.
- Preserve the graphical workflow and existing sighted exercise wording wherever
  possible. Retain the original visual protocol and add a separate text-based one.
- Share scientific data and calculation actions across presentations. Provide
  an optional text/table preference rather than gating basic accessibility.
- Keep scientific observations accessible without supplying exercise answers.
- Keep calculation terminology, model assumptions, and validation status explicit.
- Commit work on `accessibility/two-cycle-review`; do not push or deploy.

## Verification limits

The reviews are technical evaluations, not lived-experience testing. No early
student trial is available. This environment has native Safari accessibility-tree
and screenshot access, Node regression harnesses, Python tests, and a bundled
DOCX renderer. It has no JAWS test installation or physical Braille display.
Any untested assistive-technology behavior must remain explicitly unverified.

Local review endpoints are `http://127.0.0.1:8017/` (Marburg application) and
`http://127.0.0.1:8018/` (Marburg teaching website). Preview artifacts and rendered
protocol page images are not committed.

## Initial implementation

Commit `2121be4` introduced optional text/table exploration, atom and bond metadata,
geometry measurements, energy/path selection, spectrum data access, raw exports,
website descriptions, and a separate text-based protocol. The original visual
protocol binary was preserved. The separate protocol rendered to seven pages;
both D and S inspected every page without finding layout defects.

Independent coordinator checks on this frozen commit passed all 49 Node tests
and 18 selected website, teaching-material, and accessibility Python tests.

## Cycle 1 review

B used source inspection, a Node DOM harness, DOCX XML inspection, and S's Safari
accessibility-tree evidence. S used native Safari screenshots and accessibility
trees, created a structure, ran a real minimum optimization, checked presentation
changes, and inspected website and protocol rendering.

| ID | Priority | Demonstrated finding |
| --- | --- | --- |
| B1 | High | Coarse color words alone cannot support the required color-difference comparison. |
| B2 | High | A website naming exercise exposes its nonvisual input only inside the solution; spectral figure descriptions omit intensity observations. |
| B3 | Medium | Identical polling renders repeatedly assign live-region text. |
| B4 | Medium | An explicit text-mode URL preference does not survive subsequent website navigation. |
| B5 | Medium | Disabling the focused create button loses useful keyboard position without guarded focus recovery. |
| S1 | High | Global form styles produce an oversized checkbox and insufficient header-label contrast. |
| S2 | Medium | Disabling text preference leaves automatically expanded data ahead of graphics. |
| S3 | Medium | New buttons use small native styling; a checkbox and caption are separated excessively. |
| S4 | High | Full tables and prominent raw exports overload the initial text view. |

The user explicitly clarified during this review that CSV and JSON should not be
the primary student outputs. Correction requirements therefore include a compact
overview, on-demand detail, collapsed full tables, a concise readable HTML report,
and an optional raw-data section for both formats.

An initial cache-version allegation by S was withdrawn after the coordinator
checked that asset versions had already been incremented. The observed stale
page belonged to an earlier development state, not the reviewed commit.

Spectrum runtime review initially failed because the coordinator's preview
process lacked MOPAC on its PATH. The coordinator restarted the isolated server
with the existing development environment's executable directory on PATH. This
was an environment correction, not an application feature change.

## Cycle 1 correction

Commit `03f96c5` addressed the consolidated review: compact text overview and
on-demand full tables, a readable escaped HTML report as the primary export,
optional raw JSON/CSV, selected-pair color comparison, factual website exercise
inputs, guarded focus recovery, stable status updates, persistent URL preferences,
and scoped control styling. Tests covered report escaping, DOM updates, focus,
preferences, geometry, interpolation, and color conversion.

D reported 54 passing Node tests, 18 passing selected Python tests, and passing
configured Ruff checks. The text-based protocol was regenerated and all seven
rendered pages inspected. The original visual protocol remained unchanged.

## Cycle 2 review scope

B and S reviewed the frozen correction commit in parallel. The user additionally
requested a didactic review of approximation/model/schematic labels: retain
adjacent caveats that prevent concrete scientific misinterpretation; avoid
repetitive labels and move computational detail to optional explanations.

For this round S successfully prepared a fresh cis structure, real GFN1-xTB
minimum optimization, and real INDO/S-CIS spectrum using the corrected preview
environment. This closes the earlier runtime spectrum preparation gap.

B confirmed the original B1–B5 findings resolved at source/harness level and ran
all ten accessibility tests successfully. S confirmed S1–S4 resolved in Safari,
selected a transition in a real graphical spectrum, and downloaded/opened the
readable HTML report. S inspected all seven updated protocol page images without
finding layout defects. Neither reviewer claimed JAWS or physical Braille tests.

| ID | Priority | Finding assigned to the second correction |
| --- | --- | --- |
| S2-1 | High | Native numeric input silently strips German decimal commas in Safari. |
| S2-2 | Medium | Text mode retains instructions for hidden diagrams and duplicate result blocks. |
| B2-1 | Medium | Reports retain only the latest query and omit selected chemical atom-position labels. |
| B2-2 | Medium | Text-based task instructions still require raw tables/CSV inconsistently with the compact-report workflow. |
| B2-3 | Medium | The static course website links only the visual protocol. |
| B2-4 / S2-3 | Medium | Repeated method and model warnings distract from the immediate scientific task. |
| S2-4 | Design | Remove the additional graphics checkbox and retain one global view preference. |

The coordinator briefly proposed separate local graphic disclosures in response
to a user question. The user then explicitly prioritized fewer navigation
elements. That proposal was withdrawn before implementation: no replacement
per-chart toggles are part of the final correction requirements.

The second correction includes a small deliberate observation collection for
readable reports, not an automatically accumulated data dump. Original graphical
exercise wording and the original visual protocol remain protected constraints.

## Extended review request

While D implemented the second correction, the user requested a third review and
correction cycle. The coordinator started fresh B and S reviewers inheriting the
current session settings. They prepare independently and begin their formal
parallel review only after the second correction is committed and frozen.

## Cycle 2 correction

Commit `074847e` introduced controlled comma/dot parsing for spectrum probes,
deliberately retained observations with atom-position labels, both website
protocol downloads, aligned text-based task deliverables, one global view
preference, and shorter contextual caveats with optional methodological detail.
D reported 58 passing Node tests and 18 passing selected Python tests. All seven
rendered protocol pages were checked; the original visual protocol was unchanged.

## Cycle 3 review

Fresh B and S reviewers independently examined frozen `074847e`. S did not have
a live computer-use tool in this agent instance, so the coordinator supplied
native Safari observations and screenshots while S reviewed source and all seven
rendered protocol pages. B used source, Node DOM harnesses, Python tests, and
document structure checks. These roles and tool limits were kept explicit.

The coordinator successfully entered `3,5` and `3,7` in the spectrum probe and
captured both results. `0,3` produced the correct range error and `3,5,2` a format
error. A named C2-to-C1′ atom distance was captured, the selected structure was
changed, and the downloaded HTML report was opened in Safari: all three
observations and their original geometry labels were retained.

The same runtime check exposed the remaining unit-converter issue: entering
`0,3` eV displayed `03` and approximately 289,456 kJ/mol, rather than approximately
28,946 kJ/mol. The coordinator elevated this source-review finding to high
priority on demonstrated numerical magnitude loss.

| ID | Priority | Finding assigned to the third correction |
| --- | --- | --- |
| B3-1 | Medium | Remembered observations lose source method and validation context when exported under another current structure. |
| B3-2 | Medium | Retained observations and export disappear when no eligible structure is selected. |
| B3-3 | High | The unit converter still uses native numeric fields that strip German decimal commas in Safari. |
| S3-1 | Medium | Spectrum text puts generic geometry and secondary controls before the active scientific result. |
| S3-2 | Medium | A collection report also includes unrelated current defaults and repeats unnecessary geometry in spectral probes. |
| S3-3 | Medium | Website text descriptions remain automatically expanded after returning to graphical preference. |

S verified all nine original exercise paragraph/list sequences and the original
visual DOCX against `main`, all seven text-protocol page images, and both built
website downloads. B reported 14 passing accessibility Node tests and 18 selected
Python tests. No reviewer claimed JAWS or physical Braille validation.

## Cycle 3 correction and expanded layout request

Commit `aa250d6` resolved the six consolidated third-round findings. D reported
63 passing Node tests, 18 passing selected Python tests, configured Ruff checks,
and syntax/diff checks. Both protocol binaries remained unchanged in this
correction. The coordinator also installed the missing Docker Python test package
in a temporary directory only: all three Binder tests then passed.

The user subsequently requested a genuinely simplified layout rather than only
a text/table preference, and explicitly added a fourth review/correction cycle.
The new mode is called “Vereinfachte Ansicht”. It retains one shared workflow and
data model, but linearizes the interface, reduces competing navigation, puts
operation-specific results first, and keeps optional details subordinate.

The user added a separate critical didactics reviewer R. R and B supplied a
bounded pre-implementation brief: preserve independent scientific reasoning and
the original sighted tasks; show a concise factual scaffold and chemical position
context for nonvisual measurements; avoid making optional colorimetry a new
learning prerequisite; allow supporting images after equivalent text without
introducing graphic switches. These are internal technical/didactic reviews,
not claims of lived blindness or replacement for student testing.

The fourth formal review will run B, S, and R in parallel on a frozen layout
commit, followed by D's consolidated correction.

## Cycle 4 implementation and review

Commit `6dde5d0` introduced the simplified layout using the same live controls,
with comment anchors to restore their original positions. It linearizes tasks,
inputs, status, results and optional tools; keeps results open; adds a supporting
2D illustration without requiring WebGL; and makes the one capture action match
the inspected result type. Functional tests check actual DOM relocation, node
identity, idempotence and restoration. D reported 66 passing Node tests and
18 passing selected Python tests; neither protocol binary changed in this commit.

B, S and R reviewed this frozen commit in parallel. The coordinator confirmed
the single-column build/optimization/spectrum sequence in Safari, meaningful
step-specific results, one preference, supporting art, and preservation of the
selected real spectrum when returning to the original two-column graphical view.

| ID | Priority | Finding assigned to the fourth correction |
| --- | --- | --- |
| B4-1 | Medium | Removing the last observation without a selected structure attempts to focus a now-hidden summary. |
| S4-1 | High | The closed compact website menu has no visible or accessible trigger at desktop widths. |
| S4-2 | Medium | Relocated utility buttons retain pale header text on a white background. |
| S4-3 | Medium | Switching an initialized website 3D figure to simplified mode loses its static fallback and retains unusable drag guidance. |
| R4-1 | High | Scalar probes and a global spectrum maximum do not provide an equivalent initial observation of broadened and visible bands. |
| R4-2 | Medium | Selected structure and inputs for a new start structure are insufficiently distinguished in the linear build workflow. |
| R4 coherence | Low | Text-only task wording still requires a color-metric implementation name that the simplified interface intentionally relegates to methods. |

The coordinator reproduced S4-1 and S4-2 in native Safari. S4-3 is a demonstrated
source-state sequence, not a claimed native result. B used a focused DOM harness
for B4-1. R reviewed all nine tasks and the native workflow evidence, distinguishing
access to scientific observations from automatically completing interpretations.
No agent claimed actual JAWS or Braille hardware testing.

## Final verification

The fourth correction was committed as `5f68c54`. It resolves the focus and
website presentation defects, distinguishes selected from newly entered
structures, and adds a factual broadened-curve overview. The overview handles
stored-grid maxima, plateaus, flat curves, clipped boundaries, and visible-range
coverage without ranking derivatives or supplying scientific interpretations.
Only the text-based protocol was regenerated; D inspected all seven rendered
pages without finding layout defects.

The coordinator's final native check found one completeness edge in that fix:
the concise overview could omit weak peaks without exposing their locations
outside raw curve data. Commit `460a427` keeps the short overview but includes
every stored-curve maximum in the existing optional spectral-data disclosure,
clearly separated from discrete electronic transitions. This is completion of
the fourth correction, not an additional formal review cycle. The coordinator
opened the final disclosure in Safari and confirmed all four maxima of the real
test spectrum, including the omitted weaker band at approximately 4,0305 eV.

| Check | Final result |
| --- | --- |
| Full Python suite | 195 passed, 21 skipped; one existing Starlette/httpx deprecation warning. |
| JavaScript suite | 72 passed, none skipped. |
| Configured Ruff rules (`E9,F`) | Passed on changed Python files. |
| Ruff formatting | All seven changed Python files already formatted. |
| Diff whitespace check | Passed. |
| Teaching website | Ten pages built successfully. |
| Final text protocol | Seven pages rendered and individually inspected by D. |
| Original visual protocol | Byte-identical to `main`. |
| Original sighted exercise sequences | Verified unchanged by S; optional nonvisual guidance is separate. |

After the last JavaScript/HTML completeness correction, the relevant Python
website/material/accessibility checks were repeated in addition to the final
JavaScript suite. The missing Docker test package was supplied from a temporary
directory via `PYTHONPATH`; no project/runtime dependency or lock file was changed.

Native Safari integration checks confirmed:

- Real cis structure generation, GFN1-xTB minimum optimization and INDO/S-CIS
  spectrum calculation.
- Linear simplified build/optimization/spectrum order, immediate relevant
  results, one preference, supporting 2D art, and restoration of the original
  graphical spectrum without losing the selected structure.
- German comma input and format/range errors; `0,3` eV in the converter produces
  approximately 28,9456 kJ/mol and 4132,8066 nm rather than silently becoming 3 eV.
- Deliberate multi-observation capture, chemical atom-position labels, retention
  across source/step changes, and opening the downloaded readable HTML report.
- Visible desktop website-menu trigger and readable relocated utility controls.
- Representative simplified results and controls at 200% and 300% zoom. Safari's
  available page-zoom menu stops at 300% in this environment, so 400% was not
  claimed as a completed native test. Normal zoom was restored afterward.

## Remaining verification and scope limits

No JAWS, NVDA-on-Windows, physical Braille display, or blind-student usability
trial was available. Native accessibility-tree inspection and functional tests
do not establish WCAG conformance. Asynchronous website 3D/fallback transitions
have regression coverage; they were not additionally exercised natively in the
final integration pass. Optional longer scientific tests remained skipped as
reported by the suite; a real transition-structure search was not manually run
for the UI review.

The implementation does not include a generative chatbot, speech recognition,
application-owned speech synthesis, or newly manufactured tactile materials.
These were discussed as possible additions, not silently substituted for the
accessible core. The branch has not been pushed or deployed.
