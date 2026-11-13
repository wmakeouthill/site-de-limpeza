import { describe, expect, it } from "vitest";

import { fotoStyle, gravarPosicao, lerPosicao } from "./productPhoto";

describe("enquadramento da foto do produto", () => {
  it("aplica zoom e origem gravados pelo CMS", () => {
    expect(fotoStyle("30.5% 70%", 250)).toEqual({ transform: "scale(2.5)", transformOrigin: "30.5% 70%" });
  });

  it("ignora posição fora do formato (vai para CSS inline) e limita o zoom", () => {
    expect(fotoStyle("50%;color:red", 999)).toEqual({ transform: "scale(3)", transformOrigin: "center" });
    expect(fotoStyle(null, null)).toEqual({ transform: "scale(1)", transformOrigin: "center" });
  });

  it("ida e volta da posição, presa entre 0 e 100", () => {
    expect(gravarPosicao(-5, 33.333)).toBe("0% 33.3%");
    expect(lerPosicao(gravarPosicao(120, 50))).toEqual([100, 50]);
    expect(lerPosicao("center")).toEqual([50, 50]);
  });
});
