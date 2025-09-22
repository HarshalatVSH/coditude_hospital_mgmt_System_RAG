"use client";

import { useState, useEffect, useRef } from "react";
import { Device } from "@twilio/voice-sdk";

export default function PhoneCall() {
  const [isCallActive, setIsCallActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [callStatus, setCallStatus] = useState<string>("Initializing...");
  const [device, setDevice] = useState<Device | null>(null);
  const [connection, setConnection] = useState<any>(null);
  const [deviceReady, setDeviceReady] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const callTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Your Twilio number from the server
  const TWILIO_NUMBER = "+18149850522";

  // Format call duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  // Start call timer
  const startCallTimer = () => {
    callTimerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
  };

  // Stop call timer
  const stopCallTimer = () => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    setCallDuration(0);
  };

  useEffect(() => {
    initializeTwilio();

    return () => {
      if (device) {
        device.destroy();
      }
      stopCallTimer();
    };
  }, []);

  const initializeTwilio = async () => {
    try {
      setError(null);
      setCallStatus("Requesting microphone access...");

      // Request microphone permissions first
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (error: any) {
        setError("Microphone access is required for voice calls");
        setCallStatus("Microphone access denied");
        return;
      }

      setCallStatus("Getting access token...");

      // Get access token from your server
      const response = await fetch("/api/twilio-token");

      if (!response.ok) {
        throw new Error(`Failed to get access token: ${response.status}`);
      }

      const data = await response.json();

      if (!data.token) {
        throw new Error("Invalid token received from server");
      }

      setCallStatus("Connecting to Twilio...");

      // Create Twilio Device
      const newDevice = new Device(data.token, {
        logLevel: 1,
      });

      newDevice.on("registered", () => {
        setCallStatus("Ready to call");
        setDeviceReady(true);
        setError(null);
      });

      newDevice.on("error", (error: any) => {
        setError(`Device error: ${error.message}`);
        setCallStatus("Connection error");
        setDeviceReady(false);
      });

      newDevice.on("incoming", (call: any) => {
        // Handle incoming calls if needed
        console.log("Incoming call received");
      });

      // Register the device
      await newDevice.register();
      setDevice(newDevice);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      setError(`Failed to initialize: ${errorMessage}`);
      setCallStatus("Initialization failed");
      setDeviceReady(false);
    }
  };

  const startCall = async () => {
    if (!device || !deviceReady) {
      setError("Device not ready. Please try again.");
      return;
    }

    setIsConnecting(true);
    setCallStatus("Connecting...");
    setError(null);

    try {
      const call = await device.connect({
        params: { To: TWILIO_NUMBER },
      });

      setConnection(call);

      call.on("accept", () => {
        setIsCallActive(true);
        setIsConnecting(false);
        setCallStatus("Connected");
        startCallTimer();
      });

      call.on("disconnect", () => {
        setIsCallActive(false);
        setIsConnecting(false);
        setConnection(null);
        setCallStatus("Call ended");
        setIsMuted(false);
        stopCallTimer();
      });

      call.on("cancel", () => {
        setIsCallActive(false);
        setIsConnecting(false);
        setConnection(null);
        setCallStatus("Call cancelled");
        setIsMuted(false);
        stopCallTimer();
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      setError(`Failed to connect: ${errorMessage}`);
      setCallStatus("Connection failed");
      setIsConnecting(false);
    }
  };

  const endCall = () => {
    if (connection) {
      connection.disconnect();
    }
  };

  const toggleMute = () => {
    if (connection) {
      const currentMuteState = connection.isMuted();
      connection.mute(!currentMuteState);
      setIsMuted(!currentMuteState);
    }
  };

  const getStatusColor = () => {
    if (error) return "text-red-400";
    if (isCallActive) return "text-green-400";
    if (isConnecting) return "text-yellow-400";
    if (deviceReady) return "text-blue-400";
    return "text-gray-400";
  };

  const getStatusIcon = () => {
    if (isCallActive) {
      return (
        <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
      );
    }
    if (isConnecting) {
      return (
        <div className="w-3 h-3 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
      );
    }
    if (deviceReady) {
      return <div className="w-3 h-3 bg-blue-400 rounded-full"></div>;
    }
    return <div className="w-3 h-3 bg-gray-400 rounded-full"></div>;
  };

  return (
    <div className="max-w-md mx-auto bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl p-8 shadow-2xl border border-gray-700">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
          <svg
            className="w-10 h-10 text-white"
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
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">AI Assistant</h2>
        <p className="text-gray-400 text-sm">Voice-powered conversations</p>
      </div>

      {/* Phone Number */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-600 p-4 mb-6">
        <div className="flex items-center justify-center space-x-3">
          <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
            <svg
              className="w-4 h-4 text-blue-400"
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
          </div>
          <span className="text-white font-mono text-lg tracking-wider">
            {TWILIO_NUMBER}
          </span>
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center justify-center space-x-3 mb-6">
        {getStatusIcon()}
        <span className={`text-sm font-medium ${getStatusColor()}`}>
          {callStatus}
        </span>
        {isCallActive && (
          <span className="text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded-full">
            {formatDuration(callDuration)}
          </span>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-900/30 border border-red-500/30 rounded-lg p-3 mb-6">
          <div className="flex items-center space-x-2">
            <svg
              className="w-4 h-4 text-red-400 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="space-y-4">
        {!isCallActive && !isConnecting && (
          <button
            onClick={startCall}
            disabled={!deviceReady}
            className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-gray-600 disabled:to-gray-700 disabled:opacity-50 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 flex items-center justify-center space-x-3 shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:transform-none"
          >
            <svg
              className="w-6 h-6"
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
            <span>Start Call</span>
          </button>
        )}

        {isConnecting && (
          <div className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 text-white font-semibold py-4 px-6 rounded-xl flex items-center justify-center space-x-3">
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <span>Connecting...</span>
          </div>
        )}

        {isCallActive && (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={toggleMute}
              className={`flex items-center justify-center space-x-2 py-3 px-4 rounded-xl font-semibold transition-all duration-200 transform hover:scale-105 ${
                isMuted
                  ? "bg-red-500 hover:bg-red-600 text-white shadow-lg"
                  : "bg-gray-700 hover:bg-gray-600 text-gray-200 border border-gray-600"
              }`}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {isMuted ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                  />
                )}
              </svg>
              <span className="text-sm">{isMuted ? "Unmute" : "Mute"}</span>
            </button>

            <button
              onClick={endCall}
              className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl transform hover:scale-105"
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
                  d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                />
              </svg>
              <span className="text-sm">End Call</span>
            </button>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-8 text-center">
        <div className="bg-gray-800/30 backdrop-blur-sm rounded-lg p-4 border border-gray-700">
          <h3 className="text-sm font-medium text-gray-300 mb-2">How to use</h3>
          <div className="space-y-1 text-xs text-gray-400">
            <p>• Click "Start Call" to connect instantly</p>
            <p>• Or dial {TWILIO_NUMBER} from any phone</p>
            <p>• Speak naturally - AI responds with voice</p>
          </div>
        </div>
      </div>
    </div>
  );
}
