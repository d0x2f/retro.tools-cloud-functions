import firebase from "firebase-functions";
import { info } from "firebase-functions/logger";
/*
 Triggered when a board is created in firestore.
 It should be used to add fields to the document that aren't required
 immediately, such as an expiry date.
*/
export const boardHydrator = firebase
  .region("us-east1")
  .runWith({
    minInstances: 0,
    maxInstances: 2,
    memory: "128MB",
  })
  .firestore.document("boards/{boardId}")
  .onCreate(async (doc) => {
    const expire_at = new Date();
    expire_at.setMonth(expire_at.getMonth() + 6);
    await doc.ref.update({ expire_at });
    info("board expiry set", { expireAt: expire_at, boardId: doc.id });
  });
