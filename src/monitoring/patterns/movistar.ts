import type { CompanyPattern } from "../base-pattern";
import { runGeneric } from "./generic";

export const movistarPattern: CompanyPattern = {
  id: "movistar",
  matches: (name) => /movistar|telef[oó]nica\s+movistar/i.test(name),
  supportsAutomatedVerification: false,
  run: runGeneric,
};
