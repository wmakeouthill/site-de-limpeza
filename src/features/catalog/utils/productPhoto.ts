// Enquadramento da foto do produto: a foto inteira cabe no quadrado (contain) e o CMS guarda
// zoom (50–300%) e o ponto de origem do zoom ("x% y%"). Mesmo cálculo no CMS e no site.
const POSICAO = /^\d{1,3}(\.\d{1,2})?% \d{1,3}(\.\d{1,2})?%$/;

export const ZOOM_MIN = 50;
export const ZOOM_MAX = 300;

export function fotoStyle(posicao?: string | null, zoom?: number | null) {
  // Vai para style inline: só aceita o formato que o CMS grava.
  const origem = posicao && POSICAO.test(posicao) ? posicao : "center";
  const escala = Math.min(Math.max(zoom || 100, ZOOM_MIN), ZOOM_MAX) / 100;
  return { transform: `scale(${escala})`, transformOrigin: origem };
}

export function lerPosicao(posicao?: string | null): [number, number] {
  if (!posicao || !POSICAO.test(posicao)) return [50, 50];
  const [x, y] = posicao.split(" ").map((v) => parseFloat(v));
  return [x, y];
}

export function gravarPosicao(x: number, y: number) {
  const limpa = (v: number) => Math.round(Math.min(Math.max(v, 0), 100) * 10) / 10;
  return `${limpa(x)}% ${limpa(y)}%`;
}
