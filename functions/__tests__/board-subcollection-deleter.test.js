import { describe, it, expect, vi, beforeEach } from "vitest";
import { info } from "firebase-functions/logger";
import "../board-subcollection-deleter.js";

// Capture the onDelete handler and a reference to the mocked Firestore instance.
const captured = vi.hoisted(() => ({ handler: null }));
const mockFirestore = vi.hoisted(() => ({ collection: vi.fn() }));

vi.mock("firebase-functions/firestore", () => ({
  onDocumentDeleted: vi.fn((opts, fn) => {
    captured.handler = fn;
    return {};
  }),
}));

vi.mock("firebase-functions/logger", () => ({ info: vi.fn(), error: vi.fn() }));

vi.mock("@google-cloud/firestore", () => ({
  default: vi.fn(() => mockFirestore),
}));

// Builds a mock collection that returns one batch of docs then an empty snapshot.
function makeCollection(docs) {
  const batches = [
    { docs, size: docs.length, empty: docs.length === 0 },
    { docs: [], size: 0, empty: true },
  ];
  let call = 0;
  return {
    limit: vi.fn().mockReturnValue({
      get: vi.fn().mockImplementation(() => Promise.resolve(batches[call++])),
    }),
  };
}

describe("boardSubcollectionDeleter", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes all docs in the cards and columns subcollections", async () => {
    const cardDelete = vi.fn().mockResolvedValue(undefined);
    const columnDelete = vi.fn().mockResolvedValue(undefined);

    mockFirestore.collection.mockImplementation((path) =>
      path.includes("cards")
        ? makeCollection([
            { ref: { delete: cardDelete } },
            { ref: { delete: cardDelete } },
          ])
        : makeCollection([{ ref: { delete: columnDelete } }])
    );

    await captured.handler({ params: { boardId: "board-1" } });

    expect(mockFirestore.collection).toHaveBeenCalledWith(
      "/boards/board-1/cards"
    );
    expect(mockFirestore.collection).toHaveBeenCalledWith(
      "/boards/board-1/columns"
    );
    expect(cardDelete).toHaveBeenCalledTimes(2);
    expect(columnDelete).toHaveBeenCalledTimes(1);
  });

  it("logs the deletion counts", async () => {
    mockFirestore.collection.mockImplementation((path) =>
      path.includes("cards")
        ? makeCollection([
            { ref: { delete: vi.fn().mockResolvedValue(undefined) } },
          ])
        : makeCollection([])
    );

    await captured.handler({ params: { boardId: "board-1" } });

    expect(info).toHaveBeenCalledWith("Deleted board", {
      boardId: "board-1",
      cardsDeleted: 1,
      columnsDeleted: 0,
    });
  });

  it("logs an error for a failed subcollection and still deletes the other", async () => {
    const { error } = await import("firebase-functions/logger");
    const columnDelete = vi.fn().mockResolvedValue(undefined);

    mockFirestore.collection.mockImplementation((path) => {
      if (path.includes("cards")) {
        return {
          limit: vi.fn().mockReturnValue({
            get: vi.fn().mockRejectedValue(new Error("permission denied")),
          }),
        };
      }
      return makeCollection([{ ref: { delete: columnDelete } }]);
    });

    await captured.handler({ params: { boardId: "board-1" } });

    expect(columnDelete).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith("Failed to delete cards", {
      boardId: "board-1",
      reason: "permission denied",
    });
    expect(info).toHaveBeenCalledWith("Deleted board", {
      boardId: "board-1",
      cardsDeleted: 0,
      columnsDeleted: 1,
    });
  });

  it("paginates through large collections in batches of 500", async () => {
    const deleteFn = vi.fn().mockResolvedValue(undefined);
    const makeDocs = (n) =>
      Array.from({ length: n }, () => ({ ref: { delete: deleteFn } }));

    function makeBatchedCollection() {
      let call = 0;
      const batches = [
        { docs: makeDocs(500), size: 500, empty: false },
        { docs: makeDocs(3), size: 3, empty: false },
        { docs: [], size: 0, empty: true },
      ];
      // Return one fixed object — the while loop calls collection() on every
      // iteration, so the same instance must be returned each time to keep the
      // batch counter advancing rather than resetting.
      return {
        limit: vi.fn().mockReturnValue({
          get: vi
            .fn()
            .mockImplementation(() => Promise.resolve(batches[call++])),
        }),
      };
    }

    const collections = {
      "/boards/board-1/cards": makeBatchedCollection(),
      "/boards/board-1/columns": makeBatchedCollection(),
    };
    mockFirestore.collection.mockImplementation((path) => collections[path]);

    await captured.handler({ params: { boardId: "board-1" } });

    // 503 docs per collection * 2 collections
    expect(deleteFn).toHaveBeenCalledTimes(1006);
  });
});
