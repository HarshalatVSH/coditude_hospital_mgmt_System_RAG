import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();

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

    return NextResponse.json({ response: aiResponse });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to process message" },
      { status: 500 }
    );
  }
}
