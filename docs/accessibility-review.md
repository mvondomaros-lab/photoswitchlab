# Accessibility implementation and review

This report records the initial implementation, four review/correction cycles,
and the subsequent workflow revision requested for PhotoSwitchLab. The developer
implements changes; independent reviewers inspect nonvisual access (B), the
sighted student experience (S), and scientific learning goals (R). The
coordinating agent consolidates findings before each correction round.

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

## Cycle 4 final verification

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

## Workflow revision after the four cycles

The user subsequently asked for fewer controls, direct readable results instead
of a manual observation collection, independent task wording, and a better mode
selector. This is a targeted follow-up to the four recorded cycles. D implemented
the revision; B, S, and R critically reviewed the frozen commit `b381cc9` in
parallel, followed by a consolidated correction.

The revision makes these substantive changes:

- A styled native radio group selects `Grafisch` or `Barrierearm`, with the
  accessible name `Barrierearmer Arbeitsmodus`. Existing stored preferences and
  `?text=1` / `?text=0` links remain supported in the application and website.
- One inline native structure selector replaces the application dialog in the
  accessible workflow. The unit converter uses its existing fields inline;
  the former utility menu containing two actions is removed.
- Results and relevant comparisons appear directly in the application. Manual
  remembering, collecting, removing, and clearing observations are removed.
  Saving the readable HTML report is optional and uses the same report model.
- The primary spectrum table contains up to five positive-strength electronic
  transitions within the observation window, selected by oscillator strength
  and displayed in energy order. The full transition data remain optional.
  If the strongest visible transition is absent from the selection, a short
  additional observation preserves access to it.
- Comparisons use converged cis/trans minimum structures of the same derivative.
  Ring exchange and reversal are accounted for; ambiguous partners are not
  silently selected. A shared energy query provides both absorption values.
- Chemical names and structure types identify results. Full technical identifiers
  are optional metadata rather than repeated screenreader output.
- All nine accessible tasks are complete exercises. Their maintained HTML source
  also supplies the text protocol; there are no references to remembering
  results, mandatory exports, unavailable controls, or required image production.
  Public and Marburg deployments retain their separate course-content behavior.

Five transitions were chosen after inspecting the real unsubstituted cis
spectrum: its three strongest lines in the observation window are all in the UV,
whereas the fifth is a visible transition at approximately 2.8424 eV. Five is a
concise initial selection, not a claim that all relevant transitions fit in five
rows. A line graphic alone is insufficient for nonvisual access; the structured
energy/wavelength/oscillator-strength table carries the primary information.
The broadened curve still supplies the existing curve maximum, absorption at a
common energy, and optional color calculations. These quantities are not
silently replaced by the energy or oscillator strength of the strongest line.

### Frozen review findings

| ID | Priority | Demonstrated finding and agreed correction |
| --- | --- | --- |
| BR-1 | Medium | Automatically included partner spectra can be incomplete without their limitation appearing next to their numerical maximum or queried absorption. Add a short, structure-specific coverage note and explain unavailable queries using that structure's energy range. Retain valid stored curve values. |
| SR-1 | Low | Report tables display the same title as both an adjacent heading and a visible caption. Show one title while retaining the accessible table name, including in the HTML report. |
| SR-2 | Low | The inline converter repeats two long explanation paragraphs in every step. Keep the three fields and shorten the text to practical use and the necessary distinction between an energy difference and a photon excitation. |

B reproduced BR-1 with the production color module and CIE data: a complete
selected spectrum was paired with an incomplete partner. The partner's numeric
results remained available, but its coverage limitation was omitted. B also
checked missing selections and partner deletion. S confirmed SR-1 in source and
reviewed all eight rendered protocol pages without finding clipping or overflow.
The coordinator independently observed the duplicate headings in Safari.
R found the frozen exercises scientifically coherent and self-contained.
Reviewers did not edit product files or claim actual JAWS/Braille testing.

### User-confirmed change to the color learning objective

