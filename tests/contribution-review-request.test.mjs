import assert from "node:assert/strict";
import test from "node:test";

const { default: contributionReviewRequest } =
  await import("../server/utils/contribution-review-request.ts");
const { readAuthorizedReviewRequest } = contributionReviewRequest;

test("reads the review body before authentication can consume the request", async () => {
  let requestConsumed = false;
  const calls = [];

  const result = await readAuthorizedReviewRequest({
    async readRequest() {
      calls.push("read");
      assert.equal(requestConsumed, false);
      requestConsumed = true;

      return { action: "approve" };
    },
    async authorize() {
      calls.push("authorize");
      requestConsumed = true;

      return { id: "maintainer-user", role: "maintainer" };
    },
  });

  assert.deepEqual(calls, ["read", "authorize"]);
  assert.equal(result.body.action, "approve");
  assert.equal(result.reviewer.role, "maintainer");
});
