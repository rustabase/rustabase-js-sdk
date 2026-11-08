import { describe, expect, it, vi } from "vitest";
import { createClient } from "../src/client";
import { mockFetch } from "./helpers";

function clientWithProvider(authURL: string) {
    const { fetch } = mockFetch((url) =>
        url.includes("/auth-methods")
            ? {
                  body: {
                      oauth2: {
                          enabled: true,
                          providers: [
                              {
                                  name: "evil",
                                  displayName: "Evil",
                                  state: "s",
                                  authURL,
                                  codeVerifier: "v",
                              },
                          ],
                      },
                  },
              }
            : { body: {} },
    );
    return createClient("http://example.test", { fetch });
}

describe("signInWithOAuth address check", () => {
    for (const authURL of [
        "javascript:alert(document.cookie)//?redirect_uri=",
        "data:text/html,<script>alert(1)</script>?redirect_uri=",
        "vbscript:msgbox(1)?redirect_uri=",
        "not a url",
        "",
    ]) {
        it(`refuses to open ${JSON.stringify(authURL.slice(0, 16))}`, async () => {
            const openUrl = vi.fn();
            const rb = clientWithProvider(authURL);
            await expect(
                rb.auth("users").signInWithOAuth({ provider: "evil", openUrl }),
            ).rejects.toThrow("unsupported address");
            expect(openUrl).not.toHaveBeenCalled();
        });
    }
});
