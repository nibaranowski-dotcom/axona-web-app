import React from "react";

/**
 * Email-capture row — input fused to a lime action button, the
 * recurring Axona CTA pattern. Also works as a standalone bordered input.
 */
export function Input({ placeholder = "What's your work email?", buttonLabel = "Book a demo", onSubmit, style, ...rest }) {
  const [value, setValue] = React.useState("");
  const standalone = !buttonLabel;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        border: "1px solid #ddd",
        borderRadius: 9,
        overflow: "hidden",
        background: "var(--paper)",
        maxWidth: 430,
        ...style,
      }}
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        style={{ flex: 1, border: "none", outline: "none", padding: "13px 18px", fontSize: 15, fontFamily: "var(--font-sans)", color: "var(--ink)", background: "transparent" }}
        {...rest}
      />
      {!standalone && (
        <button
          onClick={() => onSubmit && onSubmit(value)}
          style={{ background: "var(--accent)", color: "var(--accent-ink)", border: "none", fontSize: 14.5, fontWeight: "var(--fw-semibold)", padding: "13px 22px", whiteSpace: "nowrap", cursor: "pointer", fontFamily: "var(--font-sans)" }}
        >
          {buttonLabel}
        </button>
      )}
    </div>
  );
}
