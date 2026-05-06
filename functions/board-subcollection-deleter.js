import { onDocumentDeleted } from "firebase-functions/firestore";
import Firestore from "@google-cloud/firestore";
import { info, error } from "firebase-functions/logger";

const firestore = new Firestore();

// Deletes all documents in a collection in batches and returns the total deleted.
// Batching avoids memory/timeout issues on large collections.
async function deleteCollection(reference) {
  let totalDeleted = 0;
  while (true) {
    const snapshot = await firestore.collection(reference).limit(500).get();
    if (snapshot.empty) break;
    await Promise.all(snapshot.docs.map((doc) => doc.ref.delete()));
    totalDeleted += snapshot.size;
    if (snapshot.size < 500) break;
  }
  return totalDeleted;
}

/*
 Triggered when a board is deleted in firestore.
 It cleans up subcollections such as cards and columns.
*/
export const boardSubcollectionDeleter = onDocumentDeleted(
  {
    region: "us-east1",
    minInstances: 0,
    maxInstances: 2,
    memory: "128MB",
    document: "boards/{boardId}",
  },
  async (event) => {
    const boardId = event.params.boardId;
    const results = await Promise.allSettled([
      deleteCollection(`/boards/${boardId}/cards`),
      deleteCollection(`/boards/${boardId}/columns`),
    ]);
    const [cardsResult, columnsResult] = results;
    const cardsDeleted =
      cardsResult.status === "fulfilled" ? cardsResult.value : 0;
    const columnsDeleted =
      columnsResult.status === "fulfilled" ? columnsResult.value : 0;
    for (const [name, result] of [
      ["cards", cardsResult],
      ["columns", columnsResult],
    ]) {
      if (result.status === "rejected") {
        error(`Failed to delete ${name}`, {
          boardId,
          reason: result.reason?.message,
        });
      }
    }
    info("Deleted board", { boardId, cardsDeleted, columnsDeleted });
  }
);
