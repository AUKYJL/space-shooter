import { hashPassword, verifyPassword } from "./password";

describe("passwords", () => {
  it("accepts short passwords, salts hashes, and preserves spaces/case", async () => {
    const first = await hashPassword(" A ");
    expect(first).not.toBe(await hashPassword(" A "));
    expect(await verifyPassword(" A ", first)).toBe(true);
    expect(await verifyPassword("A", first)).toBe(false);
    expect(await verifyPassword(" a ", first)).toBe(false);
    expect(await verifyPassword("x", await hashPassword("x"))).toBe(true);
    expect(await verifyPassword("x", "invalid")).toBe(false);
  });
});
