import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import { normalizeText } from "./normalize";

type Rel = { Id?: string; Target?: string; Type?: string };

function ensureArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function joinXlPath(baseDir: string, target: string): string {
  // All targets are inside the xlsx zip under `xl/`
  if (target.startsWith("/")) target = target.slice(1);
  const cleaned = target.replace(/\\/g, "/");
  if (cleaned.startsWith("xl/")) return cleaned;
  if (cleaned.startsWith("../")) return `xl/${cleaned.replace(/^\.\.\//, "")}`;
  if (baseDir.endsWith("/")) return `${baseDir}${cleaned}`;
  return `${baseDir}/${cleaned}`;
}

function mimeFromPath(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}

export async function extractQrImageDataUrlFromXlsx(
  xlsxBuffer: Buffer,
  sheetName: string,
): Promise<string | undefined> {
  const zip = await JSZip.loadAsync(xlsxBuffer);
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

  const workbookXml = await zip.file("xl/workbook.xml")?.async("text");
  const workbookRelsXml = await zip.file("xl/_rels/workbook.xml.rels")?.async("text");
  if (!workbookXml || !workbookRelsXml) return undefined;

  const workbook = parser.parse(workbookXml);
  const rels = parser.parse(workbookRelsXml);
  const sheets = ensureArray(workbook?.workbook?.sheets?.sheet);
  const relationships: Rel[] = ensureArray(rels?.Relationships?.Relationship);

  const targetSheet = sheets.find(
    (s: any) => normalizeText(s?.["@_name"]) === normalizeText(sheetName),
  );
  if (!targetSheet) return await fallbackFirstMedia(zip);

  const sheetRid = targetSheet?.["@_r:id"];
  const sheetRel = relationships.find((r) => r.Id === sheetRid);
  if (!sheetRel?.Target) return await fallbackFirstMedia(zip);

  const sheetPath = joinXlPath("xl", sheetRel.Target); // e.g. xl/worksheets/sheet12.xml
  const sheetXml = await zip.file(sheetPath)?.async("text");
  if (!sheetXml) return await fallbackFirstMedia(zip);

  // Find drawing relationship id in sheet xml: <drawing r:id="rId1"/>
  const drawingRidMatch = /<drawing[^>]*r:id="([^"]+)"/.exec(sheetXml);
  if (!drawingRidMatch) return await fallbackFirstMedia(zip);
  const drawingRid = drawingRidMatch[1];

  const sheetRelsPath = sheetPath.replace(
    /^xl\/worksheets\/(.*)\.xml$/,
    "xl/worksheets/_rels/$1.xml.rels",
  );
  const sheetRelsXml = await zip.file(sheetRelsPath)?.async("text");
  if (!sheetRelsXml) return await fallbackFirstMedia(zip);

  const sheetRels = parser.parse(sheetRelsXml);
  const sheetRelationships: Rel[] = ensureArray(sheetRels?.Relationships?.Relationship);
  const drawingRel = sheetRelationships.find((r) => r.Id === drawingRid);
  if (!drawingRel?.Target) return await fallbackFirstMedia(zip);

  const drawingPath = joinXlPath("xl/worksheets", drawingRel.Target); // usually ../drawings/drawing1.xml
  const drawingXml = await zip.file(drawingPath)?.async("text");
  if (!drawingXml) return await fallbackFirstMedia(zip);

  // Find first embedded image in drawing xml: r:embed="rIdX"
  const embedMatch = /r:embed="([^"]+)"/.exec(drawingXml);
  if (!embedMatch) return await fallbackFirstMedia(zip);
  const embedRid = embedMatch[1];

  const drawingRelsPath = drawingPath.replace(
    /^xl\/drawings\/(.*)\.xml$/,
    "xl/drawings/_rels/$1.xml.rels",
  );
  const drawingRelsXml = await zip.file(drawingRelsPath)?.async("text");
  if (!drawingRelsXml) return await fallbackFirstMedia(zip);

  const drawingRels = parser.parse(drawingRelsXml);
  const drawingRelationships: Rel[] = ensureArray(drawingRels?.Relationships?.Relationship);
  const imageRel = drawingRelationships.find((r) => r.Id === embedRid);
  if (!imageRel?.Target) return await fallbackFirstMedia(zip);

  const imagePath = joinXlPath("xl/drawings", imageRel.Target); // usually ../media/image1.png
  const imageFile = zip.file(imagePath);
  if (!imageFile) return await fallbackFirstMedia(zip);

  const imageBytes = await imageFile.async("nodebuffer");
  const mime = mimeFromPath(imagePath);
  return `data:${mime};base64,${imageBytes.toString("base64")}`;
}

async function fallbackFirstMedia(zip: JSZip): Promise<string | undefined> {
  const candidates = Object.keys(zip.files)
    .filter((p) => p.startsWith("xl/media/"))
    .sort();
  const first = candidates[0];
  if (!first) return undefined;
  const bytes = await zip.file(first)!.async("nodebuffer");
  const mime = mimeFromPath(first);
  return `data:${mime};base64,${bytes.toString("base64")}`;
}
