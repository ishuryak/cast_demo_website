// Self-test engine for the causal roadmap primer. Same behavior as the
// interactive_tests family: shuffled questions and choices, explanation and
// source after each answer, a report of misses at the end.
// Questions live in bank.json (built by build_bank.mjs). A single-file preview
// may set window.QUIZ_DATA instead, so the page also works without a server,
// and window.QUIZ_PRIMER_URL to point the review links at a paired primer file.
//
// Keyboard contract:
//   - Links and buttons keep their native behavior. Enter on a link navigates,
//     Enter or Space on a button clicks it once. No global Enter handler.
//   - Keys A to E pick an answer only while focus is inside the question region
//     (heading, answers or buttons), and are ignored when the event is composing,
//     repeated, already handled, modified, or comes from a text field.
//   - Arrow keys move between the answers (native radio group).
//   - Enter on a focused answer submits it.
//   - Focus moves to the question heading after start, next and retake, and to the
//     result heading at the end. A polite status region announces the verdict.
(function () {
  "use strict";
  const LETTERS = ["A", "B", "C", "D", "E"];
  const EMOJI = ["🎉", "🌟", "👏", "💪", "✅", "🎯", "🙌", "👍", "🧠"];
  // Primer section anchors, in roadmap order, with the label the report shows.
  const SECTIONS = {
    questions: "0 · Which question?",
    question: "1 · The question and the data",
    trial: "2 · The target trial",
    dag: "3 · The causal model",
    estimand: "4 · The estimand",
    identify: "5 · Identification",
    policies: "6 · Treatment policies",
    estimators: "7 · The estimator",
    checks: "8 · Checks and sensitivity",
    rct: "9 · Randomized trial data",
    "trial-argument": "10 · The end goal",
  };
  // Where the primer lives. Served site: the parent directory. Standalone
  // previews set window.QUIZ_PRIMER_URL (for example "primer_full.html").
  const PRIMER = typeof window.QUIZ_PRIMER_URL === "string" && window.QUIZ_PRIMER_URL ? window.QUIZ_PRIMER_URL : "../";
  const $ = (id) => document.getElementById(id);
  const app = $("app");
  let DATA, state;

  function shuffle(a) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function refText(nums) {
    return (nums || []).map((n) => {
      const r = DATA.refs.find((x) => x.n === n);
      return r ? `<a href="${esc(PRIMER)}#ref-${n}">[${n}]</a> ${esc(r.citation)}` : `[${n}]`;
    }).join("<br>");
  }
  function sectionLink(id) {
    return `<a href="${esc(PRIMER)}#${esc(id)}">${esc(SECTIONS[id] || id)}</a>`;
  }
  function announce(msg) { const s = $("status"); if (s) s.textContent = msg; }

  function updateBar() {
    const n = state ? state.qs.length : 0;
    $("qnum").textContent = state ? Math.min(state.i + 1, n) : 0;
    $("qtot").textContent = n;
    $("score").textContent = state ? state.score : 0;
    $("attempted").textContent = state ? state.attempted : 0;
    $("fill").style.width = state && n ? (100 * state.attempted / n) + "%" : "0";
  }

  function start() {
    const qs = shuffle(DATA.questions).map((q) => {
      const order = shuffle([0, 1, 2, 3, 4]);
      return { ...q, opts: order.map((i) => q.choices[i]), correct: order.indexOf(q.answer) };
    });
    state = { qs, i: 0, picked: null, submitted: false, score: 0, attempted: 0, log: [] };
    announce("");
    render();
  }

  function focusHeading(id) {
    const h = $(id);
    if (h) h.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }

  function render() {
    updateBar();
    if (state.i >= state.qs.length) return report();
    const q = state.qs[state.i], n = state.qs.length;
    app.innerHTML = `
      <section class="question" id="qregion" aria-labelledby="qhead">
        <p class="eyebrow"><span class="topic">${esc(q.topic)}</span> · ${sectionLink(q.section)}</p>
        <h2 class="stem" id="qhead" tabindex="-1"><span class="qcount">Question ${state.i + 1} of ${n}. </span>${esc(q.stem)}</h2>
        <p class="hint" id="qhint">Choose one answer, then submit. Keys A to E pick an answer while you are in this question.</p>
        <fieldset class="choices" id="choices" aria-labelledby="qhead" aria-describedby="qhint">
          ${q.opts.map((t, k) => `
            <label class="choice" id="c${k}">
              <input type="radio" name="opt" id="opt${k}" value="${k}">
              <span class="letter" aria-hidden="true">${LETTERS[k]}</span><span class="text"><span class="visually-hidden">${LETTERS[k]}. </span>${esc(t)}</span>
            </label>`).join("")}
        </fieldset>
        <div id="fb"></div>
        <div class="actions">
          <button id="submit" type="button" disabled>Submit</button>
          <button id="next" type="button" class="secondary" hidden>Next question</button>
        </div>
      </section>`;
    app.querySelectorAll("input[name=opt]").forEach((inp) => inp.addEventListener("change", () => pick(+inp.value)));
    $("submit").addEventListener("click", submit);
    $("next").addEventListener("click", next);
    $("qregion").addEventListener("keydown", onQuestionKey);
    state.picked = null;
    state.submitted = false;
    announce("");
    focusHeading("qhead");
  }

  function pick(k) {
    if (!state || state.submitted || state.i >= state.qs.length) return;
    state.picked = k;
    app.querySelectorAll(".choice").forEach((el, j) => el.classList.toggle("selected", j === k));
    const r = $("opt" + k);
    if (r) r.checked = true;
    $("submit").disabled = false;
  }

  function submit() {
    // Guard: one submission per question, whatever calls it and however often.
    if (!state || state.submitted || state.picked === null || state.i >= state.qs.length) return;
    state.submitted = true;
    const q = state.qs[state.i], ok = state.picked === q.correct;
    state.attempted++;
    if (ok) state.score++;
    state.log.push({ q, picked: state.picked, ok });
    $("submit").disabled = true;
    $("choices").classList.add("locked");
    app.querySelectorAll("input[name=opt]").forEach((x) => (x.disabled = true));
    // Text tags as well as color, so the result reads without color.
    $("c" + q.correct).classList.add("correct");
    $("c" + q.correct).insertAdjacentHTML("beforeend", `<span class="tag tag-right"><span aria-hidden="true">✓ </span>Correct answer</span>`);
    if (!ok) {
      $("c" + state.picked).classList.add("wrong");
      $("c" + state.picked).insertAdjacentHTML("beforeend", `<span class="tag tag-wrong"><span aria-hidden="true">✗ </span>Your answer</span>`);
    }
    const emoji = EMOJI[Math.floor(Math.random() * EMOJI.length)];
    const verdict = ok ? "Correct." : `Not quite. The correct answer is ${LETTERS[q.correct]}.`;
    $("fb").innerHTML = `<div class="feedback ${ok ? "is-right" : "is-wrong"}" id="fbbox" tabindex="-1" role="group" aria-label="Feedback on your answer" data-verdict="${ok ? "correct" : "wrong"}">
        <p class="verdict"><span class="mark" aria-hidden="true">${ok ? "✓" : "✗"}</span> ${verdict}${ok ? ` <span class="emoji" aria-hidden="true">${emoji}</span>` : ""}</p>
        <p class="why">${esc(q.explanation)}</p>
        <p class="src">Source: ${refText(q.refs)}</p>
        <p class="src">Review in the primer: ${sectionLink(q.section)}</p>
      </div>`;
    announce(`${verdict} Score ${state.score} of ${state.attempted}.`);
    $("submit").hidden = true;
    const nx = $("next");
    nx.hidden = false;
    nx.textContent = state.i === state.qs.length - 1 ? "See report" : "Next question";
    $("fbbox").focus({ preventScroll: false });
    updateBar();
  }

  function next() {
    if (!state || !state.submitted || state.i >= state.qs.length) return;
    state.i++;
    render();
  }

  // Letter and Enter shortcuts, scoped to the question region.
  function onQuestionKey(e) {
    if (e.defaultPrevented || e.isComposing || e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(TEXTAREA|SELECT)$/.test(t.tagName) || (t.tagName === "INPUT" && t.type !== "radio"))) return;
    if (!state || state.submitted) return;
    if (e.key === "Enter") {
      // Only on an answer: links and buttons keep their native Enter.
      if (t && t.tagName === "INPUT" && t.type === "radio" && state.picked !== null) { e.preventDefault(); submit(); }
      return;
    }
    if (e.key.length !== 1) return;
    const k = LETTERS.indexOf(e.key.toUpperCase());
    if (k < 0) return;
    e.preventDefault();
    pick(k);
    const r = $("opt" + k);
    if (r) r.focus();
  }

  function report() {
    updateBar();
    const misses = state.log.filter((x) => !x.ok);
    const pct = Math.round(100 * state.score / state.qs.length);
    // Score per primer section, in roadmap order, so a reader knows what to reread.
    const bySec = Object.keys(SECTIONS).map((id) => {
      const rows = state.log.filter((x) => x.q.section === id);
      return { id, n: rows.length, right: rows.filter((x) => x.ok).length };
    }).filter((s) => s.n > 0);
    app.innerHTML = `
      <div class="report-head">
        <h2 class="eyebrow" id="rhead" tabindex="-1">Final score</h2>
        <p class="big">${state.score} / ${state.qs.length} <span class="hint">(${pct}%)</span></p>
        <p class="hint">${misses.length ? misses.length + " question" + (misses.length > 1 ? "s" : "") + " to review below." : "No misses. Every question answered correctly."}</p>
      </div>
      <h2>By section of the primer</h2>
      <table class="by-sec"><thead><tr><th scope="col">Section</th><th scope="col">Correct</th></tr></thead><tbody>
        ${bySec.map((s) => `<tr class="${s.right < s.n ? "weak" : ""}"><td>${sectionLink(s.id)}</td><td class="num">${s.right} / ${s.n}${s.right < s.n ? ' <span class="visually-hidden">(review)</span>' : ""}</td></tr>`).join("")}
      </tbody></table>
      ${misses.length ? "<h2>Questions answered incorrectly</h2>" : ""}
      ${misses.map((m) => `
        <div class="miss">
          <div class="row"><span>Question</span><span>${esc(m.q.stem)}</span></div>
          <div class="row"><span>Your answer</span><span class="yours"><span aria-hidden="true">✗ </span>${LETTERS[m.picked]}. ${esc(m.q.opts[m.picked])}</span></div>
          <div class="row"><span>Correct</span><span class="right"><span aria-hidden="true">✓ </span>${LETTERS[m.q.correct]}. ${esc(m.q.opts[m.q.correct])}</span></div>
          <div class="row"><span>Why</span><span>${esc(m.q.explanation)}</span></div>
          <div class="row"><span>Review</span><span>${sectionLink(m.q.section)}</span></div>
        </div>`).join("")}
      <details><summary>References used in this test</summary>
        <ol class="refs">${DATA.refs.map((r) => `<li value="${r.n}">${esc(r.citation)}${r.url ? ` <a href="${esc(r.url)}">${esc(r.url.replace(/^https:\/\/doi\.org\//, "doi:"))}</a>` : ""}</li>`).join("")}</ol>
      </details>
      <div class="actions"><button id="again" type="button">Retake (new order)</button> <a class="btn-link" href="${esc(PRIMER)}">Back to the primer</a></div>`;
    $("again").addEventListener("click", start);
    announce(`Finished. Final score ${state.score} of ${state.qs.length}.`);
    focusHeading("rhead");
  }

  // A bank the engine can run: 30-ish questions, five choices each, a valid key.
  function bankProblem(d) {
    if (!d || typeof d !== "object") return "the file is not a question bank";
    if (!Array.isArray(d.questions) || d.questions.length === 0) return "it has no questions";
    if (!Array.isArray(d.refs)) return "it has no reference list";
    for (const q of d.questions) {
      if (!q || typeof q.stem !== "string" || !Array.isArray(q.choices) || q.choices.length !== 5 ||
          !Number.isInteger(q.answer) || q.answer < 0 || q.answer > 4 || typeof q.explanation !== "string" ||
          !Array.isArray(q.refs)) return `question ${q && q.id ? q.id : "?"} is incomplete`;
    }
    return "";
  }

  function fail(why) {
    const b = $("start");
    b.disabled = true;
    b.textContent = "Self-test unavailable";
    const m = $("loaderr");
    m.hidden = false;
    m.textContent = `The questions could not be loaded (${why}), so the self-test cannot start. ` +
      (location.protocol === "file:" ? "Open this page from a web server, or use the single-file preview." : "Please reload the page or try again later.");
  }

  function ready(data) {
    const problem = bankProblem(data);
    if (problem) return fail(`the question bank is invalid: ${problem}`);
    DATA = data;
    $("glossary").innerHTML = (data.glossary || []).map(([a, full]) => `<dt>${esc(a)}</dt><dd>${esc(full)}</dd>`).join("");
    const b = $("start");
    b.disabled = false;
    b.textContent = `Start the ${data.questions.length} questions`;
    b.addEventListener("click", start);
    updateBar();
  }
  // Exposed for the headless play-through test only.
  window.__quiz = { pick: (k) => pick(k), submit: () => submit(), next: () => next(), start: () => start(), get state() { return state; } };

  if (window.QUIZ_DATA !== undefined) ready(window.QUIZ_DATA);
  else fetch("bank.json", { signal: AbortSignal.timeout ? AbortSignal.timeout(15000) : undefined })
    .then((r) => { if (!r.ok) throw new Error(`bank.json returned HTTP ${r.status}`); return r.text(); })
    .then((t) => { let d; try { d = JSON.parse(t); } catch (e) { throw new Error("bank.json is not valid JSON"); } ready(d); })
    .catch((e) => fail(e && e.name === "TimeoutError" ? "bank.json did not load within 15 seconds" : e && e.message ? e.message : "bank.json is missing"));
})();
