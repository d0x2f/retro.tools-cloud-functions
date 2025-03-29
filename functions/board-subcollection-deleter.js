import firebase from "firebase-functions";
import Firestore from "@google-cloud/firestore";
import { info } from "firebase-functions/logger";

const firestore = new Firestore();

// Deletes all documents in a collection and returns the number deleted
async function deleteCollection(reference) {
  return firestore
    .collection(reference)
    .get()
    .then(async (querySnapshot) => {
      await Promise.all(querySnapshot.docs.map(snapshot => snapshot.ref.delete()));
      return querySnapshot.size;
    });
}
/*
 Triggered when a board is deleted in firestore.
 It cleans up subcollections such as cards columns.
*/
export const boardSubcollectionDeleter = firebase
  .region("us-east1")
  .runWith({
    minInstances: 0,
    maxInstances: 2,
    memory: "128MB",
  })
  .firestore.document("boards/{boardId}")
  .onDelete(async (_change, context) => {
    const boardId = context.params.boardId;
    if (!boardId) {
      info("No board id found, exiting.");
      return;
    }
    const [cardsDeleted, columnsDeleted] = await Promise.all([
      deleteCollection(`/boards/${boardId}/cards`),
      deleteCollection(`/boards/${boardId}/columns`),
    ]);
    info({ boardId, cardsDeleted, columnsDeleted }, "Deleted board");
  });
