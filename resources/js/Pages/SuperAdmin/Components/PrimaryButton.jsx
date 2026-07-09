import React from "react";

const PrimaryButton = ({
  text = "Button",
  // width = "auto",
  // height = "auto",
  onClick,
  className = "",
  type = "button",
  disabled = false,
  style,
}) => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{ ...style }}
      className={`cursor-pointer inline-flex items-center justify-center horizontal rounded-full border border-transparent bg-[#338dff] text-white text-sm font-medium px-8 py-3 shadow-[0_12px_20px_rgba(51,141,255,0.2)] transition-all duration-300ms hover:bg-white hover:text-blue-500 hover:border-[#338dff] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
    >
      {text}
    </button>
  );
};

export default PrimaryButton;
