// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ContentRenderer } from "./ContentRenderer";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("ContentRenderer", () => {
  it("renderiza codeBlock HTML do BlockNote sem aninhar bloco dentro de paragrafo", () => {
    const html = renderToStaticMarkup(
      <ContentRenderer
        markdown={
          '<pre data-language="python"><code><p><code data-language="python">print("ok")</code></p></code></pre>'
        }
      />,
    );

    expect(html).toContain("python");
    expect(html).toContain("print(&quot;ok&quot;)");
    expect(html).not.toContain("<p><code");
  });

  it("normaliza figura flutuante colada no paragrafo anterior", () => {
    const html = renderToStaticMarkup(
      <ContentRenderer
        markdown={
          '<p>Texto de cima</p><figure data-disposition="float-left"><img src="/image.png" /></figure><p>Texto de baixo</p>'
        }
      />,
    );

    expect(html.indexOf("<figure")).toBeLessThan(html.indexOf("<p>Texto de cima</p>"));
    expect(html.indexOf("<p>Texto de cima</p>")).toBeLessThan(
      html.indexOf("<p>Texto de baixo</p>"),
    );
  });

  it("nao normaliza figura flutuante separada por linha vazia", () => {
    const html = renderToStaticMarkup(
      <ContentRenderer
        markdown={
          '<p>Texto de cima</p><p data-float-spacer="true"></p><figure data-disposition="float-left"><img src="/image.png" /></figure><p>Texto de baixo</p>'
        }
      />,
    );

    expect(html.indexOf("<p>Texto de cima</p>")).toBeLessThan(
      html.indexOf("<figure"),
    );
    expect(html).toContain('data-float-spacer="true"');
  });

  it("mantem separador horizontal depois da figura flutuante", () => {
    const html = renderToStaticMarkup(
      <ContentRenderer
        markdown={
          '<p>Texto de cima</p><figure data-disposition="float-left"><img src="/image.png" /></figure><hr><p>Texto de baixo</p>'
        }
      />,
    );

    expect(html.indexOf("<figure")).toBeLessThan(html.indexOf("<p>Texto de cima</p>"));
    expect(html.indexOf("<p>Texto de cima</p>")).toBeLessThan(html.indexOf("<hr"));
    expect(html.indexOf("<hr")).toBeLessThan(html.indexOf("<p>Texto de baixo</p>"));
  });

  it("rebaixa h1 do conteudo para preservar um unico h1 da pagina", () => {
    const html = renderToStaticMarkup(<ContentRenderer markdown={"# Subtitulo interno"} />);

    expect(html).not.toContain("<h1");
    expect(html).toContain("<h2>Subtitulo interno</h2>");
  });

  it("normaliza imagens do conteudo com alt vazio, lazy e decoding async", () => {
    const html = renderToStaticMarkup(<ContentRenderer markdown={"![](/uploads/image.png)"} />);

    expect(html).toContain('src="/uploads/image.png"');
    expect(html).toContain('alt=""');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('decoding="async"');
  });

  it("remove tags, atributos e URLs perigosas do HTML vindo do CMS", () => {
    const html = renderToStaticMarkup(
      <ContentRenderer
        markdown={
          '<p>Seguro</p><script>alert("x")</script><img src="javascript:alert(1)" onerror="alert(2)" /><a href="javascript:alert(3)">link</a>'
        }
      />,
    );

    expect(html).toContain("<p>Seguro</p>");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("onerror");
  });

  it("aplica syntax highlight nos codeblocks da tela externa", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    try {
      await act(async () => {
        root.render(<ContentRenderer markdown={"```js\nconst value = 1;\n```"} />);
      });

      await waitFor(() => {
        expect(container.querySelector("pre.shiki")).not.toBeNull();
      });
    } finally {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    }
  });
  it("renderiza tabela GFM dentro de wrapper responsivo", () => {
    const markdown = `| Produto | Preço |
| :--- | :--- |
| Desengordurante 5L | R$ 29,90 |
| Cloro Ativo 5L | R$ 19,90 |`;

    const html = renderToStaticMarkup(<ContentRenderer markdown={markdown} />);

    expect(html).toContain("tableResponsive");
    expect(html).toContain("<table");
    expect(html).toContain("<th");
    expect(html).toContain("Desengordurante 5L");
    expect(html).toContain("R$ 29,90");
  });

  it("renderiza caixa de chamada de dica para [!TIP] e **Dica:**", () => {
    const htmlTip1 = renderToStaticMarkup(
      <ContentRenderer markdown={"> [!TIP]\n> Deixe o desengordurante agir por 5 minutos."} />,
    );
    expect(htmlTip1).toContain("callout");
    expect(htmlTip1).toContain("calloutTip");
    expect(htmlTip1).toContain("role=\"note\"");
    expect(htmlTip1).toContain("Deixe o desengordurante agir por 5 minutos.");

    const htmlTip2 = renderToStaticMarkup(
      <ContentRenderer markdown={"> **Dica:** Enxágue com água morna para melhor resultado."} />,
    );
    expect(htmlTip2).toContain("calloutTip");
    expect(htmlTip2).toContain("Enxágue com água morna para melhor resultado.");
  });

  it("renderiza caixa de chamada de atencao para [!WARNING] e **Atenção:**", () => {
    const htmlWarn1 = renderToStaticMarkup(
      <ContentRenderer markdown={"> [!WARNING]\n> Nunca misture cloro com desinfetante amoniacal."} />,
    );
    expect(htmlWarn1).toContain("callout");
    expect(htmlWarn1).toContain("calloutWarning");
    expect(htmlWarn1).toContain("role=\"alert\"");
    expect(htmlWarn1).toContain("Nunca misture cloro com desinfetante amoniacal.");

    const htmlWarn2 = renderToStaticMarkup(
      <ContentRenderer markdown={"> **Atenção:** Utilize luvas de borracha durante a aplicação."} />,
    );
    expect(htmlWarn2).toContain("calloutWarning");
    expect(htmlWarn2).toContain("Utilize luvas de borracha durante a aplicação.");
  });

  it("mantem blockquote padrao para citacoes comuns", () => {
    const html = renderToStaticMarkup(
      <ContentRenderer markdown={"> A limpeza e organizacao transformam o ambiente de trabalho."} />,
    );

    expect(html).toContain("<blockquote");
    expect(html).not.toContain("calloutTip");
    expect(html).not.toContain("calloutWarning");
    expect(html).toContain("A limpeza e organizacao transformam o ambiente de trabalho.");
  });
});


async function waitFor(assertion: () => void) {
  const timeoutAt = Date.now() + 3000;
  let lastError: unknown;

  while (Date.now() < timeoutAt) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 25));
      });
    }
  }

  throw lastError;
}
