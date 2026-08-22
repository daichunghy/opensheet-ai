import { digestJson } from "../core/canonical.js";
import { compilePlan } from "../core/plan.js";
import type { CellValue, CompiledPlan, SheetPlan } from "../core/types.js";

export interface ScaleBankItem {
  readonly code: string;
  readonly text: string;
  readonly reverse?: boolean;
  readonly source?: string;
}

export interface ScaleBankConstruct {
  readonly code: string;
  readonly name: string;
  readonly scale: {
    readonly min: number;
    readonly max: number;
  };
  readonly items: readonly ScaleBankItem[];
}

export interface ScaleBankIntent {
  readonly module: "scale-bank";
  readonly version: 1;
  readonly workbook: string;
  readonly sheetName?: string;
  readonly constructs: readonly ScaleBankConstruct[];
}

function requireText(value: string, field: string): void {
  if (value.trim().length === 0 || value.length > 500) {
    throw new TypeError(`${field} must contain from 1 to 500 characters.`);
  }
}

function validateIntent(intent: ScaleBankIntent): void {
  if (intent.module !== "scale-bank" || intent.version !== 1) {
    throw new TypeError("Scale bank intent must use module 'scale-bank' and version 1.");
  }
  requireText(intent.workbook, "workbook");
  if (intent.constructs.length === 0) {
    throw new TypeError("Scale bank intent requires at least one construct.");
  }

  const constructCodes = new Set<string>();
  const itemCodes = new Set<string>();
  intent.constructs.forEach((construct, constructIndex) => {
    requireText(construct.code, `constructs[${constructIndex}].code`);
    requireText(construct.name, `constructs[${constructIndex}].name`);
    if (constructCodes.has(construct.code)) {
      throw new TypeError(`Duplicate construct code: ${construct.code}`);
    }
    constructCodes.add(construct.code);
    if (
      !Number.isInteger(construct.scale.min) ||
      !Number.isInteger(construct.scale.max) ||
      construct.scale.min >= construct.scale.max
    ) {
      throw new TypeError(`Construct ${construct.code} requires integer scale bounds where min < max.`);
    }
    if (construct.items.length === 0) {
      throw new TypeError(`Construct ${construct.code} requires at least one item.`);
    }
    construct.items.forEach((item, itemIndex) => {
      requireText(item.code, `constructs[${constructIndex}].items[${itemIndex}].code`);
      requireText(item.text, `constructs[${constructIndex}].items[${itemIndex}].text`);
      if (itemCodes.has(item.code)) {
        throw new TypeError(`Duplicate scale item code: ${item.code}`);
      }
      itemCodes.add(item.code);
    });
  });
}

export function compileScaleBank(intent: ScaleBankIntent): CompiledPlan {
  validateIntent(intent);
  const sheet = intent.sheetName ?? "Scale Bank";
  const headers: CellValue[] = [
    "Construct Code",
    "Construct",
    "Item Code",
    "Item Text",
    "Scale Min",
    "Scale Max",
    "Reverse",
    "Source",
  ];
  const rows: CellValue[][] = intent.constructs.flatMap((construct) =>
    construct.items.map((item) => [
      construct.code,
      construct.name,
      item.code,
      item.text,
      construct.scale.min,
      construct.scale.max,
      item.reverse ?? false,
      item.source ?? "",
    ]),
  );
  const rowCount = rows.length + 1;
  const planId = `scale-bank-${digestJson(intent).slice(7, 23)}`;
  const plan: SheetPlan = {
    schemaVersion: "opensheet.plan.v1",
    planId,
    source: { module: "scale-bank", version: "1" },
    target: { workbook: intent.workbook },
    operations: [
      { id: "scale.ensure", kind: "ensure-sheet", sheet },
      {
        id: "scale.write",
        kind: "write-range",
        sheet,
        range: `A1:H${rowCount}`,
        values: [headers, ...rows],
      },
      {
        id: "scale.header-format",
        kind: "set-format",
        sheet,
        range: "A1:H1",
        format: {
          bold: true,
          backgroundColor: "#DCEFEA",
          wrap: true,
          horizontalAlignment: "center",
        },
      },
      {
        id: "scale.body-wrap",
        kind: "set-format",
        sheet,
        range: `A2:H${rowCount}`,
        format: { wrap: true, horizontalAlignment: "left" },
      },
      { id: "scale.freeze", kind: "freeze-pane", sheet, rows: 1, columns: 0 },
      {
        id: "scale.widths",
        kind: "set-column-widths",
        sheet,
        widths: [
          { column: "A", width: 18 },
          { column: "B", width: 28 },
          { column: "C", width: 16 },
          { column: "D", width: 54 },
          { column: "E", width: 12 },
          { column: "F", width: 12 },
          { column: "G", width: 12 },
          { column: "H", width: 28 },
        ],
      },
    ],
    metadata: {
      constructCount: String(intent.constructs.length),
      itemCount: String(rows.length),
    },
  };

  return compilePlan(plan);
}
