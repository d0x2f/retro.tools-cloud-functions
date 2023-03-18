import firebase from "firebase-functions";
import { info } from "firebase-functions/logger";
import moment from "moment";

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
    const expire_at = moment().add(6, "months").toDate();
    await doc.ref.update({ expire_at });
    info("board expiry set", { expireAt: expire_at, boardId: doc.id });
  });
