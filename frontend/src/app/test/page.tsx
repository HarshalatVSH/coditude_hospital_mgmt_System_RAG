"use client";

import React from "react";

type Props = {};

const Page = (props: Props) => {
  const handleClick = () => {
    // Send message to parent window (the page containing this iframe)
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "UNREAD_COUNT", count: 10 }, "*");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <button
        onClick={handleClick}
        className="px-6 py-3 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
      >
        Click me
      </button>
    </div>
  );
};

export default Page;
