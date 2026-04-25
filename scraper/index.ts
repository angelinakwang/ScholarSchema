import "dotenv/config";
import { Stagehand } from "@browserbasehq/stagehand";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, "../backend/data/berkeley.json");

const SERPER_API_KEY = process.env.SERPER_API_KEY!;
const GROQ_API_KEY = process.env.GROQ_API_KEY!;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;

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
  const data = (await resp.json()) as { choices: { message: { content: string } }[] };
  const text = data.choices[0].message.content.replace(/```json|```/g, "").trim();
  return JSON.parse(text);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const FacultyListSchema = z.object({
  people: z.array(
    z.object({
      name: z.string().describe("Full name of the faculty member"),
      profileUrl: z.string().describe("URL of their department profile page"),
    })
  ),
});

const PersonalSiteSchema = z.object({
  personalWebsite: z
    .string()
    .optional()
    .describe("URL of their personal/lab website — not Google Scholar, LinkedIn, or the department homepage"),
  email: z.string().optional().describe("Email address if visible"),
});

const StudentListSchema = z.object({
  people: z.array(
    z.object({
      name: z.string().describe("Full name of the PhD student"),
      profileUrl: z.string().describe("URL of their personal website or profile"),
    })
  ),
});

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Load existing results for resume support
  let existing: any[] = [];
  try {
    existing = JSON.parse(await fs.readFile(OUT_PATH, "utf-8"));
    console.log(`[resume] ${existing.length} already processed — skipping them`);
  } catch {
    await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  }
  const alreadyDone = new Set(existing.map((p: any) => p.name.toLowerCase()));

  const google = createGoogleGenerativeAI({ apiKey: GEMINI_API_KEY });

  const stagehand = new Stagehand({
    env: "LOCAL",
    modelName: "google/gemini-2.0-flash-exp",
    model: google("gemini-2.0-flash-exp"),
    verbose: 1,
  });

  await stagehand.init();
  const { page, extract } = stagehand;

  const allPeople: { name: string; profileUrl: string; type: string }[] = [];
  const seenNames = new Set<string>();

  function addPeople(people: { name: string; profileUrl: string }[], type: string) {
    for (const p of people) {
      if (p.name && p.profileUrl && !seenNames.has(p.name.toLowerCase())) {
        seenNames.add(p.name.toLowerCase());
        allPeople.push({ ...p, type });
      }
    }
  }

  // ── Step 1: collect faculty from EECS listing pages ─────────────────────────
  const facultyListUrls = [
    "https://www2.eecs.berkeley.edu/Faculty/Lists/CS/faculty.html",
    "https://www2.eecs.berkeley.edu/Faculty/Lists/EE/faculty.html",
  ];

  for (const listUrl of facultyListUrls) {
    console.log(`\n[list] ${listUrl}`);
    await page.goto(listUrl, { waitUntil: "domcontentloaded" });
    const result = await extract({
      instruction: "Extract every faculty member's full name and the URL of the link on their name that goes to their department profile page",
      schema: FacultyListSchema,
    });
    addPeople(result.people, "Faculty");
    console.log(`  -> ${result.people.length} faculty found`);
  }

  // ── Step 2: collect BAIR PhD students (JS-rendered) ─────────────────────────
  console.log("\n[list] https://bair.berkeley.edu/students.html");
  await page.goto("https://bair.berkeley.edu/students.html", { waitUntil: "networkidle" });
  const bairResult = await extract({
    instruction: "Extract every PhD student's full name and the URL of their personal website or profile page",
    schema: StudentListSchema,
  });
  addPeople(bairResult.people, "PhD Student");
  console.log(`  -> ${bairResult.people.length} BAIR students found`);

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

    // Faculty: visit directory page to find personal site
    if (person.type === "Faculty") {
      try {
        await page.goto(person.profileUrl, { waitUntil: "domcontentloaded" });
        const siteResult = await extract({
          instruction:
            "Find the URL of this professor's personal or lab website. Skip Google Scholar, LinkedIn, ResearchGate, and bare department homepages (no path after the domain).",
          schema: PersonalSiteSchema,
        });
        if (siteResult.personalWebsite) personalUrl = siteResult.personalWebsite;
        if (siteResult.email) email = siteResult.email;
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

    const record = {
      name: person.name,
      url: personalUrl,
      university: "UC Berkeley",
      type: person.type,
      papers,
      research_summary: researchSummary,
      research_areas: researchAreas,
      email,
    };

    enriched.push(record);

    // Save after every person so progress survives a crash or rate-limit
    await fs.writeFile(OUT_PATH, JSON.stringify([...existing, ...enriched], null, 2));
  }

  await stagehand.close();
  console.log(`\n[done] ${existing.length + enriched.length} people saved to ${OUT_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
