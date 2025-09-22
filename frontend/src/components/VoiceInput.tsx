interface VoiceInputProps {
  onPress: () => void;
  isListening: boolean;
  isProcessing: boolean;
}

export default function VoiceInput({
  onPress,
  isListening,
  isProcessing,
}: VoiceInputProps) {
  return (
    <div className="p-6">
      <div className="flex flex-col items-center space-y-4">
        {/* Voice Button */}
        <div className="relative">
          {/* Listening Animation Ring */}
          {isListening && (
            <div className="absolute inset-0 rounded-full border-4 border-red-500 animate-ping"></div>
          )}

          <button
            onClick={onPress}
            disabled={isProcessing}
            className={`relative p-6 rounded-full transition-all transform hover:scale-105 ${
              isListening
                ? "bg-red-600 hover:bg-red-700 shadow-lg shadow-red-500/50"
                : isProcessing
                ? "bg-gray-600 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/50"
            }`}
          >
            {isProcessing ? (
              <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
            ) : isListening ? (
              <div className="relative">
                <svg
                  className="w-8 h-8 text-white animate-pulse"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"
                    clipRule="evenodd"
                  />
                </svg>
                {/* Sound waves animation */}
                <div className="absolute -right-8 top-1/2 transform -translate-y-1/2 flex space-x-1">
                  <div className="w-1 h-2 bg-white rounded-full animate-pulse"></div>
                  <div
                    className="w-1 h-4 bg-white rounded-full animate-pulse"
                    style={{ animationDelay: "0.1s" }}
                  ></div>
                  <div
                    className="w-1 h-3 bg-white rounded-full animate-pulse"
                    style={{ animationDelay: "0.2s" }}
                  ></div>
                </div>
                <div className="absolute -left-8 top-1/2 transform -translate-y-1/2 flex space-x-1">
                  <div
                    className="w-1 h-3 bg-white rounded-full animate-pulse"
                    style={{ animationDelay: "0.2s" }}
                  ></div>
                  <div
                    className="w-1 h-4 bg-white rounded-full animate-pulse"
                    style={{ animationDelay: "0.1s" }}
                  ></div>
                  <div className="w-1 h-2 bg-white rounded-full animate-pulse"></div>
                </div>
              </div>
            ) : (
              <svg
                className="w-8 h-8 text-white"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </button>
        </div>

        {/* Status Text */}
        <div className="text-center">
          <p
            className={`text-sm font-medium ${
              isProcessing
                ? "text-yellow-400"
                : isListening
                ? "text-red-400"
                : "text-gray-400"
            }`}
          >
            {isProcessing
              ? "Processing..."
              : isListening
              ? "Listening..."
              : "Tap to speak"}
          </p>

          {!isListening && !isProcessing && (
            <p className="text-xs text-gray-500 mt-1">
              Press and hold to record your voice
            </p>
          )}
        </div>

        {/* Voice Level Indicator */}
        {isListening && (
          <div className="flex items-center space-x-1">
            <div className="w-1 h-4 bg-red-500 rounded-full animate-pulse"></div>
            <div
              className="w-1 h-6 bg-red-500 rounded-full animate-pulse"
              style={{ animationDelay: "0.1s" }}
            ></div>
            <div
              className="w-1 h-8 bg-red-500 rounded-full animate-pulse"
              style={{ animationDelay: "0.2s" }}
            ></div>
            <div
              className="w-1 h-6 bg-red-500 rounded-full animate-pulse"
              style={{ animationDelay: "0.3s" }}
            ></div>
            <div
              className="w-1 h-4 bg-red-500 rounded-full animate-pulse"
              style={{ animationDelay: "0.4s" }}
            ></div>
          </div>
        )}
      </div>
    </div>
  );
}
