import { onDocumentCreated } from "firebase-functions/firestore";
import { info } from "firebase-functions/logger";

/*
 Triggered when a board is created in firestore.
 It should be used to add fields to the document that aren't required
 immediately, such as an expiry date.
*/
export const boardHydrator = onDocumentCreated(
  {
    region: "us-east1",
    minInstances: 0,
    maxInstances: 2,
    memory: "128MB",
    document: "boards/{boardId}",
  },
  async (event) => {
    const expire_at = new Date();
    expire_at.setMonth(expire_at.getMonth() + 6);
    await event.data.ref.update({ expire_at });
    info("board expiry set", { expireAt: expire_at, boardId: event.data.id });
  }
);
