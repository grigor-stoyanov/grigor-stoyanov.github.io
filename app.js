(function () {
  "use strict";
  const OWNER = "grigor-stoyanov";
  const REPO = "grigor-stoyanov.github.io";
  const API = "https://api.github.com";
  const TOKEN_KEY = "portfolio-owner-token";

  const certs = [
    { name: "AWS Certified AI Practitioner", by: "AWS", year: 2026, cat: "Cloud & AI", cred: true, skills: ["AWS", "AI"] },
    { name: "Certified Mid-Level Angular Developer", by: "certificates.dev", year: 2026, cat: "Front end", cred: true, skills: ["Angular", "TypeScript"] },
    { name: "Professional Scrum Developer I", by: "Scrum.org", year: 2025, cat: "Delivery", cred: true, skills: ["Scrum"] },
    { name: "AWS Certified Cloud Practitioner", by: "AWS", year: 2024, cat: "Cloud & AI", cred: true, skills: ["AWS"] },
    { name: "Spring Boot Fundamentals", by: "Udemy", year: 2023, cat: "Back end", skills: ["Java", "Spring Boot"] },
    { name: "OAuth 2.0 in Spring Boot Applications", by: "Udemy", year: 2023, cat: "Back end", skills: ["Java", "Spring Boot"] },
    { name: "React – The Complete Guide (Router & Redux)", by: "Udemy", year: 2023, cat: "Front end", skills: ["React", "JavaScript"] },
    { name: "MongoDB Python Developer Path", by: "MongoDB University", year: 2023, cat: "Back end", skills: ["Python", "MongoDB"] },
    { name: "Power Platform Fundamentals (PL-900)", by: "Microsoft", year: 2023, cat: "Cloud & AI", cred: true, skills: ["Power Platform"] },
    { name: "Azure Fundamentals (AZ-900)", by: "Microsoft", year: 2023, cat: "Cloud & AI", cred: true, skills: ["Azure"] },
    { name: "Software Engineer with Python – Professional Diploma", by: "SoftUni", year: 2022, cat: "Back end", cred: true, skills: ["Python", "Django"] },
    { name: "HTML & CSS / Angular", by: "SoftUni", year: 2022, cat: "Front end", skills: ["HTML & CSS", "Angular"] },
    { name: "JS Advanced / JS Applications", by: "SoftUni", year: 2021, cat: "Front end", skills: ["JavaScript"] }
  ];
  const baseSkills = ["JavaScript", "TypeScript", "React", "Angular", "HTML & CSS", "Node.js", "Python", "Django", "Java", "Spring Boot", "MongoDB", "AWS", "Azure", "AI", "Power Platform", "Scrum"];

  // ---- state ----
  let data = null;          // contents of data.json
  let dataSha = null;       // sha of data.json (owner only, for commits)
  let live = null;          // repos from GitHub API, by name
  let liveErr = "";
  let token = null, isOwner = false, preview = false;
  let active = null, cat = "All";
  let editing = null, busy = false, toastMsg = "";
  let drawerOpen = false, draft = null, dirty = false, openRow = null, closeArmed = false;
  let signinOpen = false, signinErr = "";

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (d) => { if (!d) return ""; const x = new Date(d); return isNaN(x) ? "" : x.toLocaleDateString("en-GB", { month: "short", year: "numeric" }); };
  const byPushed = (a, b) => (b.pushed_at || "").localeCompare(a.pushed_at || "");
  const showOwner = () => isOwner && !preview;
  const C = (k) => esc(data.content[k]);
  const F = (k, tag = "span", cls = "") => `<${tag} data-field="${k}"${cls ? ` class="${cls}"` : ""}>${C(k)}</${tag}>`;
  const b64 = (str) => { const bytes = new TextEncoder().encode(str); let bin = ""; bytes.forEach((b) => (bin += String.fromCharCode(b))); return btoa(bin); };
  const unb64 = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\n/g, "")), (c) => c.charCodeAt(0)));
  function store(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (_) {} }
  function load(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }

  async function gh(path, opts = {}) {
    const headers = { Accept: "application/vnd.github+json", ...(opts.headers || {}) };
    if (token) headers.Authorization = "Bearer " + token;
    const res = await fetch(API + path, { ...opts, headers, cache: "no-store" });
    const body = res.status === 204 ? null : await res.json().catch(() => null);
    if (!res.ok) { const e = new Error((body && body.message) || res.statusText); e.status = res.status; throw e; }
    return body;
  }

  // merge a featured entry with live GitHub data (owner overrides win)
  function project(f) {
    const g = live && live[f.name];
    return {
      name: f.name,
      url: (g && g.html_url) || f.url || `https://github.com/${OWNER}/${f.name}`,
      title: f.title || f.name,
      desc: f.desc || (g && g.description) || "",
      lang: f.lang || (g && g.language) || "",
      pushed_at: (g && g.pushed_at) || f.pushed_at || "",
      stars: g ? g.stargazers_count : 0,
      tags: f.tags || []
    };
  }

  function editTools(sec) {
    if (!showOwner()) return "";
    if (editing === sec) return `<div class="edit-tools"><button class="edit-btn solid" data-save="${sec}" ${busy ? "disabled" : ""}>Save</button><button class="edit-btn" data-cancel>Cancel</button></div>`;
    return `<div class="edit-tools"><button class="edit-btn" data-edit="${sec}" ${editing ? "disabled" : ""}>Edit</button></div>`;
  }

  function render() {
    if (!data) { $("app").innerHTML = `<div class="wrap" style="padding-block:80px"><p class="label">Plotting course…</p></div>`; return; }
    const featured = data.featured.map(project).sort(byPushed);
    const skills = [...new Set([...baseSkills, ...featured.flatMap((r) => r.tags)])];
    const total = live ? Object.keys(live).length : null;
    const cats = ["All", ...new Set(certs.map((c) => c.cat))];
    const list = certs.filter((c) => cat === "All" || c.cat === cat);
    const years = [...new Set(list.map((c) => c.year))].sort((a, b) => b - a);
    const np = featured.filter((p) => p.tags.includes(active)).length, nc = certs.filter((c) => c.skills.includes(active)).length;

    $("app").innerHTML = `
<header class="hero${editing === "hero" ? " editing" : ""}">
  <svg class="contours" viewBox="0 0 1200 420" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <path class="deep" d="M640 420 C700 300 860 260 960 300 S1150 380 1200 330"/>
    <path d="M520 420 C600 290 760 210 900 240 S1120 330 1200 280"/>
    <path d="M600 420 C660 320 800 270 930 290 S1130 360 1200 320"/>
    <path d="M700 0 C760 70 900 90 1010 60 S1160 20 1200 40"/>
    <path d="M760 0 C820 50 930 60 1030 40 S1170 10 1200 20"/>
    <path d="M820 140 C860 110 930 110 960 140 S940 200 880 196 S800 170 820 140Z"/>
    <path d="M845 145 C870 128 915 128 935 146 S920 182 885 180 S832 162 845 145Z"/>
  </svg>
  ${showOwner() ? `<div class="hero-edit">${editTools("hero")}</div>` : ""}
  <div class="wrap">
    <div class="pos"><span><b>POS</b> 43°12′N 027°55′E</span><span><b>STATUS</b> Underway</span><span><b>HDG</b> Full stack → AI</span></div>
    <div><h1>Grigor Stoyanov</h1>${F("role", "p", "role")}</div>
    ${F("lede", "p", "lede")}
    <div class="links">
      <a class="btn primary" href="https://github.com/${OWNER}" target="_blank" rel="noopener">GitHub profile</a>
      <a class="btn" href="https://www.linkedin.com/in/grigor-stoyanov-b5ab791aa/" target="_blank" rel="noopener">LinkedIn</a>
    </div>
  </div>
</header>
<main>
  <section class="${editing === "about" ? "editing" : ""}"><div class="wrap">
    <div class="heading-row"><div><span class="label">Ship's log</span><h2>About me</h2></div>${editTools("about")}</div>
    <div class="about">${[1, 2, 3].map((i) => `<div><span class="mark">${["◆", "◇", "◈"][i - 1]} 0${i}</span>${F("a" + i + "t", "h3")}${F("a" + i, "p")}</div>`).join("")}</div>
  </div></section>

  <section><div class="wrap">
    <div class="heading-row"><div><span class="label">Chart legend</span><h2>Skills</h2></div></div>
    <div class="legend">${skills.map((s) => `<button class="chip" data-skill="${esc(s)}" aria-pressed="${s === active}">${esc(s)}</button>`).join("")}</div>
    <p class="legend-note">${active ? `<strong>${esc(active)}</strong>: ${np} project${np === 1 ? "" : "s"}, ${nc} certification${nc === 1 ? "" : "s"}. <button class="clear" data-clear>Show all</button>` : "Pick a skill to highlight the matching projects and certifications."}</p>
  </div></section>

  <section><div class="wrap">
    <div class="heading-row"><div><span class="label">Live from GitHub</span><h2>Projects</h2></div><span class="label">${featured.length} featured${total != null ? ` of ${total} public` : ""}</span></div>
    ${featured.length ? `<div class="grid">${featured.map((p) => `<a class="proj${active && !p.tags.includes(active) ? " dim" : ""}" href="${esc(p.url)}" target="_blank" rel="noopener">
      <div class="top">${p.lang ? `<span class="lang"><span class="dot"></span>${esc(p.lang)}</span>` : "<span></span>"}<span class="slug">/${esc(p.name)}</span></div>
      <h3>${esc(p.title)}</h3><p>${esc(p.desc)}</p>
      <div class="tags">${p.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}${p.pushed_at ? `<span class="tag">Updated ${fmt(p.pushed_at)}</span>` : ""}${p.stars ? `<span class="tag">★ ${p.stars}</span>` : ""}</div></a>`).join("")}</div>`
      : `<div class="empty">No projects featured yet.${showOwner() ? " Open Settings to pick which repositories show here." : ""}</div>`}
    <div class="all"><a class="btn" href="https://github.com/${OWNER}?tab=repositories" target="_blank" rel="noopener">See all repositories</a></div>
  </div></section>

  <section><div class="wrap">
    <div class="heading-row"><div><span class="label">Log of qualifications</span><h2>Certifications &amp; training</h2></div><span class="label">${list.length} entries · ${list.filter((c) => c.cred).length} certified</span></div>
    <div class="filters">${cats.map((c) => `<button class="chip" data-cat="${esc(c)}" aria-pressed="${c === cat}">${esc(c)}</button>`).join("")}</div>
    <div class="log">${years.map((y) => `<div class="year"><div class="yr">${y}</div><div class="certs">${list.filter((c) => c.year === y).map((c) => `
      <div class="cert${active && !c.skills.includes(active) ? " dim" : ""}"><span class="name">${esc(c.name)}</span><span class="by">${esc(c.by)}</span>
      <span class="cat"><span class="badge">${esc(c.cat)}</span>${c.cred ? '<span class="badge cred">Certified</span>' : ""}</span></div>`).join("")}</div></div>`).join("")}</div>
  </div></section>

  <section class="${editing === "exp" ? "editing" : ""}"><div class="wrap">
    <div class="heading-row"><div><span class="label">Voyage so far</span><h2>Experience</h2></div>${editTools("exp")}</div>
    <div class="exp">${[1, 2, 3].map((i) => `<div>${F("e" + i + "l", "span", "label")}${F("e" + i + "t", "h3")}${F("e" + i, "p")}</div>`).join("")}</div>
  </div></section>
</main>
<footer><div class="wrap"><span>© ${new Date().getFullYear()} Grigor Stoyanov</span><span class="foot-links"><a href="https://github.com/${OWNER}" target="_blank" rel="noopener">github.com/${OWNER}</a>${!isOwner ? `<button class="owner-link" data-signin>Owner sign-in</button>` : ""}</span></div></footer>
${renderOwnerChrome()}
${signinOpen ? renderSignin() : ""}
${toastMsg ? `<div class="toast" role="status">${esc(toastMsg)}</div>` : ""}`;

    if (editing) document.querySelectorAll(".editing [data-field]").forEach((el) => { el.contentEditable = "plaintext-only"; if (el.contentEditable !== "plaintext-only") el.contentEditable = "true"; });
  }

  function renderOwnerChrome() {
    if (!isOwner) return "";
    if (preview) return `<div class="preview-bar" role="status"><span>Previewing as a visitor</span><button class="btn small" data-preview>Exit preview</button></div>`;
    let h = `<div class="fab-row"><button class="fab ghost" data-preview>Preview as visitor</button><button class="fab" data-open-settings>Settings</button></div>`;
    if (!drawerOpen) return h;
    const rows = draft.slice().sort((a, b) => (b.featured - a.featured) || byPushed(a, b));
    h += `<div class="scrim" data-close></div><aside class="drawer" role="dialog" aria-label="Portfolio settings">
  <header>
    <div class="row"><h2>Featured projects</h2><button class="btn small" data-close>Close</button></div>
    <div class="sync${liveErr ? " err" : ""}">${esc(liveErr || `${rows.length} public repositories, loaded live from GitHub.`)}</div>
    <div class="row"><button class="btn small" data-refresh ${busy ? "disabled" : ""}>Refresh from GitHub</button><button class="btn small primary" data-publish ${!dirty || busy ? "disabled" : ""}>Publish changes</button></div>
  </header>
  <div class="list">${rows.map((r) => `<div class="rrow${r.featured ? " on" : ""}">
    <div class="rhead"><input type="checkbox" id="f-${esc(r.name)}" data-feat="${esc(r.name)}" ${r.featured ? "checked" : ""}>
      <label class="nm" for="f-${esc(r.name)}"><b>${esc(r.title || r.name)}</b><span>/${esc(r.name)}${r.lang ? " · " + esc(r.lang) : ""}${r.pushed_at ? " · " + fmt(r.pushed_at) : ""}</span></label>
      <button class="linkish" data-toggle="${esc(r.name)}" aria-expanded="${openRow === r.name}">${openRow === r.name ? "Done" : "Details"}</button></div>
    ${openRow === r.name ? `<div class="rdetail">
      <label>Title<input id="t-${esc(r.name)}" data-fld="title" data-r="${esc(r.name)}" value="${esc(r.title)}" placeholder="${esc(r.name)}"></label>
      <label>Description<textarea id="d-${esc(r.name)}" data-fld="desc" data-r="${esc(r.name)}" placeholder="${esc(r.ghDesc || "Uses the GitHub description when empty")}">${esc(r.desc)}</textarea></label>
      <label>Skill tags (comma separated)<input id="g-${esc(r.name)}" data-fld="tags" data-r="${esc(r.name)}" value="${esc(r.tags.join(", "))}"></label>
    </div>` : ""}
  </div>`).join("")}</div>
  <footer class="drawer-foot"><button class="linkish" data-signout>Sign out on this device</button></footer></aside>`;
    return h;
  }

  function renderSignin() {
    return `<div class="scrim" data-close-signin></div><div class="modal" role="dialog" aria-label="Owner sign-in">
  <h2>Owner sign-in</h2>
  <p>Paste a GitHub fine-grained personal access token with <b>Contents: Read and write</b> access to <b>${REPO}</b> only. It stays in this browser and is used to save your edits to the repository.</p>
  <form id="signin-form">
    <label for="token-input">Access token</label>
    <input id="token-input" type="password" autocomplete="off" spellcheck="false" placeholder="github_pat_…">
    ${signinErr ? `<p class="err">${esc(signinErr)}</p>` : ""}
    <div class="row"><button type="button" class="btn small" data-close-signin>Cancel</button><button type="submit" class="btn small primary" ${busy ? "disabled" : ""}>Sign in</button></div>
  </form>
  <a class="hint" href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">Create a token on GitHub</a>
</div>`;
  }

  function toast(m) { toastMsg = m; render(); setTimeout(() => { if (toastMsg === m) { toastMsg = ""; render(); } }, 3200); }

  // ---- data loading ----
  async function loadData() {
    if (isOwner) {
      const f = await gh(`/repos/${OWNER}/${REPO}/contents/data.json`);
      dataSha = f.sha; data = JSON.parse(unb64(f.content));
    } else {
      const res = await fetch("data.json?v=" + Date.now(), { cache: "no-store" });
      data = await res.json();
    }
  }
  async function loadRepos() {
    try {
      let all = [], page = 1;
      while (page < 5) {
        const batch = await gh(`/users/${OWNER}/repos?per_page=100&sort=pushed&page=${page}`);
        all = all.concat(batch); if (batch.length < 100) break; page++;
      }
      live = {}; all.filter((r) => !r.private && !r.fork).forEach((r) => (live[r.name] = r));
      // forks the owner chose to feature still count
      all.filter((r) => r.fork && data && data.featured.some((f) => f.name === r.name)).forEach((r) => (live[r.name] = r));
      liveErr = "";
    } catch (e) {
      liveErr = e.status === 403 ? "GitHub's hourly limit for anonymous requests was reached. Showing saved project details." : "Couldn't reach GitHub. Showing saved project details.";
    }
  }

  async function commit(next, message) {
    if (!isOwner) return false;
    busy = true; render();
    try {
      const body = { message, content: b64(JSON.stringify(next, null, 2) + "\n"), sha: dataSha };
      const r = await gh(`/repos/${OWNER}/${REPO}/contents/data.json`, { method: "PUT", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
      dataSha = r.content.sha; data = next; busy = false;
      toast("Saved. Visitors will see it within a minute or two.");
      return true;
    } catch (e) {
      busy = false;
      if (e.status === 409 || e.status === 422) { await loadData().catch(() => {}); toast("The saved data changed elsewhere. Reloaded the latest version, please redo your change."); }
      else if (e.status === 401) { signOut(); toast("Your token expired or was revoked. Sign in again to save."); }
      else if (e.status === 403 || e.status === 404) toast("Your token can't write to this repository. Give it Contents: Read and write access.");
      else toast("Couldn't save: " + e.message);
      render(); return false;
    }
  }

  function buildDraft() {
    const feat = new Map(data.featured.map((f) => [f.name, f]));
    const names = new Set([...Object.keys(live || {}), ...feat.keys()]);
    return [...names].map((n) => {
      const f = feat.get(n), g = live && live[n];
      return { name: n, featured: !!f, title: (f && f.title) || "", desc: (f && f.desc) || "", tags: (f && f.tags) || [],
        lang: (g && g.language) || (f && f.lang) || "", pushed_at: (g && g.pushed_at) || (f && f.pushed_at) || "", ghDesc: (g && g.description) || "",
        url: (g && g.html_url) || (f && f.url) || "" };
    });
  }

  // ---- auth ----
  async function signIn(t) {
    busy = true; signinErr = ""; render();
    token = t.trim();
    try {
      const repo = await gh(`/repos/${OWNER}/${REPO}`);
      if (!repo.permissions || !repo.permissions.push) throw Object.assign(new Error("no push"), { status: 403 });
      store(TOKEN_KEY, token); isOwner = true; signinOpen = false; busy = false;
      await loadData(); await loadRepos();
      toast("Signed in. Edit buttons and Settings are now on.");
    } catch (e) {
      token = null; busy = false;
      signinErr = e.status === 401 ? "GitHub didn't accept that token. Check you copied all of it." : e.status === 403 || e.status === 404 ? "That token can't write to " + REPO + ". Give it Contents: Read and write on this repository." : "Couldn't check the token: " + e.message;
      render();
    }
  }
  function signOut() { store(TOKEN_KEY, null); token = null; isOwner = false; preview = false; drawerOpen = false; editing = null; render(); }

  // ---- events ----
  document.addEventListener("click", async (e) => {
    const t = e.target.closest("button,[data-close],[data-close-signin]"); if (!t) return;
    const d = t.dataset;
    if (d.skill !== undefined) { active = active === d.skill ? null : d.skill; render(); }
    else if (d.clear !== undefined) { active = null; render(); }
    else if (d.cat !== undefined) { cat = d.cat; render(); }
    else if (d.signin !== undefined) { signinOpen = true; signinErr = ""; render(); const i = $("token-input"); i && i.focus(); }
    else if (d.closeSignin !== undefined) { signinOpen = false; render(); }
    else if (d.signout !== undefined) { signOut(); toast("Signed out on this device."); }
    else if (d.preview !== undefined) { preview = !preview; editing = null; drawerOpen = false; render(); window.scrollTo({ top: 0 }); }
    else if (d.edit) { editing = d.edit; render(); const f = document.querySelector(".editing [data-field]"); f && f.focus(); }
    else if (d.cancel !== undefined) { editing = null; render(); }
    else if (d.save) {
      const changes = {}; document.querySelectorAll(".editing [data-field]").forEach((el) => (changes[el.dataset.field] = el.textContent.replace(/\s+/g, " ").trim()));
      const next = { ...data, content: { ...data.content, ...changes } };
      if (await commit(next, "Update portfolio text")) { editing = null; render(); }
    }
    else if (d.openSettings !== undefined) { draft = buildDraft(); dirty = false; closeArmed = false; drawerOpen = true; render(); }
    else if (d.close !== undefined) { if (dirty && !closeArmed) { closeArmed = true; toast("You have unpublished changes. Press Close again to discard them."); return; } drawerOpen = false; openRow = null; render(); }
    else if (d.refresh !== undefined) { busy = true; render(); await loadRepos(); busy = false; const keep = new Map(draft.map((r) => [r.name, r])); draft = buildDraft().map((r) => keep.has(r.name) ? { ...r, featured: keep.get(r.name).featured, title: keep.get(r.name).title, desc: keep.get(r.name).desc, tags: keep.get(r.name).tags } : r); render(); }
    else if (d.toggle) { openRow = openRow === d.toggle ? null : d.toggle; render(); }
    else if (d.publish !== undefined) {
      const featured = draft.filter((r) => r.featured).map((r) => ({ name: r.name, title: r.title, desc: r.desc, tags: r.tags, lang: r.lang, pushed_at: r.pushed_at, url: r.url }));
      if (await commit({ ...data, featured }, "Update featured projects")) { dirty = false; drawerOpen = false; render(); }
    }
  });
  document.addEventListener("submit", (e) => { if (e.target.id === "signin-form") { e.preventDefault(); const v = $("token-input").value; if (v.trim()) signIn(v); } });
  document.addEventListener("change", (e) => {
    const el = e.target;
    if (el.dataset.feat) { const r = draft.find((x) => x.name === el.dataset.feat); r.featured = el.checked; dirty = true; render(); }
  });
  document.addEventListener("input", (e) => {
    const el = e.target; if (!el.dataset.fld) return;
    const r = draft.find((x) => x.name === el.dataset.r); if (!r) return;
    r[el.dataset.fld] = el.dataset.fld === "tags" ? el.value.split(",").map((s) => s.trim()).filter(Boolean) : el.value;
    if (!dirty) { dirty = true; const b = document.querySelector("[data-publish]"); if (b) b.disabled = false; }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { if (signinOpen) { signinOpen = false; render(); } else if (editing) { editing = null; render(); } }
    if (e.key === "Enter" && e.target.matches && e.target.matches("[data-field]") && !e.target.matches("p")) e.preventDefault();
  });
  document.addEventListener("paste", (e) => {
    if (!e.target.closest || !e.target.closest("[data-field]")) return;
    e.preventDefault(); document.execCommand("insertText", false, (e.clipboardData || window.clipboardData).getData("text/plain"));
  });

  // ---- boot ----
  (async function boot() {
    render();
    const saved = load(TOKEN_KEY);
    if (saved) {
      token = saved;
      try { const repo = await gh(`/repos/${OWNER}/${REPO}`); isOwner = !!(repo.permissions && repo.permissions.push); } catch (_) { isOwner = false; }
      if (!isOwner) { token = null; store(TOKEN_KEY, null); }
    }
    try { await loadData(); } catch (_) { const res = await fetch("data.json?v=" + Date.now()); data = await res.json(); isOwner = false; }
    render();
    await loadRepos();
    render();
  })();
})();
