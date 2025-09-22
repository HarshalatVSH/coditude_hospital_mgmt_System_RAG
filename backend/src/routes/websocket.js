// import { aiResponse } from '../utils/ai.js';

// const SYSTEM_PROMPT = "You are a helpful assistant. This conversation is being translated to voice, so answer carefully. When you respond, please spell out all numbers, for example twenty not 20. Do not include emojis in your responses. Do not include bullet points, asterisks, or special symbols. Keep your responses concise and direct.";
// const sessions = new Map();

// export default async function websocketRoutes(fastify) {
//   fastify.get("/ws", { websocket: true }, (ws, req) => {
//     ws.on("message", async (data) => {
//       const message = JSON.parse(data);

//       switch (message.type) {
//         case "setup":
//           const callSid = message.callSid;
//           console.log("Setup for call:", callSid);
//           ws.callSid = callSid;
//           sessions.set(callSid, [{ role: "system", content: SYSTEM_PROMPT }]);
//           break;
//         case "prompt":
//           console.log("Processing prompt:", message.voicePrompt);
//           const conversation = sessions.get(ws.callSid);
//           conversation.push({ role: "user", content: message.voicePrompt });

//           const response = await aiResponse(conversation);
//           conversation.push({ role: "assistant", content: response });

//           ws.send(
//             JSON.stringify({
//               type: "text",
//               token: response,
//               last: true,
//             })
//           );
//           console.log("Sent response:", response);
//           break;
//         case "interrupt":
//           console.log("Handling interruption.");
//           break;
//         default:
//           console.warn("Unknown message type received:", message.type);
//           break;
//       }
//     });

//     ws.on("close", () => {
//       console.log("WebSocket connection closed");
//       sessions.delete(ws.callSid);
//     });
//   });
// }

import { EnhancedAIService } from "../services/enhancedAI.js";
import { aiResponse } from "../utils/ai.js";

// Initialize Enhanced AI Service
const enhancedAI = new EnhancedAIService();
let enhancedAIReady = false;

// Initialize the enhanced AI service
(async () => {
  try {
    await enhancedAI.initialize();
    enhancedAIReady = true;
    console.log("✅ Enhanced AI Service ready for WebSocket connections");
  } catch (error) {
    console.error("❌ Failed to initialize Enhanced AI Service:", error);
    console.log("🔄 Will fallback to basic AI responses");
  }
})();

const SYSTEM_PROMPT =
  "You are Riley, a helpful appointment scheduling assistant for Wellness Partners clinic. This conversation is being translated to voice, so answer carefully. When you respond, please spell out all numbers, for example twenty not 20. Do not include emojis in your responses. Do not include bullet points, asterisks, or special symbols. Keep your responses concise and direct.";

const sessions = new Map();

export default async function websocketRoutes(fastify) {
  fastify.get("/ws", { websocket: true }, (ws, req) => {
    console.log("📞 New WebSocket connection established");

    ws.on("message", async (data) => {
      try {
        const message = JSON.parse(data);
        console.log("📥 Received message:", message.type);

        switch (message.type) {
          case "setup":
            await handleSetup(ws, message);
            break;

          case "prompt":
            await handlePrompt(ws, message);
            break;

          case "interrupt":
            await handleInterrupt(ws, message);
            break;

          default:
            console.warn("⚠️ Unknown message type received:", message.type);
            break;
        }
      } catch (error) {
        console.error("❌ Error processing WebSocket message:", error);

        // Send error response
        ws.send(
          JSON.stringify({
            type: "text",
            token:
              "I apologize, but I'm having trouble processing your request. Please try again.",
            last: true,
          })
        );
      }
    });

    ws.on("close", () => {
      console.log("📴 WebSocket connection closed");
      if (ws.callSid) {
        sessions.delete(ws.callSid);
        console.log(`🗑️ Cleaned up session for call: ${ws.callSid}`);
      }
    });

    ws.on("error", (error) => {
      console.error("❌ WebSocket error:", error);
    });
  });
}

async function handleSetup(ws, message) {
  const callSid = message.callSid;
  console.log("🔧 Setting up session for call:", callSid);

  ws.callSid = callSid;

  // Initialize conversation history
  sessions.set(callSid, {
    callSid,
    startTime: new Date(),
    conversationHistory: [{ role: "system", content: SYSTEM_PROMPT }],
    messageCount: 0,
  });

  console.log(`✅ Session initialized for call: ${callSid}`);
}

