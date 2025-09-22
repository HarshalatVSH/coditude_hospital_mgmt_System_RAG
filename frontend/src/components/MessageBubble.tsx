interface Message {
  id: string;
  text: string;
  sender: "user" | "ai";
  timestamp: Date;
}

interface MessageBubbleProps {
  message: Message;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.sender === "user";
  const isAI = message.sender === "ai";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      <div
        className={`flex items-end space-x-2 max-w-xs lg:max-w-md ${
          isUser ? "flex-row-reverse space-x-reverse" : ""
        }`}
      >
        {/* Avatar */}
        <div
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
            isUser ? "bg-blue-600" : "bg-gray-600"
          }`}
        >
          {isUser ? (
            <svg
              className="w-5 h-5 text-white"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg
              className="w-5 h-5 text-white"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M3 4a1 1 0 011-1h12a1 1 0 011 1v8a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm1 1v6h12V5H4z"
                clipRule="evenodd"
              />
              <path d="M9 10a1 1 0 100-2 1 1 0 000 2z" />
              <path d="M11 10a1 1 0 100-2 1 1 0 000 2z" />
            </svg>
          )}
        </div>

        {/* Message Content */}
        <div
          className={`relative px-4 py-3 rounded-2xl shadow-lg ${
            isUser
              ? "bg-blue-600 text-white rounded-br-md"
              : "bg-gray-700 text-gray-100 rounded-bl-md"
          }`}
        >
          {/* Message Text */}
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {message.text}
          </p>

          {/* Timestamp */}
          <p
            className={`text-xs mt-2 ${
              isUser ? "text-blue-200" : "text-gray-400"
            }`}
          >
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>

          {/* Message Tail */}
          <div
            className={`absolute bottom-0 ${
              isUser
                ? "right-0 transform translate-x-1 translate-y-1"
                : "left-0 transform -translate-x-1 translate-y-1"
            }`}
          >
            <div
              className={`w-3 h-3 transform rotate-45 ${
                isUser ? "bg-blue-600" : "bg-gray-700"
              }`}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
}