After the frozen review, the user questioned whether color comparison should be
required merely because it can be made accessible, and confirmed making it
optional. R supplied complete revised wording for spectrum tasks 6–9 and their
protocol deliverables. Color names, color distance, and weighted light
transmission become optional additions. Required work focuses on transition
energies, oscillator strengths, absorption maxima, and absorption at the same
photon energy. The UV/visible distinction remains a physical spectral range.

Task 9 retains its independent design hypothesis and the group comparison of
the smallest absorption-maximum energy. Its second group comparison now uses
one photon energy chosen jointly by the group: students determine which of
their derivatives has the largest difference between the cis and trans relative
absorption values at that energy. They report the energy and both values;
the application does not choose the energy, rank derivatives, or provide the
scientific interpretation. This is a comparison at the chosen energy, not a
global optimum over the spectrum.

Optional color information remains available within the existing additional
spectral data, rather than introducing another navigation menu. The decision
does not assume that blind students cannot understand color concepts: research
has found shared causal color understanding in congenitally blind and sighted
adults ([Kim et al., PNAS, 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC8379969/)).
The pedagogical judgment is to prioritize the experiment's spectral quantities.
The original graphical tasks and visual protocol remain unchanged.

### Correction and follow-up verification

Commit `3f18c4e` implements the consolidated correction and the user-confirmed
optional color objective. B reproduced the original incomplete-partner case with
the production color module and confirmed the structure-specific note in both
the application report and HTML output. Tests with different energy windows
preserve an available value while naming the unavailable structure and its
window; an entirely out-of-range query does not export a stale numerical table.
The note is not repeatedly duplicated beside each query.

S verified that each table has one visible title and retains its accessible
caption, the converter is concise, and all nine final protocol pages have clean
layout. R checked all revised task and deliverable paragraphs against the
generated DOCX: color-related terms appear only in the single optional addition,
and task 9 has the required common-energy and absorption-value answer fields.
All three reviewers reported no remaining findings in the targeted follow-up.

The coordinator's final website check found one additional cache defect: a
returning Safari session displayed unstyled native radios because the shared
header stylesheet retained its old URL. Reloading from the origin immediately
restored the intended segmented control. Commit `1a694ff` versions the website's
header stylesheet URL; D confirmed all ten built pages reference the existing
stylesheet with the new radio styles. This is an integration completion, not
another full review cycle.

| Check | Result for the completed workflow revision |
| --- | --- |
| Full Python suite after the consolidated correction | 196 passed, 21 skipped; one existing Starlette/httpx deprecation warning. |
| Full JavaScript suite after the consolidated correction | 73 passed, none skipped. |
| Configured Ruff rules and formatting | Passed for D's changed Python files. |
| Diff whitespace check | Passed. |
| Teaching website | Ten pages built successfully; versioned header stylesheet present on all pages. |
| Final text protocol | Nine pages rendered and individually inspected by D and S. |
| Original visual protocol | Byte-identical to `main`; SHA-256 `2cb086188c2eb203f1ee64d953b5f1bb6f0dec41a50350042a397327b2316711`. |
| Original nine graphical tasks | Paragraph and list sequences identical to `main`. |

Native Safari and artifact checks confirmed:

- Real converged unsubstituted cis/trans minimum structures and INDO/S-CIS
  spectra remain available across mode changes. The graphical return restores
  the original broadened curve and discrete lines with the selected structure.
- Both application mode radios work with keyboard arrow navigation and retain
  focus. Safari's Option+Tab was used to reach all HTML controls under its local
  keyboard-navigation preference; this is not a claim about Windows behavior.
- The inline structure list is keyboard reachable and exposes chemical names
  with structure types. Selecting cis produces five lines including the visible
  transition at 2.8424 eV; trans has only four positive-strength lines in the
  observation window and is not padded with zero-strength entries.
- A keyboard query at 3.0 eV produces cis/trans relative absorption values of
  0.0207 and 0.0133. German comma input is accepted, malformed input is explained,
  and keyboard focus remains on the query button after activation.
- The final primary report excludes color columns. The existing additional-data
  disclosure contains the explicitly voluntary color analysis. Downloading the
  readable HTML report succeeds; the downloaded artifact contains the same
  current spectrum, pair, and query values, with color in a closed optional
  section and no manual observation collection.
