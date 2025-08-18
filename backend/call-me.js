// call-me.js
import "dotenv/config";
import twilio from "twilio";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

async function callMyPhone() {
  try {
    console.log("📞 Making call to your phone...");

    const call = await client.calls.create({
      to: "+919309094327", // 👈 REPLACE WITH YOUR ACTUAL INDIAN PHONE NUMBER
      from: "+18149850522", // Your Twilio number
      url: "https://e87d8699745e.ngrok-free.app", // Your ngrok URL
    });

    console.log("✅ Call initiated successfully!");
    console.log("📱 Call SID:", call.sid);
    console.log("⏳ Status:", call.status);
    console.log("🔔 Your phone should ring in a few seconds...");
    console.log("📞 Answer the call and start talking to your AI assistant!");

    // Check status after 10 seconds
    setTimeout(async () => {
      try {
        const updatedCall = await client.calls(call.sid).fetch();
        console.log("📊 Updated call status:", updatedCall.status);
        console.log(
          "⏱️  Call duration:",
          updatedCall.duration || "N/A",
          "seconds"
        );

        if (updatedCall.status === "completed") {
          console.log("🎉 Call completed successfully!");
        } else if (updatedCall.status === "busy") {
          console.log("📵 Phone was busy");
        } else if (updatedCall.status === "no-answer") {
          console.log("📞 No answer");
        } else if (updatedCall.status === "failed") {
          console.log("❌ Call failed");
        }
      } catch (error) {
        console.log("ℹ️  Status check error:", error.message);
      }
    }, 10000);

    // Check status again after 30 seconds
    setTimeout(async () => {
      try {
        const finalCall = await client.calls(call.sid).fetch();
        console.log("🏁 Final call status:", finalCall.status);
        if (finalCall.duration) {
          console.log("⏱️  Total duration:", finalCall.duration, "seconds");
        }
      } catch (error) {
        console.log("ℹ️  Final status check error:", error.message);
      }
    }, 30000);
  } catch (error) {
    console.error("❌ Error making call:", error.message);
    console.error("🔍 Error code:", error.code);

    if (error.code === 21210) {
      console.log(
        "💡 Tip: Make sure your phone number includes country code (+91)"
      );
      console.log("💡 Example: +919876543210");
    } else if (error.code === 21608) {
      console.log("💡 Tip: This phone number may not be reachable");
    } else if (error.code === 20003) {
      console.log("💡 Tip: Check your Twilio credentials in .env file");
    }
  }
}

console.log("🚀 Starting voice assistant call test...");
callMyPhone();
