// import { HfInference } from '@huggingface/inference';

// const hf = new HfInference(process.env.HUGGING_FACE_ACCESS_TOKEN);
// const endpoint = hf.endpoint(process.env.HUGGING_FACE_ENDPOINT_URL);

// export async function aiResponse(conversation) {
//   try {
//     const params = {
//       messages: conversation,
//       parameters: {
//         max_new_tokens: 250,
//         temperature: 0.7,
//         top_p: 0.95,
//         do_sample: true
//       }
//     };

//     const generated_text = await endpoint.chatCompletion(params);
//     return generated_text.choices[0].message.content;
//   } catch (error) {
//     console.error('Error calling Hugging Face API:', error);
//     return "I apologize, but I'm having trouble processing your request right now.";
//   }
// }

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function aiResponse(conversation) {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: conversation,
      max_tokens: 250,
      temperature: 0.7,
      top_p: 0.95,
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error("Error calling OpenAI API:", error);
    return "I apologize, but I'm having trouble processing your request right now.";
  }
}
