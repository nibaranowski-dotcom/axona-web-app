/**
 * Verify UX.12 — render markdown in agent answers. Pure static check (no DB).
 * Run: pnpm verify:ux-12
 *
 *   1. ChatThread renders the ASSISTANT body via the markdown renderer (not
 *      whitespace-pre-wrap); react-markdown + remark-gfm + a sanitizer are wired.
 *   2. Output is sanitized (rehype-sanitize; no raw-HTML pass-through / no
 *      rehype-raw / no dangerouslySetInnerHTML); links get rel="noopener".
 *   3. Bold/headings/lists/rules/code/TABLES all render; the USER message stays
 *      plain; trace lines are untouched; citations (GA.1) preserved.
 *   4. v2 tokens only — no raw hex, no invented reds, no emoji; content is
 *      contained (bubble overflow-hidden + tables/code scroll inside via
 *      overflow-x-auto, UX.10).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

let passed = 0;
let failed = 0;
const check = (label: string, fn: () => boolean): void => {
  try {
    const ok = fn();
    console.log(`  ${ok ? "PASS" : "FAIL"} ${label}`);
    ok ? passed++ : failed++;
  } catch (e) {
    console.log(`  FAIL ${label} — ${(e as Error).message}`);
    failed++;
  }
};

const root = process.cwd();
const read = (p: string) =>
  existsSync(join(root, p)) ? readFileSync(join(root, p), "utf8") : "";

const CHAT = "apps/web/components/agents/ChatThread.tsx";
const MD = "apps/web/components/agents/Markdown.tsx";
const TRACE = "apps/web/components/shell/TracePane.tsx";
const PKG = "apps/web/package.json";

// Emoji + pictographic dingbats (the brand is emoji-free). The markdown arrow
// glyphs in prose are U+2192 etc., outside these ranges.
const EMOJI =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/u;

function run(): void {
  console.log("\nVerifying UX.12 — render markdown in agent answers\n");

  const chat = read(CHAT);
  const md = read(MD);
  const trace = read(TRACE);
  const pkg = read(PKG);

  // 1. wired + assistant goes through the renderer
  check(
    "deps: react-markdown + remark-gfm + rehype-sanitize in @axona/web",
    () => {
      return (
        /"react-markdown"\s*:/.test(pkg) &&
        /"remark-gfm"\s*:/.test(pkg) &&
        /"rehype-sanitize"\s*:/.test(pkg)
      );
    },
  );
  check("Markdown.tsx wires ReactMarkdown + remarkGfm + rehypeSanitize", () => {
    return (
      md.length > 0 &&
      /from "react-markdown"/.test(md) &&
      /remark-gfm/.test(md) &&
      /rehype-sanitize/.test(md) &&
      /remarkPlugins=\{\[remarkGfm\]\}/.test(md) &&
      /rehypePlugins=\{\[rehypeSanitize\]\}/.test(md)
    );
  });
  check(
    "ChatThread renders the ASSISTANT body via <Markdown> (not pre-wrap)",
    () => {
      return (
        /import \{ Markdown \}/.test(chat) &&
        /<Markdown>\{m\.text\}<\/Markdown>/.test(chat) &&
        // the assistant branch must NOT be whitespace-pre-wrap; that class is now
        // scoped to the user branch only
        /user \? m\.text : <Markdown>/.test(chat)
      );
    },
  );

  // 2. sanitized + safe links
  check(
    "sanitized — no raw-HTML pass-through (rehype-sanitize, no rehype-raw)",
    () => {
      return (
        /rehypeSanitize/.test(md) &&
        !/rehype-raw|rehypeRaw/.test(md) &&
        !/dangerouslySetInnerHTML/.test(md) &&
        !/allowDangerousHtml/.test(md) &&
        !/dangerouslySetInnerHTML/.test(chat)
      );
    },
  );
  check('links get rel="noopener noreferrer"', () => {
    return /rel="noopener noreferrer"/.test(md) && /target="_blank"/.test(md);
  });

  // 3. element coverage + separation of concerns
  check("markdown maps bold/headings/lists/rules/code/TABLES", () => {
    return (
      /\bstrong:/.test(md) &&
      /\bh1:/.test(md) &&
      /\bul:/.test(md) &&
      /\bol:/.test(md) &&
      /\bli:/.test(md) &&
      /\bhr:/.test(md) &&
      /\bcode:/.test(md) &&
      /\bpre:/.test(md) &&
      /\btable:/.test(md) &&
      /\bth:/.test(md) &&
      /\btd:/.test(md)
    );
  });
  check(
    "USER message stays plain text (whitespace-pre-wrap on user branch)",
    () => {
      return (
        /whitespace-pre-wrap bg-ink-strong/.test(chat) &&
        /user \? m\.text/.test(chat)
      );
    },
  );
  check(
    "trace lines untouched — TracePane stays mono plaintext, no Markdown",
    () => {
      return (
        /whitespace-pre-wrap/.test(trace) &&
        !/Markdown/.test(trace) &&
        !/react-markdown/.test(trace)
      );
    },
  );
  check("citations (GA.1) preserved in ChatThread", () => {
    return /m\.citations/.test(chat) && /aria-label="Sources"/.test(chat);
  });

  // 4. v2 tokens only + containment
  check(
    "no raw hex / no invented reds / no emoji in the markdown styles",
    () => {
      const rawHex = /#[0-9a-fA-F]{3,8}\b/.test(md);
      const red = /(text|bg|border|ring|decoration)-red-/.test(md);
      const emoji = EMOJI.test(md);
      if (rawHex) console.log("      raw hex found in Markdown.tsx");
      if (red) console.log("      a red utility found in Markdown.tsx");
      return !rawHex && !red && !emoji;
    },
  );
  check(
    "UX.10 containment — tables/code scroll inside; bubble clips overflow",
    () => {
      // wide content scrolls within the message, and the bubble clips so nothing
      // escapes to the page
      const tableScroll = /table:[\s\S]*?overflow-x-auto/.test(md);
      const preScroll = /pre:[\s\S]*?overflow-x-auto/.test(md);
      const bubbleClip = /min-w-0 overflow-hidden rounded-\[13px\]/.test(chat);
      return tableScroll && preScroll && bubbleClip;
    },
  );

  if (failed === 0) console.log(`\nPASSED — ${passed} checks`);
  else {
    console.log(`\nFAILED — ${failed} check(s) failed`);
    process.exit(1);
  }
}

run();
