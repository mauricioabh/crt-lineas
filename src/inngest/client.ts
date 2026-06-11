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
};

export const inngest = new Inngest({
  id: "crt-lineas",
  schemas: new EventSchemas().fromRecord<Events>(),
});
