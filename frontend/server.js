const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");
const { OpenAI } = require("openai");

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("internal server error");
    }
  });

  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("user-message", async (message) => {
      try {
        const userMessage = {
          id: `user-${Date.now()}`,
          text: message,
          sender: "user",
          timestamp: new Date(),
        };
        socket.emit("message", userMessage);

        const completion = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content:
                "You are a helpful assistant in a voice chat application. Keep responses concise and conversational.",
            },
            { role: "user", content: message },
          ],
        });

        const aiResponse =
          completion.choices[0]?.message?.content ||
          "I couldn't process that request.";

        const aiMessage = {
          id: `ai-${Date.now()}`,
          text: aiResponse,
          sender: "ai",
          timestamp: new Date(),
        };

        socket.emit("message", aiMessage);
        socket.emit("ai-response", aiResponse);
      } catch (error) {
        console.error("Error processing message:", error);
        socket.emit("error", "Failed to process message");
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });

  httpServer
    .once("error", (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});
