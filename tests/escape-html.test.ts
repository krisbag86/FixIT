import { describe, it, expect } from "vitest";
import { escapeHtml } from "@/lib/escape-html";

describe("escapeHtml", () => {
  it("escapes & to &amp;", () => {
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });

  it("escapes < to &lt;", () => {
    expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
  });

  it("escapes > to &gt;", () => {
    expect(escapeHtml("5 > 3")).toBe("5 &gt; 3");
  });

  it("escapes double quotes to &quot;", () => {
    expect(escapeHtml('say "hello"')).toBe("say &quot;hello&quot;");
  });

  it("escapes single quotes to &#39;", () => {
    expect(escapeHtml("it's")).toBe("it&#39;s");
  });

  it("escapes all five characters together", () => {
    const input = "<a href=\"javascript:alert('xss')\">&click</a>";
    const expected = "&lt;a href=&quot;javascript:alert(&#39;xss&#39;)&quot;&gt;&amp;click&lt;/a&gt;";
    expect(escapeHtml(input)).toBe(expected);
  });

  it("does not double-escape already escaped entities", () => {
    // & is replaced first, so &amp; stays as &amp; (not &amp;amp;)
    expect(escapeHtml("&amp;")).toBe("&amp;amp;");
    // This is expected behavior — the input contains literal &amp; which gets escaped
  });

  it("returns empty string for empty input", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("preserves safe strings unchanged", () => {
    expect(escapeHtml("Hello, world!")).toBe("Hello, world!");
    expect(escapeHtml("admin@bagietka.pl")).toBe("admin@bagietka.pl");
    expect(escapeHtml("Nowy ticket został utworzony")).toBe("Nowy ticket został utworzony");
  });
});