async function handlePrompt(ws, message) {
  const startTime = Date.now();
  const userPrompt = message.voicePrompt;

  console.log(`🎙️ Processing prompt for call ${ws.callSid}: "${userPrompt}"`);

  if (!ws.callSid) {
    console.error("❌ No callSid found for WebSocket connection");
    return;
  }

  let session = sessions.get(ws.callSid);
  if (!session) {
    console.warn("⚠️ Session not found, creating new one");
    session = {
      callSid: ws.callSid,
      startTime: new Date(),
      conversationHistory: [{ role: "system", content: SYSTEM_PROMPT }],
      messageCount: 0,
    };
    sessions.set(ws.callSid, session);
  }

  try {
    let response;

    if (enhancedAIReady) {
      // Use Enhanced AI Service with RAG
      console.log("🤖 Using Enhanced AI Service with RAG");
      response = await enhancedAI.processUserInput(
        ws.callSid,
        userPrompt,
        session.conversationHistory
      );
    } else {
      // Fallback to basic AI response
      console.log("🔄 Using fallback AI response");
      response = await getFallbackResponse(userPrompt, session);
    }

    // Update conversation history
    session.conversationHistory.push({ role: "user", content: userPrompt });
    session.conversationHistory.push({ role: "assistant", content: response });
    session.messageCount++;

    // Limit conversation history to last 20 messages to manage memory
    if (session.conversationHistory.length > 20) {
      // Keep system prompt and last 18 messages
      session.conversationHistory = [
        session.conversationHistory[0], // system prompt
        ...session.conversationHistory.slice(-18),
      ];
    }

    // Send response
    ws.send(
      JSON.stringify({
        type: "text",
        token: response,
        last: true,
      })
    );

    const processingTime = Date.now() - startTime;
    console.log(
      `✅ Response sent for call ${
        ws.callSid
      } (${processingTime}ms): "${response.substring(0, 100)}..."`
    );
  } catch (error) {
    console.error(`❌ Error processing prompt for call ${ws.callSid}:`, error);

    // Send error response
    const errorResponse =
      "I apologize, but I'm having trouble processing your request right now. Let me transfer you to our scheduling team.";

    ws.send(
      JSON.stringify({
        type: "text",
        token: errorResponse,
        last: true,
      })
    );
  }
}

async function handleInterrupt(ws, message) {
  console.log(`⏸️ Handling interruption for call: ${ws.callSid}`);

  // You can add logic here to handle interruptions
  // For example, stopping ongoing processing or clearing buffers

  // For now, just log the interruption
  const session = sessions.get(ws.callSid);
  if (session) {
    console.log(`📊 Session stats: ${session.messageCount} messages exchanged`);
  }
}

async function getFallbackResponse(userPrompt, session) {
  try {
    // Enhanced fallback that includes Riley's personality
    const enhancedPrompt = `You are Riley, a friendly appointment scheduling assistant for Wellness Partners clinic.

Key Information:
- Wellness Partners is a multi-specialty health clinic
- We offer Primary Care, Cardiology, Dermatology, Orthopedics, and Pediatrics
- Available Monday-Friday 8am-5pm, Saturday 9am-12pm for some services
- 24-hour cancellation policy
- New patients arrive 20 minutes early, returning patients 15 minutes early

Current user request: ${userPrompt}

Respond as Riley in a warm, professional manner. Spell out numbers and keep the response conversational and helpful for voice interaction.`;

    session.conversationHistory.push({ role: "user", content: enhancedPrompt });

    const response = await aiResponse(session.conversationHistory);
    return response;
  } catch (error) {
    console.error("❌ Fallback response failed:", error);
    return "Thank you for calling Wellness Partners. I'm Riley, your scheduling assistant. I'm having a brief technical issue, but I'd be happy to help you schedule an appointment. Could you tell me what type of appointment you need?";
  }
}

// Cleanup function to remove old sessions
function cleanupOldSessions() {
  const cutoffTime = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago
  let cleanedCount = 0;

  for (const [callSid, session] of sessions.entries()) {
    if (session.startTime < cutoffTime) {
      sessions.delete(callSid);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    console.log(`🧹 Cleaned up ${cleanedCount} old sessions`);
  }
}

// Run cleanup every 15 minutes
setInterval(cleanupOldSessions, 15 * 60 * 1000);

// Export functions for testing
export { handleSetup, handlePrompt, handleInterrupt, cleanupOldSessions };
