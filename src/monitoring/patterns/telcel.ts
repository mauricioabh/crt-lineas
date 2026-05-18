import type { CompanyPattern } from "../base-pattern";
import { runGeneric } from "./generic";

export const telcelPattern: CompanyPattern = {
  id: "telcel",
  matches: (name) => /telcel/i.test(name),
  supportsAutomatedVerification: false,
  run: runGeneric,
};
