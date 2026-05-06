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

vi.mock("firebase-functions/logger", () => ({ info: vi.fn() }));

vi.mock("@google-cloud/firestore", () => ({
  default: vi.fn(() => mockFirestore),
}));

describe("boardSubcollectionDeleter", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes all docs in the cards and columns subcollections", async () => {
    const cardDelete = vi.fn().mockResolvedValue(undefined);
    const columnDelete = vi.fn().mockResolvedValue(undefined);

    mockFirestore.collection.mockImplementation((path) => ({
      get: vi.fn().mockResolvedValue({
        docs: path.includes("cards")
          ? [{ ref: { delete: cardDelete } }, { ref: { delete: cardDelete } }]
          : [{ ref: { delete: columnDelete } }],
        size: path.includes("cards") ? 2 : 1,
      }),
    }));

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
    mockFirestore.collection.mockImplementation((path) => ({
      get: vi.fn().mockResolvedValue({
        docs: path.includes("cards")
          ? [{ ref: { delete: vi.fn().mockResolvedValue(undefined) } }]
          : [],
        size: path.includes("cards") ? 1 : 0,
      }),
    }));

    await captured.handler({ params: { boardId: "board-1" } });

    expect(info).toHaveBeenCalledWith(
      { boardId: "board-1", cardsDeleted: 1, columnsDeleted: 0 },
      "Deleted board"
    );
  });

  it("exits early and logs when boardId is missing", async () => {
    await captured.handler({ params: {} });

    expect(mockFirestore.collection).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith("No board id found, exiting.");
  });
});