- Representative mode controls, navigation, and primary spectrum tables remain
  readable at 200% and 300% zoom. Safari offers no 400% page-zoom option in this
  environment. Zoom was verified restored to 100% afterward.
- Website mode radios work in both directions, restoring graphical sidebars or
  a compact inline contents control. The accessible preference persists when
  navigating to a fundamentals page without an explicit `text` URL parameter.

The website preview process was restarted after its previous local connection
failed; no application session or calculation data was reset. Its error was an
environment issue, separate from the subsequently demonstrated stylesheet cache
defect. Generated previews, downloaded reports, and render images remain outside
version control.

The verification limits above still apply. This follow-up did not manually
switch modes during a running calculation or run a transition-structure search;
the relevant state handling has source and regression-test coverage. There was
no actual JAWS/NVDA/Braille trial or student usability test. No chatbot or
application-owned speech input/output was added. No push or deployment occurred.

## Task embedding and numerical display refinement

The next user feedback requested a permanent task section, removal of technical
identifiers even from optional readable results, a fresh assessment of controls,
shorter numerical output, descending transition strength order, and a general
layout check. The fundamentals link should follow the converter, and the energy
probe needed space between its input and action. D implemented this consolidated
refinement in commit `74d921e`; B, S, and R reviewed that frozen commit in parallel.

The accessible task section now loads automatically in the reading flow before
the inputs. Its outer open/close controls are absent, and Escape cannot hide it.
Individual tasks retain their native disclosures to avoid presenting all long
exercises at once. This is an explicit information-density decision, distinct
from retaining a popup task panel. Loading failures have an inline retry.
Asynchronous responses cannot reopen a closed graphical panel, replace the wrong
mode's tasks, or steal focus. A deliberate retry only transfers focus to the
task heading if the retry control still has focus when loading finishes.

The control audit retains native structure, substituent, atom, and path choices
where an actual scientific selection is needed. One substituent disclosure
avoids ten unnecessary fields in the unsubstituted starting case; atom tools
remain one targeted secondary section. Actual reaction-path data are directly
open, while optimization iterations stay optional. Additional positive-strength
visible transitions are direct observations, without duplicating the strongest
five. Technical ring-index lists, duplicated transition-structure validation,
and the nearly empty metadata disclosure are removed. All readable identifiers,
including collision suffixes, are replaced with chemical names, structure types,
and human calculation numbers. Internal IDs remain in state and explicit
machine-data exports.

All transition lists now follow the user's requested descending raw oscillator
strength order, with energy and original transition number breaking ties. This
supersedes the energy-order presentation recorded earlier. Stored arrays and
the energy ordering of plotted curves are unchanged.

`ScientificDisplay` applies common presentation rules to both app modes,
readable reports, plots and the converter:

| Quantity | Normal presentation |
| --- | --- |
| Absolute electronic energy | Up to four decimal places, allowing student subtraction. |
| Energy difference or electronic energy barrier | Three significant digits. |
| Spectral maximum or transition energy | Two decimal places, locally increased for close distinct values. |
| Wavelength or distance | Whole nm or pm. |
| Angle | Up to one decimal place. |
| Oscillator strength or relative absorption | Two significant digits; tiny nonzero values use scientific notation. |
| Percentage | Up to one decimal place, without falsely rounding an interior value to an exact endpoint. |
| Frequency magnitude | Whole cm⁻¹, with explicit distinction near the 20 cm⁻¹ threshold. |
| Derived converter field | Up to four significant digits as editable, ungrouped decimal text. |

Padding zeros and negative zero are removed. A bounded local precision increase
distinguishes nearby comparison values; remaining display equality is identified
as rounding. Scientific-notation math spans provide German spoken alternatives.
Raw values continue to determine calculations, thresholds, selections, sorting,
and machine exports. Active converter input is never rewritten.

B found no current accessibility defect after the complete 86-test JavaScript
suite and additional reversed-response/mode-change harness sequences. R found
no precision or scientific-interpretation defect in the selected boundary cases.
S found no demonstrated layout defect in source/tests and the coordinator's
native observations. The independent reviews did not modify product files.

