import { expect, test, vi } from "vitest";
import { MemorySession } from "../src/session/session";

test("clearing an empty session emits no change", () => {
    const session = new MemorySession();
    const listener = vi.fn();
    session.onChange(listener);
    session.clear();
    expect(listener).not.toHaveBeenCalled();
});

test("clearing a populated session emits once and clears both values", () => {
    const session = new MemorySession();
    session.set("test-token", { id: "record_1" });
    const listener = vi.fn();
    session.onChange(listener);
    session.clear();
    session.clear();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith("", null);
    expect(session.token).toBe("");
    expect(session.record).toBeNull();
});
