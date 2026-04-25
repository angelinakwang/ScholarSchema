import "dotenv/config";
import { chromium } from "playwright";
import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, "../backend/data/berkeley.json");

const SERPER_API_KEY = process.env.SERPER_API_KEY!;
const GROQ_API_KEY = process.env.GROQ_API_KEY!;

// ─── API helpers ──────────────────────────────────────────────────────────────

async function scholarSearch(name: string, university: string) {
  const resp = await fetch("https://google.serper.dev/scholar", {
    method: "POST",
    headers: { "X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ q: `${name} ${university}`, num: 5 }),
  });
  const data = (await resp.json()) as { organic?: any[] };
  return data.organic ?? [];
}

function formatPapers(results: any[]) {
  const lines: string[] = [];
  for (const item of results.slice(0, 5)) {
    const title = String(item.title ?? "").trim();
    const snippet = String(item.snippet ?? "").trim();
    if (!title) continue;
    lines.push(`- Title: ${title}\n  Snippet: ${snippet}`);
  }
  return lines.join("\n");
}

async function groqSummarize(name: string, university: string, papersText: string) {
  const prompt = `Researcher: ${name} at ${university}
Their recent papers:
${papersText.slice(0, 1500)}

Based only on their papers, return valid JSON only, no markdown:
{"research_summary": "2 sentence overview", "research_areas": ["area1", "area2"], "papers": [{"title": "...", "year": "...", "one_line_summary": "..."}]}`;

  const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    }),
  });
  if (!resp.ok) throw new Error(`Groq ${resp.status}: ${await resp.text()}`);
  const data = (await resp.json()) as { choices: { message: { content: string } }[] };
  const text = data.choices[0].message.content.replace(/```json|```/g, "").trim();
  return JSON.parse(text);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Page helpers ─────────────────────────────────────────────────────────────

const AGGREGATOR_HOSTS = [
  "scholar.google.com", "linkedin.com", "researchgate.net",
  "twitter.com", "x.com", "github.com", "dblp.org",
  "semanticscholar.org", "youtube.com", "wikipedia.org",
];

const PERSONAL_LABELS = new Set([
  "home page", "homepage", "personal website", "personal page",
  "website", "web page", "webpage", "personal site",
  "visit website", "lab website", "lab page", "faculty page",
]);

