"use client";

import { useState, useEffect, useRef } from "react";
import { initSocket, getSocket } from "@/lib/socket-client";
import { AzureSpeechService } from "@/lib/azure-speech";
import MessageBubble from "./MessageBubble";
import VoiceInput from "./VoiceInput";
import PhoneCall from "@/components/PhoneCall";

interface Message {
  id: string;
  text: string;
  sender: "user" | "ai";
  timestamp: Date;
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [inputMode, setInputMode] = useState<"text" | "voice" | "phone">(
    "text"
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const azureSpeech = useRef<AzureSpeechService | null>(null);

  useEffect(() => {
    azureSpeech.current = new AzureSpeechService();
    const socket = initSocket();

    socket.on("message", (message: Message) => {
      setMessages((prev) => [...prev, message]);
    });

    socket.on("ai-response", async (text: string) => {
      // Play AI response using TTS only in voice mode
      if (inputMode === "voice") {
        try {
          await azureSpeech.current?.textToSpeech(text);
        } catch (error) {
          console.error("TTS error:", error);
        }
      }
      setIsProcessing(false);
    });

    socket.on("error", (error: string) => {
      console.error("Socket error:", error);
      setIsProcessing(false);
    });

    return () => {
      azureSpeech.current?.dispose();
      socket.off("message");
      socket.off("ai-response");
      socket.off("error");
    };
  }, [inputMode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = (text: string) => {
    if (!text.trim() || isProcessing) return;

    setIsProcessing(true);
    getSocket().emit("user-message", text.trim());

    if (inputMode === "text") {
      setInputText("");
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputText);
  };

  const handleVoiceInput = async () => {
    if (isListening || isProcessing) return;

    setIsListening(true);
    try {
      const text = await azureSpeech.current!.startSpeechRecognition();
      if (text) {
        sendMessage(text);
      }
    } catch (error) {
      console.error("Speech recognition error:", error);
    } finally {
      setIsListening(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleTextSubmit(e);
    }
  };

  const switchToTextMode = () => {
    setInputMode("text");
    setTimeout(() => textInputRef.current?.focus(), 100);
  };

  const switchToVoiceMode = () => {
    setInputMode("voice");
    setInputText("");
  };

  const switchToPhoneMode = () => {
    setInputMode("phone");
    setInputText("");
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      <header className="bg-gray-800 text-white p-4 shadow-lg">
        <h1 className="text-2xl font-bold text-center">Vilio</h1>
        <p className="text-center text-gray-400 text-sm">
          Voice & Text AI Chat
        </p>
      </header>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-8">
            <div className="mb-4">
              <svg
                className="w-16 h-16 mx-auto mb-4 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </div>
            <p className="text-lg">Start a conversation</p>
            <p className="text-sm">
              Type a message, use voice input, or call directly
            </p>
          </div>
        )}

        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-gray-800 border-t border-gray-700">
        {/* Mode Toggle */}
        <div className="flex justify-center py-2">
          <div className="bg-gray-700 rounded-full p-1 flex">
            <button
              onClick={switchToTextMode}
              className={`px-4 py-2 rounded-full text-sm transition-all ${
                inputMode === "text"
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <svg
                className="w-4 h-4 inline mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              Type
            </button>
            <button
              onClick={switchToVoiceMode}
              className={`px-4 py-2 rounded-full text-sm transition-all ${
                inputMode === "voice"
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <svg
                className="w-4 h-4 inline mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
              Voice
            </button>
            <button
              onClick={switchToPhoneMode}
              className={`px-4 py-2 rounded-full text-sm transition-all ${
                inputMode === "phone"
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <svg
                className="w-4 h-4 inline mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                />
              </svg>
              Call
            </button>
          </div>
        </div>

        {/* Text Input Mode */}
        {inputMode === "text" && (
          <div className="p-4">
            <form onSubmit={handleTextSubmit} className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  ref={textInputRef}
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your message..."
                  disabled={isProcessing}
                  className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none disabled:opacity-50"
                />
                {isProcessing && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
              <button
                type="submit"
                disabled={!inputText.trim() || isProcessing}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
              </button>
            </form>
          </div>
        )}

        {/* Voice Input Mode */}
        {inputMode === "voice" && (
          <VoiceInput
            onPress={handleVoiceInput}
            isListening={isListening}
            isProcessing={isProcessing}
          />
        )}

        {/* Phone Call Mode */}
        {inputMode === "phone" && <PhoneCall />}
      </div>
    </div>
  );
}