The coordinator independently confirmed:

- Fresh accessible-page loading shows the tasks without an open action and
  preserves document focus. The converter precedes the fundamentals link.
- The real trans spectrum displays transitions 2, 7, 3, 4 in descending strength
  order. Most energies are short, while 4.1613/4.1614 eV remain distinguishable.
  Safari's accessibility tree names the small strength as
  `2,9 mal zehn hoch minus 4`, alongside its visual scientific notation.
- At 3 eV the direct cis/trans comparison displays 0.021 and 0.013, retains the
  unrounded calculation, and leaves keyboard focus on the query action.
- The input/action gap is 8 CSS px. The tested transition table remains readable
  and its numbers unbroken at 300% zoom; no overlap was observed. Zoom was
  subsequently verified restored to 100%.
- A manually closed graphical task panel stays closed after a round trip through
  accessible mode. Returning to accessible mode restores the fixed task section,
  selected spectrum, and shared-energy query without losing data.

All 86 JavaScript tests and 196 Python tests passed; 21 Python tests remained
skipped, with the same existing Starlette/httpx warning. D's targeted Python,
syntax, configured Ruff and whitespace checks also passed. Both task sources and
both protocol binaries are unchanged from the preceding completed revision;
their existing render review therefore remains applicable. App tables receive
an extra keyboard stop only when overflowing; standalone HTML reports retain a
static scroll-focus fallback. Actual JAWS/NVDA/Braille testing remains unavailable.
Nothing was pushed or deployed.

## Identical deliverables for both task routes

An independent review of the frozen branch found that the graphical and accessible
spectrum tasks required different quantities and group results: color was required
in the graphical route but optional in the accessible route, and the task 9 group
comparison used a visually judged color difference in one route and same-energy
absorption in the other. A mixed group could not agree on one result.

The user decided, for a pass/fail course without optional deliverables:

- Predicted solution color and weighted transmission are descriptive required
  quantities in tasks 6–9 of both routes, marked as model predictions. No task ranks
  derivatives by color. The accessible report shows them as a primary section; the
  CIE76 distance remains only in the JSON export.
- In both routes, task 9 uses one group-chosen photon energy between 1.5 and 5.5 eV
  (the common observation window of all spectra) and the largest cis/trans difference
  of relative absorption there. The graphical route changed in two sentences and one
  protocol field. A difference is used rather than a ratio, which is unstable where
  one configuration barely absorbs.

Both protocols were regenerated. A paragraph-level text comparison against the
previous binaries shows only the intended changes; the rendered pages 7 (visual)
and 5, 6, 8 and 9 (text) were inspected without layout defects. All 86 JavaScript
tests and 196 Python tests passed (21 skipped). No screen-reader test was performed.

### Proportionate accessible deliverables

Following user feedback that sighted tasks must not become more complicated and that
the course aims at engagement rather than formal equivalence, the accessible
deliverables were reduced to the scope of the graphical tasks instead: one named
atom pair in task 4, a three-row path table (relative energy and C–N=N–C dihedral)
in task 5, no additional absorption-value table in task 6, and no band-position
list in task 7. The app still shows these data. The graphical tasks and visual
protocol are unchanged. Rendered text-protocol pages 3–6 were inspected.

## Phase 2: announcements, feedback and labels

Targeted corrections from the independent review, kept free of new controls:

- Atom-list changes no longer trigger live announcements; the result paragraph
  follows the list. Path and step tables stay hidden and unchanged while a
  calculation runs, so polling does not rebuild content under a screen reader.
- Completed jobs name their result (minimum found or not, transition structure
  confirmed or not, spectrum calculated). Symmetry-equivalent input reports the
  existing structure by its chemical name instead of “Struktur erstellt”.
- Atom labels name the ring (“C2′ im zweiten Ring”), and accessible-mode
  substituent options name the group (“Methoxy (OCH₃)”), so chemical identity does
  not depend on how a prime or subscript digit is spoken or brailled.
- Enter starts the absorption query. Report files include the step and a creation
  time, and saving is announced. App tables expose a named region only while they
  scroll horizontally. English method names carry `lang="en"`.