// Extract all links from a page that look like personal/lab websites
async function findPersonalWebsite(page: any, directoryUrl: string): Promise<string> {
  const dirHost = new URL(directoryUrl).hostname;

  const links: { href: string; label: string }[] = await page.$$eval(
    "a[href]",
    (anchors: HTMLAnchorElement[]) =>
      anchors.map((a) => ({ href: a.href, label: (a.textContent ?? "").trim().toLowerCase() }))
  );

  let fallback = "";
  for (const { href, label } of links) {
    let parsed: URL;
    try { parsed = new URL(href); } catch { continue; }

    // Skip non-http, same host, bare homepages, aggregators
    if (!href.startsWith("http")) continue;
    if (parsed.hostname === dirHost) continue;
    if (!parsed.pathname || parsed.pathname === "/") continue;
    if (AGGREGATOR_HOSTS.some((h) => parsed.hostname.includes(h))) continue;

    if (PERSONAL_LABELS.has(label)) return href; // high-confidence
    if (!fallback) fallback = href;
  }
  return fallback;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Resume support
  let existing: any[] = [];
  try {
    existing = JSON.parse(await fs.readFile(OUT_PATH, "utf-8"));
    console.log(`[resume] ${existing.length} already processed — skipping them`);
  } catch {
    await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  }
  const alreadyDone = new Set(existing.map((p: any) => p.name.toLowerCase()));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  const allPeople: { name: string; profileUrl: string; type: string }[] = [];
  const seenNames = new Set<string>();

  function addPeople(people: { name: string; profileUrl: string }[], type: string) {
    for (const p of people) {
      const key = p.name.toLowerCase();
      if (p.name && p.profileUrl && !seenNames.has(key)) {
        seenNames.add(key);
        allPeople.push({ ...p, type });
      }
    }
  }

  // ── Step 1: EECS faculty listing pages ──────────────────────────────────────
  const facultyListUrls = [
    "https://www2.eecs.berkeley.edu/Faculty/Lists/CS/faculty.html",
    "https://www2.eecs.berkeley.edu/Faculty/Lists/EE/faculty.html",
  ];

  for (const listUrl of facultyListUrls) {
    console.log(`\n[list] ${listUrl}`);
    await page.goto(listUrl, { waitUntil: "domcontentloaded" });

    // Collect all links matching the /Faculty/Homepages/ pattern,
    // keeping the best (longest) name per URL to handle img-only vs text links
    const urlToName: Record<string, string> = await page.$$eval(
      'a[href*="/Faculty/Homepages/"]',
      (anchors: HTMLAnchorElement[]) => {
        const map: Record<string, string> = {};
        for (const a of anchors) {
          const url = a.href;
          const name = (a.textContent ?? "").trim() ||
            (a.querySelector("img") as HTMLImageElement | null)?.alt?.trim() || "";
          if (!map[url] || name.length > map[url].length) map[url] = name;
        }
        return map;
      }
    );

    const faculty = Object.entries(urlToName)
      .filter(([, name]) => name.length > 0)
      .map(([profileUrl, name]) => ({ name, profileUrl }));

    addPeople(faculty, "Faculty");
    console.log(`  -> ${faculty.length} faculty found`);
  }

  // ── Step 2: BAIR PhD students ────────────────────────────────────────────────
  console.log("\n[list] https://bair.berkeley.edu/people/students");
  await page.goto("https://bair.berkeley.edu/people/students", { waitUntil: "load", timeout: 60000 });
  await sleep(2000);

  // Dump a snapshot of the page so we can inspect the structure
  const bairHtml = await page.content();
  await fs.writeFile(path.join(__dirname, "bair_debug.html"), bairHtml);
  console.log("  [debug] saved bair_debug.html — open it to inspect the structure");

  const bairStudents: { name: string; profileUrl: string }[] = await page.$$eval(
    "a[href]",
    (anchors: HTMLAnchorElement[]) => {
      const results: { name: string; profileUrl: string }[] = [];
      const seen = new Set<string>();
      for (const a of anchors) {
        const name = (a.textContent ?? "").trim();
        const url = a.href;
        if (!name || !url || seen.has(url)) continue;
        const words = name.split(/\s+/);
        if (words.length < 2 || words.length > 4) continue;
        if (!words[0][0]?.match(/[A-Z]/)) continue;
        // skip nav/generic words
        const lower = name.toLowerCase();
        if (["research", "home", "more", "back", "contact"].some(w => lower.includes(w))) continue;
        seen.add(url);
        results.push({ name, profileUrl: url });
      }
      return results;
    }
  );

  addPeople(bairStudents, "PhD Student");
  console.log(`  -> ${bairStudents.length} BAIR students found`);

  console.log(`\n[scrape] ${allPeople.length} total people to process`);

  // ── Step 3: enrich each person ───────────────────────────────────────────────
  const enriched: any[] = [];

  for (let i = 0; i < allPeople.length; i++) {
    const person = allPeople[i];
    console.log(`\n[${i + 1}/${allPeople.length}] [${person.type}] ${person.name}`);

    if (alreadyDone.has(person.name.toLowerCase())) {
      console.log("  [skip]");
      continue;
    }

    let personalUrl = person.profileUrl;
    let email = "";

    // Faculty: follow directory page to find personal site
    if (person.type === "Faculty") {
      try {
        await page.goto(person.profileUrl, { waitUntil: "domcontentloaded" });
        const found = await findPersonalWebsite(page, person.profileUrl);
        if (found) personalUrl = found;

        // Extract email from page text
        const bodyText: string = await page.evaluate(() => document.body.innerText);
        const emailMatch = bodyText.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
        if (emailMatch) email = emailMatch[0];

        console.log(`  -> ${personalUrl}`);
      } catch (e) {
        console.log(`  [warn] directory page failed: ${e}`);
      }
    }

    // Scholar + Groq
    let papers: any[] = [];
    let researchSummary = "";
    let researchAreas: string[] = [];

    try {
      const scholarResults = await scholarSearch(person.name, "UC Berkeley");
      const papersText = formatPapers(scholarResults);

      if (papersText) {
        await sleep(3000); // respect Groq daily token limit
        const groqResult = await groqSummarize(person.name, "UC Berkeley", papersText);
        researchSummary = groqResult.research_summary ?? "";
        researchAreas = groqResult.research_areas ?? [];
        papers = (groqResult.papers ?? []).slice(0, 5);
      }
    } catch (e) {
      console.log(`  [enrich] failed: ${e}`);
    }

    enriched.push({
      name: person.name,
      url: personalUrl,
      university: "UC Berkeley",
      type: person.type,
      papers,
      research_summary: researchSummary,
      research_areas: researchAreas,
      email,
    });

    // Save after every person
    await fs.writeFile(OUT_PATH, JSON.stringify([...existing, ...enriched], null, 2));
  }

  await browser.close();
  console.log(`\n[done] ${existing.length + enriched.length} people saved to ${OUT_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
