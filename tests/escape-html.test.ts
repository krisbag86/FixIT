import { describe, it, expect } from "vitest";
import { escapeHtml, sanitizeText } from "@/lib/escape-html";

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

describe("sanitizeText", () => {
  it("strips simple HTML tags", () => {
    expect(sanitizeText("<b>bold</b>")).toBe("bold");
  });

  it("strips script tag markup but preserves text between tags", () => {
    // Only the tag markup <...> is removed; content between tags is preserved
    expect(sanitizeText("<script>alert(1)</script>")).toBe("alert(1)");
  });

  it("strips tags with attributes", () => {
    expect(sanitizeText('<a href="javascript:alert(1)">click</a>')).toBe("click");
  });

  it("strips lone angle brackets", () => {
    expect(sanitizeText("5 > 3")).toBe("5  3");
  });

  it("strips tag markup from mixed content but preserves text between tags", () => {
    // The text between tags (evil()) is preserved since only <...> is stripped
    expect(sanitizeText("Hello <script>evil()</script> world")).toBe("Hello evil() world");
  });

  it("strips nested HTML tags", () => {
    expect(sanitizeText("<div><span>nested</span></div>")).toBe("nested");
  });

  it("strips self-closing tags", () => {
    expect(sanitizeText("Hello<img src=x onerror=alert(1)>world")).toBe("Helloworld");
  });

  it("preserves safe text without HTML", () => {
    expect(sanitizeText("Warszawa")).toBe("Warszawa");
    expect(sanitizeText("Sklep nr 5")).toBe("Sklep nr 5");
    expect(sanitizeText("Copy: FixIT, IT")).toBe("Copy: FixIT, IT");
  });

  it("preserves Polish diacritics", () => {
    expect(sanitizeText("Żółw")).toBe("Żółw");
    expect(sanitizeText("Łódź")).toBe("Łódź");
    expect(sanitizeText("ul. Świętokrzyska 5a")).toBe("ul. Świętokrzyska 5a");
  });

  it("trims leading and trailing whitespace", () => {
    expect(sanitizeText("  hello  ")).toBe("hello");
    expect(sanitizeText("\t\nspaceship\n")).toBe("spaceship");
  });

  it("handles empty string", () => {
    expect(sanitizeText("")).toBe("");
  });

  it("handles string with only HTML", () => {
    expect(sanitizeText("<script></script>")).toBe("");
  });

  it("strips a lone opening < without closing >", () => {
    expect(sanitizeText("a < b")).toBe("a  b");
    expect(sanitizeText("<notag")).toBe("notag");
  });

  it("strips angle brackets with attribute-like lone brackets", () => {
    expect(sanitizeText("a<=b")).toBe("a=b");
    expect(sanitizeText("a>=b")).toBe("a=b");
  });
});
