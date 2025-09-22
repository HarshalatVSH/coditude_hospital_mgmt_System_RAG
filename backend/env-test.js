// env-test.js
// Save this file in your backend folder (same as server.js)
import "dotenv/config";

console.log("🔍 Checking environment variables...");
console.log("==========================================");
console.log("");

// Check OpenAI
console.log(
  "OpenAI API Key:",
  process.env.OPENAI_API_KEY ? "✅ Set" : "❌ Missing"
);
if (process.env.OPENAI_API_KEY) {
  console.log(
    "  Preview:",
    process.env.OPENAI_API_KEY.substring(0, 20) + "..."
  );
}
console.log("");

// Check HOST
console.log("HOST:", process.env.HOST ? "✅ Set" : "❌ Missing");
if (process.env.HOST) {
  console.log("  Value:", process.env.HOST);
}
console.log("");

// Check Twilio credentials
console.log(
  "Twilio Account SID:",
  process.env.TWILIO_ACCOUNT_SID ? "✅ Set" : "❌ Missing"
);
if (process.env.TWILIO_ACCOUNT_SID) {
  console.log(
    "  Preview:",
    process.env.TWILIO_ACCOUNT_SID.substring(0, 10) + "..."
  );
}
console.log("");

console.log(
  "Twilio Auth Token:",
  process.env.TWILIO_AUTH_TOKEN ? "✅ Set" : "❌ Missing"
);
if (process.env.TWILIO_AUTH_TOKEN) {
  console.log(
    "  Preview:",
    process.env.TWILIO_AUTH_TOKEN.substring(0, 8) + "..."
  );
}
console.log("");

// Summary
const missing = [];
if (!process.env.OPENAI_API_KEY) missing.push("OPENAI_API_KEY");
if (!process.env.HOST) missing.push("HOST");
if (!process.env.TWILIO_ACCOUNT_SID) missing.push("TWILIO_ACCOUNT_SID");
if (!process.env.TWILIO_AUTH_TOKEN) missing.push("TWILIO_AUTH_TOKEN");

if (missing.length === 0) {
  console.log("🎉 All required environment variables are set!");
  console.log("✅ You can now run: node call-me.js");
} else {
  console.log("❌ Missing variables:", missing.join(", "));
  console.log("");
  console.log("📝 Create/update your .env file with:");
  missing.forEach((variable) => {
    console.log(`${variable}="your_value_here"`);
  });
}

console.log("");
console.log("==========================================");
