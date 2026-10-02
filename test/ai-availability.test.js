import {test} from "node:test";
import assert from "node:assert/strict";
import {aiAvailability} from "../src/utils/ai-availability.js";
test("quota derives a single count and disables capture on exhaustion", () => {
 assert.equal(aiAvailability({available:true,used:2,dailyLimit:5}).headline,"3 estimaciones disponibles hoy");
 assert.equal(aiAvailability({available:true,used:5,dailyLimit:5}).canCapture,false);
 assert.equal(aiAvailability({available:true,blockedUntil:"2099-01-01T00:00:00Z"}).canCapture,false);
 assert.equal(aiAvailability({available:true,blockedUntil:"2000-01-01T00:00:00Z"}).canCapture,true);
 assert.equal(aiAvailability(null).canCapture,false);
});
