import type { Page } from "playwright";

export type MonitorResult = {
  hasActiveLines: boolean | null;
  notes: string;
  isManualReview: boolean;
};

export type MonitorRunContext = {
  url: string;
  curp: string | null;
  phone: string | null;
  manualWaitMs: number;
};

export type CompanyPattern = {
  id: string;
  matches: (companyName: string) => boolean;
  /** If set, takes precedence over `matches(companyName)` when the URL matches. */
  matchesUrl?: (url: string) => boolean;
  /**
   * When false, `POST /api/monitor/:linkId` does not launch Playwright; the UI
   * should rely on ajuste manual. Set true only for portals with a dedicated flow.
   */
  supportsAutomatedVerification: boolean;
  run: (page: Page, context: MonitorRunContext) => Promise<MonitorResult>;
};