All 90 JavaScript tests and 196 Python tests passed (21 skipped). These changes
were not checked in a browser or with a screen reader.

## Phase 3: comparison and sonification

- The graphical spectrum overlays the automatically paired other configuration as
  a dashed curve with a legend entry, and shows its color estimate next to the
  selected one. The PNG export names the dashed curve. No control was added.
- A next-step button (commit `689d038`) was removed again: for sighted students it
  duplicated the step bar, and screen-reader users reach the labelled step
  navigation directly.
- Chart2Music 1.20.0 (MIT, vendored) makes the broadened curves explorable by
  keyboard, speech and pitch as a focusable element in the accessible spectrum
  result only. The graphical spectrum stays a described image, so no sound can start
  in a lab room full of sighted students.
  Both configurations are groups on a common 0.05 eV grid; values below 0.001 are
  spoken as “unter 0,001”. Without the library the canvas remains a described image.

Chart2Music was exercised in jsdom with the production configuration: application
role, tab stop, German summary, arrow-key movement, group switching and the focus
callback behaved as expected. No real browser, audio output, JAWS, NVDA or Braille
test was possible in this session; Chart2Music's help dialog partly shows English
key names.

A later native check used headless Chrome on the local preview with real GFN1-xTB
minima and INDO/S–CIS spectra of cis- and trans-azobenzene. Graphical mode showed the
dashed trans curve, both color estimates, an image-role canvas without a tab stop,
and no sonification element. Accessible mode exposed the sonification as a focusable
application with the German summary; 26 right-arrow steps announced “2,8 eV, 443 nm,
0,034”, and Page Down switched to trans-azobenzene. Audio and screen readers were not
tested.

Chart2Music creates its AudioContext on the first key press but never resumes it, so
Safari can keep it suspended and play no sound. The app passes its own small audio
engine that resumes the context within each key press and plays a short triangle
tone with stereo panning. In headless Chrome, arrow, End and Home produced three
tones panned at −0.96, 0.98 and −0.98. Safari playback was not re-tested by the
agent; speech output requires a running screen reader.

The accessible spectrum result now also shows the existing chart (moved with a
restoration marker, including the dashed partner curve) before the sonification
field. Exploring with Chart2Music marks the current point in the chart. In headless
Chrome, 39 right-arrow steps marked x = 3,45 eV and wrote “3,45 eV, 359 nm, 0,14” to
the live region; returning to graphical mode restored the chart to its original
position without the marker. A visible copy of the announced value was removed again
at the instructor's request: the marker shows the position, screen readers speak the
value, and exact values remain available from the absorption query field. The live
region is visually hidden (`sr-only`).

The “Weitere Spektraldaten” disclosure (all transitions and all local curve maxima)
was removed. No task needs these lists: the saved report contains the five strongest
transitions, every further visible transition, Emax, the cis/trans pair and the
color, while the absorption query, sonification and chart cover the curve. Complete
data remain in the JSON/CSV export.

## Website review against the same criteria

axe-core 4.10 found no violations on eight pages in either presentation (headless
Chrome, all disclosures open). Corrections: a text alternative now describes where
the fixed input positions lie relative to the azo group (needed for steric reasoning
and the 2-, 3- and 4-substituted series); two alt texts name the shown content
instead of only the topic; the build merges upright MathML letters (`cis` as one
identifier) and decimal-comma numbers (`932,48` as one number) so screen readers and
Braille displays do not split them; table cells use less padding below 400 px.
Not tested: screen-reader speech of the corrected MathML.

The light chapter now offers a Chart2Music practice field for the band spectrum
(peaks at 3,0 and 4,0 eV), shown and lazily loaded only in the accessible
presentation, so a blind student can learn the app's sonification keys before the
lab without a joint trial. The Safari-compatible audio engine moved to the shared
`sonification-audio.js`. In headless Chrome the field stayed hidden and Chart2Music
unloaded in graphical mode; in accessible mode 30 right-arrow steps reached
“3,00 eV, 413 nm, 0,5” in the live region.
