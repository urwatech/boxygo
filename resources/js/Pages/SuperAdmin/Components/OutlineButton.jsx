import React from "react";

const OutlineButton = ({
  text = "Button",
  // width = "auto",
  // height = "auto",
  onClick,
  className = "",
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      //style={{ width, height }}
      className={`cursor-pointer inline-flex items-center justify-center rounded-full border border-[#338dff] text-blue-500 text-sm font-medium px-8 py-3 ${className}`}
    >
      {text}
    </button>
  );
};

export default OutlineButton;
