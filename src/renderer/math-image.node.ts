import { Resvg } from "@resvg/resvg-js";

export async function mathImage(svg: string, width: number, _height: number): Promise<string> {
  const image = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    font: { loadSystemFonts: false },
  }).render();
  return `data:image/png;base64,${image.asPng().toString("base64")}`;
}
