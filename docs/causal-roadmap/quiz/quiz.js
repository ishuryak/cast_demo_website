// Self-test engine for the causal roadmap primer. Same behavior as the
// interactive_tests family: shuffled questions and choices, A to E and Enter keys,
// explanation and source after each answer, a report of misses at the end.
// Questions live in bank.json (built by build_bank.mjs). A single-file preview
// may set window.QUIZ_DATA instead, so the page also works without a server.
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
      return r ? `<a href="../#ref-${n}">[${n}]</a> ${esc(r.citation)}` : `[${n}]`;
    }).join("<br>");
  }
  function sectionLink(id) {
    return `<a href="../#${id}">${esc(SECTIONS[id] || id)}</a>`;
  }

  function updateBar() {
    const n = state ? state.qs.length : 0;
    $("qnum").textContent = state ? Math.min(state.i + 1, n) : 0;
    $("qtot").textContent = n;
    $("score").textContent = state ? state.score : 0;
    $("attempted").textContent = state ? state.attempted : 0;
    $("fill").style.width = state ? (100 * state.attempted / n) + "%" : "0";
  }

  function start() {
    const qs = shuffle(DATA.questions).map((q) => {
      const order = shuffle([0, 1, 2, 3, 4]);
      return { ...q, opts: order.map((i) => q.choices[i]), correct: order.indexOf(q.answer) };
    });
    state = { qs, i: 0, picked: null, submitted: false, score: 0, attempted: 0, log: [] };
    render();
  }

  function render() {
    updateBar();
    if (state.i >= state.qs.length) return report();
    const q = state.qs[state.i];
    app.innerHTML = `
      <p class="eyebrow">${esc(q.topic)} · ${sectionLink(q.section)}</p>
      <p class="stem">${esc(q.stem)}</p>
      <fieldset class="choices" id="choices">
        <legend class="hint">Choose one answer, then submit.</legend>
        ${q.opts.map((t, k) => `
          <label class="choice" id="c${k}">
            <input type="radio" name="opt" id="opt${k}" value="${k}">
            <span class="letter">${LETTERS[k]}</span><span class="text">${esc(t)}</span>
          </label>`).join("")}
      </fieldset>
      <div class="actions">
        <button id="submit" type="button" disabled>Submit</button>
        <button id="next" type="button" class="secondary" hidden>Next question</button>
      </div>
      <div id="fb"></div>`;
    app.querySelectorAll("input[name=opt]").forEach((inp) => inp.addEventListener("change", () => pick(+inp.value)));
    $("submit").addEventListener("click", submit);
    $("next").addEventListener("click", next);
    state.picked = null;
    state.submitted = false;
    window.scrollTo({ top: 0 });
  }

  function pick(k) {
    if (state.submitted) return;
    state.picked = k;
    app.querySelectorAll(".choice").forEach((el, j) => el.classList.toggle("selected", j === k));
    const r = $("opt" + k);
    if (r) r.checked = true;
    $("submit").disabled = false;
  }

  function submit() {
    if (state.submitted || state.picked === null) return;
    state.submitted = true;
    const q = state.qs[state.i], ok = state.picked === q.correct;
    state.attempted++;
    if (ok) state.score++;
    state.log.push({ q, picked: state.picked, ok });
    $("choices").classList.add("locked");
    app.querySelectorAll("input[name=opt]").forEach((x) => (x.disabled = true));
    $("c" + q.correct).classList.add("correct");
    if (!ok) $("c" + state.picked).classList.add("wrong");
    const emoji = EMOJI[Math.floor(Math.random() * EMOJI.length)];
    $("fb").innerHTML = `<div class="feedback ${ok ? "" : "is-wrong"}">
        <div class="verdict">${ok ? `<span class="emoji" aria-hidden="true">${emoji}</span> Correct` : `Not quite. The answer is ${LETTERS[q.correct]}.`}</div>
        <div>${esc(q.explanation)}</div>
        <div class="src">Source: ${refText(q.refs)}</div>
        <div class="src">Review in the primer: ${sectionLink(q.section)}</div>
      </div>`;
    $("submit").hidden = true;
    const nx = $("next");
    nx.hidden = false;
    nx.textContent = state.i === state.qs.length - 1 ? "See report" : "Next question";
    nx.focus();
    updateBar();
  }

  function next() { state.i++; render(); }

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
        <p class="eyebrow">Final score</p>
        <p class="big">${state.score} / ${state.qs.length} <span class="hint">(${pct}%)</span></p>
        <p class="hint">${misses.length ? misses.length + " question" + (misses.length > 1 ? "s" : "") + " to review below." : "No misses. Every question answered correctly."}</p>
      </div>
      <h2>By section of the primer</h2>
      <table class="by-sec"><thead><tr><th>Section</th><th>Correct</th></tr></thead><tbody>
        ${bySec.map((s) => `<tr class="${s.right < s.n ? "weak" : ""}"><td>${sectionLink(s.id)}</td><td class="num">${s.right} / ${s.n}</td></tr>`).join("")}
      </tbody></table>
      ${misses.length ? "<h2>Questions answered incorrectly</h2>" : ""}
      ${misses.map((m) => `
        <div class="miss">
          <div class="row"><span>Question</span><span>${esc(m.q.stem)}</span></div>
          <div class="row"><span>Your answer</span><span class="yours">${LETTERS[m.picked]}. ${esc(m.q.opts[m.picked])}</span></div>
          <div class="row"><span>Correct</span><span class="right">${LETTERS[m.q.correct]}. ${esc(m.q.opts[m.q.correct])}</span></div>
          <div class="row"><span>Why</span><span>${esc(m.q.explanation)}</span></div>
          <div class="row"><span>Review</span><span>${sectionLink(m.q.section)}</span></div>
        </div>`).join("")}
      <details><summary>References used in this test</summary>
        <ol class="refs">${DATA.refs.map((r) => `<li value="${r.n}">${esc(r.citation)}${r.url ? ` <a href="${esc(r.url)}">${esc(r.url.replace(/^https:\/\/doi\.org\//, "doi:"))}</a>` : ""}</li>`).join("")}</ol>
      </details>
      <div class="actions"><button id="again" type="button">Retake (new order)</button> <a class="btn-link" href="../">Back to the primer</a></div>`;
    $("again").addEventListener("click", start);
    window.scrollTo({ top: 0 });
  }

  document.addEventListener("keydown", (e) => {
    if (!state || state.i >= state.qs.length || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target && /^(TEXTAREA|INPUT)$/.test(e.target.tagName) && e.target.type !== "radio") return;
    const k = LETTERS.indexOf(e.key.toUpperCase());
    if (k >= 0 && !state.submitted) { pick(k); return; }
    if (e.key === "Enter") { e.preventDefault(); state.submitted ? next() : submit(); }
  });

  function ready(data) {
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

  if (window.QUIZ_DATA) ready(window.QUIZ_DATA);
  else fetch("bank.json").then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(ready).catch(() => {
    $("start").textContent = "Questions could not be loaded. Open this page from a web server, not as a local file.";
  });
})();
