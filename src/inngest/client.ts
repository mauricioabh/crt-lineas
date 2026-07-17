import { Inngest, EventSchemas } from "inngest";

type Events = {
  "monitor/bulk.started": { data: { jobId: string; userId: string } };
  "monitor/link.verify": {
    data: {
      jobId: string;
      userId: string;
      itemId: string;
      linkId: string;
      index: number;
      batchId: string;
    };
  };
  "ingest/scrape.requested": {
    data: {
      /** Clerk user id of the admin that triggered the scrape (audit only). */
      requestedByUserId: string;
    };
  };
};

export const inngest = new Inngest({
  id: "crt-lineas",
  schemas: new EventSchemas().fromRecord<Events>(),
});
