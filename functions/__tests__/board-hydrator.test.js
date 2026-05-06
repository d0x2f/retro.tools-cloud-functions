import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { info } from "firebase-functions/logger";
import "../board-hydrator.js";

// Capture the onCreate handler when the module initialises at import time.
const captured = vi.hoisted(() => ({ handler: null }));

vi.mock("firebase-functions", () => ({
  default: {
    region: () => ({
      runWith: () => ({
        firestore: {
          document: () => ({
            onCreate: (fn) => {
              captured.handler = fn;
              return {};
            },
          }),
        },
      }),
    }),
  },
}));

vi.mock("firebase-functions/logger", () => ({ info: vi.fn() }));

describe("boardHydrator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00.000Z"));
  });

  afterEach(() => vi.useRealTimers());

  it("updates the document with expire_at six months from now", async () => {
    const update = vi.fn().mockResolvedValue(undefined);

    await captured.handler({ id: "board-1", ref: { update } });

    expect(update).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledWith({
      expire_at: new Date("2024-07-01T00:00:00.000Z"),
    });
  });

  it("logs the board id and expiry date", async () => {
    const update = vi.fn().mockResolvedValue(undefined);

    await captured.handler({ id: "board-1", ref: { update } });

    expect(info).toHaveBeenCalledOnce();
    expect(info).toHaveBeenCalledWith("board expiry set", {
      expireAt: new Date("2024-07-01T00:00:00.000Z"),
      boardId: "board-1",
    });
  });
});
