type Block =
  | { kind: "heading"; level: 2 | 3; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[] };

function parseBlocks(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list.length > 0) {
      blocks.push({ kind: "list", items: list });
      list = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }
    if (line.startsWith("## ")) {
      flushParagraph();
      flushList();
      blocks.push({ kind: "heading", level: 2, text: line.slice(3) });
      continue;
    }
    if (line.startsWith("### ")) {
      flushParagraph();
      flushList();
      blocks.push({ kind: "heading", level: 3, text: line.slice(4) });
      continue;
    }
    if (line.startsWith("- ")) {
      flushParagraph();
      list.push(line.slice(2));
      continue;
    }
    flushList();
    paragraph.push(line);
  }
  flushParagraph();
  flushList();
  return blocks;
}

export function MarkdownArticle({ markdown }: { markdown: string }) {
  return (
    <article className="mx-auto max-w-3xl text-ink">
      {parseBlocks(markdown).map((block, index) => {
        if (block.kind === "heading") {
          return block.level === 2 ? (
            <h2
              key={`${block.text}-${index}`}
              className="mt-10 font-display text-2xl first:mt-0"
            >
              {block.text}
            </h2>
          ) : (
            <h3
              key={`${block.text}-${index}`}
              className="mt-8 text-lg font-semibold"
            >
              {block.text}
            </h3>
          );
        }
        if (block.kind === "list") {
          return (
            <ul
              key={`list-${index}`}
              className="mt-4 list-disc space-y-2 pl-5 text-[15px] leading-7 text-muted-foreground"
            >
              {block.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          );
        }
        return (
          <p
            key={`paragraph-${index}`}
            className="mt-4 text-[15px] leading-7 text-muted-foreground"
          >
            {block.text}
          </p>
        );
      })}
    </article>
  );
}
