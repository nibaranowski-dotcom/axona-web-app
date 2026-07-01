/* @ds-bundle: {"format":3,"namespace":"AxonaDesignSystem_4752cf","components":[{"name":"ArrowLink","sourcePath":"components/core/ArrowLink.jsx"},{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"MonoChip","sourcePath":"components/core/MonoChip.jsx"},{"name":"Pill","sourcePath":"components/core/Pill.jsx"},{"name":"StatChip","sourcePath":"components/core/StatChip.jsx"},{"name":"Wordmark","sourcePath":"components/core/Wordmark.jsx"},{"name":"FeatureCard","sourcePath":"components/data/FeatureCard.jsx"},{"name":"Skel","sourcePath":"components/data/Skel.jsx"},{"name":"StatTile","sourcePath":"components/data/StatTile.jsx"},{"name":"EmailCapture","sourcePath":"components/forms/EmailCapture.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Toggle","sourcePath":"components/forms/Toggle.jsx"}],"sourceHashes":{"components/core/ArrowLink.jsx":"d700be917330","components/core/Badge.jsx":"ad62d12a4df4","components/core/Button.jsx":"d220e6b170d0","components/core/MonoChip.jsx":"16de84e97cb8","components/core/Pill.jsx":"e038c766b604","components/core/StatChip.jsx":"099fd8675098","components/core/Wordmark.jsx":"7944487082aa","components/data/FeatureCard.jsx":"02619db9d007","components/data/Skel.jsx":"8e52f1257456","components/data/StatTile.jsx":"e46c8271f043","components/forms/EmailCapture.jsx":"4e4b17a9f544","components/forms/Select.jsx":"71352275890f","components/forms/Toggle.jsx":"aaff536eacbf","ui_kits/platform/dashboard.jsx":"6966156a8a8c","ui_kits/platform/shell.jsx":"1186aa5c5187","ui_kits/website/chrome.jsx":"2cf2974aa3c2","ui_kits/website/sections.jsx":"bbb2dabe8dc4"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {
  const __ds_ns = (window.AxonaDesignSystem_4752cf =
    window.AxonaDesignSystem_4752cf || {});

  const __ds_scope = {};

  __ds_ns.__errors = __ds_ns.__errors || [];

  // components/core/ArrowLink.jsx
  try {
    (() => {
      function _extends() {
        return (
          (_extends = Object.assign
            ? Object.assign.bind()
            : function (n) {
                for (var e = 1; e < arguments.length; e++) {
                  var t = arguments[e];
                  for (var r in t)
                    ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]);
                }
                return n;
              }),
          _extends.apply(null, arguments)
        );
      }
      /** Arrow link — quiet inline "Read the story →" affordance; hover fades to 60%. */
      function ArrowLink({
        children,
        href = "#",
        className = "",
        style = {},
        ...props
      }) {
        return /*#__PURE__*/ React.createElement(
          "a",
          _extends(
            {
              href: href,
              className: className,
              style: {
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                fontFamily: "var(--font-sans)",
                fontSize: 14.5,
                fontWeight: 500,
                color: "var(--ink)",
                textDecoration: "none",
                transition: "opacity var(--motion-fast)",
                ...style,
              },
              onMouseEnter: (e) => (e.currentTarget.style.opacity = "0.6"),
              onMouseLeave: (e) => (e.currentTarget.style.opacity = "1"),
            },
            props,
          ),
          children,
          /*#__PURE__*/ React.createElement(
            "span",
            {
              "aria-hidden": "true",
            },
            "\u2192",
          ),
        );
      }
      Object.assign(__ds_scope, { ArrowLink });
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "components/core/ArrowLink.jsx",
      error: String((e && e.message) || e),
    });
  }

  // components/core/Badge.jsx
  try {
    (() => {
      /**
       * Badge — small status/label pill.
       * tone: "lime" (THE MOAT / MVP / Coming soon highlights) · "ok" (Auto-applied / approved) · "neutral"
       */
      function Badge({ children, tone = "lime", className = "", style = {} }) {
        const tones = {
          lime: {
            background: "var(--lime)",
            color: "var(--on-lime)",
            border: "1px solid transparent",
          },
          ok: {
            background: "var(--okbg)",
            color: "var(--ok)",
            border: "1px solid transparent",
          },
          neutral: {
            background: "var(--chip)",
            color: "var(--body)",
            border: "1px solid var(--line2)",
          },
        };
        return /*#__PURE__*/ React.createElement(
          "span",
          {
            className: className,
            style: {
              display: "inline-flex",
              alignItems: "center",
              borderRadius: "var(--radius-pill)",
              padding: "3px 9px",
              fontFamily: "var(--font-sans)",
              fontSize: 10.5,
              fontWeight: 600,
              letterSpacing: "0.04em",
              whiteSpace: "nowrap",
              ...tones[tone],
              ...style,
            },
          },
          children,
        );
      }
      Object.assign(__ds_scope, { Badge });
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "components/core/Badge.jsx",
      error: String((e && e.message) || e),
    });
  }

  // components/core/Button.jsx
  try {
    (() => {
      function _extends() {
        return (
          (_extends = Object.assign
            ? Object.assign.bind()
            : function (n) {
                for (var e = 1; e < arguments.length; e++) {
                  var t = arguments[e];
                  for (var r in t)
                    ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]);
                }
                return n;
              }),
          _extends.apply(null, arguments)
        );
      }
      /**
       * Axona Button — the lime CTA is the brand's primary action signal.
       * variant: "primary" (lime on ink) · "dark" (ink on white) · "secondary" (white, hairline) · "ghost"
       * size: "sm" · "md"
       */
      function Button({
        children,
        variant = "primary",
        size = "md",
        href,
        disabled = false,
        className = "",
        style = {},
        ...props
      }) {
        const pad = size === "sm" ? "7px 14px" : "9px 18px";
        const fontSize = size === "sm" ? 13 : 14;
        const variants = {
          primary: {
            background: "var(--lime)",
            color: "var(--on-lime)",
            border: "1px solid transparent",
          },
          dark: {
            background: "var(--ink)",
            color: "#fff",
            border: "1px solid var(--ink)",
          },
          secondary: {
            background: "var(--paper)",
            color: "var(--text)",
            border: "1px solid var(--line2)",
          },
          ghost: {
            background: "transparent",
            color: "var(--text)",
            border: "1px solid transparent",
          },
        };
        const base = {
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 7,
          fontFamily: "var(--font-sans)",
          fontWeight: 600,
          fontSize,
          lineHeight: 1,
          padding: pad,
          borderRadius: "var(--radius-btn)",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
          textDecoration: "none",
          whiteSpace: "nowrap",
          transition:
            "background var(--motion-fast), opacity var(--motion-fast), border-color var(--motion-fast)",
          ...variants[variant],
          ...style,
        };
        const onEnter = (e) => {
          if (disabled) return;
          if (variant === "primary")
            e.currentTarget.style.background = "var(--lime-hover)";
          else if (variant === "dark") e.currentTarget.style.opacity = "0.85";
          else if (variant === "secondary")
            e.currentTarget.style.borderColor = "var(--ink)";
          else e.currentTarget.style.background = "var(--chip)";
        };
        const onLeave = (e) => {
          if (disabled) return;
          e.currentTarget.style.background = variants[variant].background;
          e.currentTarget.style.opacity = "1";
          e.currentTarget.style.borderColor = variants[variant].border.includes(
            "line2",
          )
            ? "var(--line2)"
            : variants[variant].border.includes("ink")
              ? "var(--ink)"
              : "transparent";
        };
        const Tag = href ? "a" : "button";
        return /*#__PURE__*/ React.createElement(
          Tag,
          _extends(
            {
              href: href,
              disabled: href ? undefined : disabled,
              style: base,
              className: className,
              onMouseEnter: onEnter,
              onMouseLeave: onLeave,
            },
            props,
          ),
          children,
        );
      }
      Object.assign(__ds_scope, { Button });
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "components/core/Button.jsx",
      error: String((e && e.message) || e),
    });
  }

  // components/core/MonoChip.jsx
  try {
    (() => {
      /** Mono chip — a small JetBrains-Mono pill for counters, codes, and stat values. */
      function MonoChip({ children, className = "", style = {} }) {
        return /*#__PURE__*/ React.createElement(
          "span",
          {
            className: className,
            style: {
              display: "inline-flex",
              alignItems: "center",
              border: "1px solid var(--line2)",
              background: "var(--chip)",
              borderRadius: 5,
              padding: "3px 8px",
              fontFamily: "var(--font-mono)",
              fontSize: 11.5,
              fontWeight: 500,
              color: "var(--ink)",
              whiteSpace: "nowrap",
              ...style,
            },
          },
          children,
        );
      }
      Object.assign(__ds_scope, { MonoChip });
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "components/core/MonoChip.jsx",
      error: String((e && e.message) || e),
    });
  }

  // components/core/Pill.jsx
  try {
    (() => {
      function _extends() {
        return (
          (_extends = Object.assign
            ? Object.assign.bind()
            : function (n) {
                for (var e = 1; e < arguments.length; e++) {
                  var t = arguments[e];
                  for (var r in t)
                    ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]);
                }
                return n;
              }),
          _extends.apply(null, arguments)
        );
      }
      /** Pill — tab / filter chip. active = ink fill (white text); inactive = white with hairline. */
      function Pill({
        children,
        active = false,
        className = "",
        style = {},
        ...props
      }) {
        return /*#__PURE__*/ React.createElement(
          "button",
          _extends(
            {
              className: className,
              style: {
                display: "inline-flex",
                alignItems: "center",
                borderRadius: "var(--radius-pill)",
                padding: "8px 15px",
                fontFamily: "var(--font-sans)",
                fontSize: 13.5,
                fontWeight: 500,
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition:
                  "background var(--motion-fast), border-color var(--motion-fast)",
                ...(active
                  ? {
                      background: "var(--ink)",
                      color: "#fff",
                      border: "1px solid var(--ink)",
                    }
                  : {
                      background: "var(--paper)",
                      color: "var(--body)",
                      border: "1px solid var(--line2)",
                    }),
                ...style,
              },
            },
            props,
          ),
          children,
        );
      }
      Object.assign(__ds_scope, { Pill });
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "components/core/Pill.jsx",
      error: String((e && e.message) || e),
    });
  }

  // components/core/StatChip.jsx
  try {
    (() => {
      /** Stat chip — a mono LABEL followed by a MonoChip value. Used in the agents strip / data planes. */
      function StatChip({ label, value, className = "", style = {} }) {
        return /*#__PURE__*/ React.createElement(
          "span",
          {
            className: className,
            style: {
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              ...style,
            },
          },
          /*#__PURE__*/ React.createElement(
            "span",
            {
              style: {
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "0.04em",
                color: "var(--dim)",
                textTransform: "uppercase",
              },
            },
            label,
            ":",
          ),
          /*#__PURE__*/ React.createElement(__ds_scope.MonoChip, null, value),
        );
      }
      Object.assign(__ds_scope, { StatChip });
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "components/core/StatChip.jsx",
      error: String((e && e.message) || e),
    });
  }

  // components/core/Wordmark.jsx
  try {
    (() => {
      /**
       * Wordmark — the Axona lockup: lowercase "axona" + the asymmetric square mark.
       * tone: "ink" (default) · "paper" (for dark surfaces) · "lime"
       */
      function Wordmark({
        tone = "ink",
        size = 23,
        className = "",
        style = {},
      }) {
        const colors = {
          ink: "var(--ink)",
          paper: "#fff",
          lime: "var(--lime)",
        };
        const c = colors[tone];
        const m = Math.round(size * 0.57);
        return /*#__PURE__*/ React.createElement(
          "span",
          {
            className: className,
            style: {
              display: "inline-flex",
              alignItems: "center",
              gap: size * 0.34,
              ...style,
            },
          },
          /*#__PURE__*/ React.createElement(
            "span",
            {
              style: {
                fontFamily: "var(--font-sans)",
                fontWeight: 700,
                fontSize: size,
                letterSpacing: "-0.04em",
                color: c,
                lineHeight: 1,
              },
            },
            "axona",
          ),
          /*#__PURE__*/ React.createElement("span", {
            "aria-hidden": "true",
            style: {
              width: m * 0.57,
              height: m * 0.57,
              background: c,
              borderRadius: "0 7px 0 7px",
              display: "inline-block",
            },
          }),
        );
      }
      Object.assign(__ds_scope, { Wordmark });
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "components/core/Wordmark.jsx",
      error: String((e && e.message) || e),
    });
  }

  // components/data/Skel.jsx
  try {
    (() => {
      /** Skel — skeleton bars used inside placeholder mock cards. */
      function Skel({
        widths = ["100%", "70%", "84%"],
        className = "",
        style = {},
      }) {
        return /*#__PURE__*/ React.createElement(
          "div",
          {
            className: className,
            style: {
              display: "flex",
              flexDirection: "column",
              gap: 9,
              marginTop: 14,
              ...style,
            },
          },
          widths.map((w, i) =>
            /*#__PURE__*/ React.createElement("div", {
              key: i,
              style: {
                height: 8,
                borderRadius: 4,
                background: "var(--skel)",
                width: w,
              },
            }),
          ),
        );
      }
      Object.assign(__ds_scope, { Skel });
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "components/data/Skel.jsx",
      error: String((e && e.message) || e),
    });
  }

  // components/data/FeatureCard.jsx
  try {
    (() => {
      /**
       * FeatureCard — marketing feature panel: title + body over a mock surface with a mono cap.
       * size: "lg" | "sm"
       */
      function FeatureCard({
        title,
        body,
        cap,
        size = "lg",
        className = "",
        style = {},
      }) {
        const lg = size === "lg";
        return /*#__PURE__*/ React.createElement(
          "div",
          {
            className: className,
            style: {
              display: "flex",
              flexDirection: "column",
              borderRadius: "var(--radius-card)",
              background: "var(--panel)",
              minHeight: lg ? 330 : 280,
              padding: lg ? "26px 26px 0" : "24px 24px 0",
              ...style,
            },
          },
          /*#__PURE__*/ React.createElement(
            "h3",
            {
              style: {
                margin: 0,
                fontFamily: "var(--font-sans)",
                fontWeight: 600,
                fontSize: lg ? 20 : 17,
                letterSpacing: "-0.02em",
                color: "var(--text)",
              },
            },
            title,
          ),
          /*#__PURE__*/ React.createElement(
            "p",
            {
              style: {
                margin: "8px 0 0",
                fontFamily: "var(--font-sans)",
                fontSize: lg ? 14.5 : 13.5,
                lineHeight: 1.45,
                color: "var(--body)",
                maxWidth: lg ? "42ch" : undefined,
              },
            },
            body,
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                marginTop: "auto",
                overflow: "hidden",
                borderRadius: "10px 10px 0 0",
                borderTop: "1px solid var(--line2)",
                borderLeft: "1px solid var(--line2)",
                borderRight: "1px solid var(--line2)",
                background: "var(--paper)",
                height: lg ? 150 : 120,
                padding: lg ? 16 : 14,
              },
            },
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  fontFamily: "var(--font-mono)",
                  fontSize: 9.5,
                  letterSpacing: "0.06em",
                  color: "var(--cap)",
                },
              },
              cap,
            ),
            /*#__PURE__*/ React.createElement(__ds_scope.Skel, {
              widths: lg ? ["100%", "78%", "88%", "64%"] : ["100%", "72%"],
            }),
          ),
        );
      }
      Object.assign(__ds_scope, { FeatureCard });
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "components/data/FeatureCard.jsx",
      error: String((e && e.message) || e),
    });
  }

  // components/data/StatTile.jsx
  try {
    (() => {
      /**
       * StatTile — the platform's KPI cell: big value, mono label, optional delta.
       * Severity reads from weight/label, never invented hue.
       */
      function StatTile({
        label,
        value,
        delta,
        caption,
        className = "",
        style = {},
      }) {
        return /*#__PURE__*/ React.createElement(
          "div",
          {
            className: className,
            style: {
              display: "flex",
              flexDirection: "column",
              gap: 6,
              padding: "18px 20px",
              background: "var(--paper)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius-card)",
              ...style,
            },
          },
          /*#__PURE__*/ React.createElement(
            "span",
            {
              style: {
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--dim)",
              },
            },
            label,
          ),
          /*#__PURE__*/ React.createElement(
            "span",
            {
              style: {
                fontFamily: "var(--font-sans)",
                fontWeight: 600,
                fontSize: 30,
                letterSpacing: "-0.03em",
                color: "var(--text)",
                lineHeight: 1,
              },
            },
            value,
          ),
          (delta || caption) &&
            /*#__PURE__*/ React.createElement(
              "span",
              {
                style: {
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "var(--body)",
                },
              },
              delta || caption,
            ),
        );
      }
      Object.assign(__ds_scope, { StatTile });
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "components/data/StatTile.jsx",
      error: String((e && e.message) || e),
    });
  }

  // components/forms/EmailCapture.jsx
  try {
    (() => {
      /** Email capture — joined input + lime submit button. The brand's signature lead-gen form. */
      function EmailCapture({
        placeholder = "What's your work email?",
        cta = "Book a demo",
        onSubmit,
        className = "",
        style = {},
      }) {
        return /*#__PURE__*/ React.createElement(
          "form",
          {
            className: className,
            onSubmit: (e) => {
              e.preventDefault();
              onSubmit && onSubmit(e);
            },
            style: {
              display: "flex",
              alignItems: "stretch",
              maxWidth: 430,
              overflow: "hidden",
              borderRadius: 9,
              border: "1px solid var(--line2)",
              background: "var(--paper)",
              ...style,
            },
          },
          /*#__PURE__*/ React.createElement("input", {
            type: "email",
            "aria-label": "Work email",
            placeholder: placeholder,
            style: {
              minWidth: 0,
              flex: 1,
              border: 0,
              background: "transparent",
              padding: "13px 18px",
              fontFamily: "var(--font-sans)",
              fontSize: 15,
              color: "var(--ink)",
              outline: "none",
            },
          }),
          /*#__PURE__*/ React.createElement(
            "button",
            {
              type: "submit",
              style: {
                display: "flex",
                alignItems: "center",
                whiteSpace: "nowrap",
                background: "var(--lime)",
                color: "var(--on-lime)",
                border: 0,
                padding: "13px 22px",
                fontFamily: "var(--font-sans)",
                fontSize: 14.5,
                fontWeight: 600,
                cursor: "pointer",
                transition: "background var(--motion-fast)",
              },
              onMouseEnter: (e) =>
                (e.currentTarget.style.background = "var(--lime-hover)"),
              onMouseLeave: (e) =>
                (e.currentTarget.style.background = "var(--lime)"),
            },
            cta,
          ),
        );
      }
      Object.assign(__ds_scope, { EmailCapture });
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "components/forms/EmailCapture.jsx",
      error: String((e && e.message) || e),
    });
  }

  // components/forms/Select.jsx
  try {
    (() => {
      function _extends() {
        return (
          (_extends = Object.assign
            ? Object.assign.bind()
            : function (n) {
                for (var e = 1; e < arguments.length; e++) {
                  var t = arguments[e];
                  for (var r in t)
                    ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]);
                }
                return n;
              }),
          _extends.apply(null, arguments)
        );
      }
      /** Select — minimal platform dropdown (visual). Hairline border, mono-ish chevron. */
      function Select({
        value,
        options = [],
        onChange,
        className = "",
        style = {},
        ...props
      }) {
        return /*#__PURE__*/ React.createElement(
          "div",
          {
            className: className,
            style: {
              position: "relative",
              display: "inline-block",
              ...style,
            },
          },
          /*#__PURE__*/ React.createElement(
            "select",
            _extends(
              {
                value: value,
                onChange: (e) => onChange && onChange(e.target.value),
                style: {
                  appearance: "none",
                  WebkitAppearance: "none",
                  fontFamily: "var(--font-sans)",
                  fontSize: 13.5,
                  color: "var(--text)",
                  background: "var(--paper)",
                  border: "1px solid var(--line2)",
                  borderRadius: "var(--radius-sm)",
                  padding: "8px 32px 8px 12px",
                  cursor: "pointer",
                  outline: "none",
                },
              },
              props,
            ),
            options.map((o) =>
              /*#__PURE__*/ React.createElement(
                "option",
                {
                  key: o,
                  value: o,
                },
                o,
              ),
            ),
          ),
          /*#__PURE__*/ React.createElement(
            "span",
            {
              "aria-hidden": "true",
              style: {
                position: "absolute",
                right: 11,
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: 10,
                color: "var(--dim)",
                pointerEvents: "none",
              },
            },
            "\u25BE",
          ),
        );
      }
      Object.assign(__ds_scope, { Select });
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "components/forms/Select.jsx",
      error: String((e && e.message) || e),
    });
  }

  // components/forms/Toggle.jsx
  try {
    (() => {
      /** Toggle — the platform's on/off switch. Lime track when on. */
      function Toggle({
        checked = false,
        onChange,
        label,
        className = "",
        style = {},
      }) {
        const [on, setOn] = React.useState(checked);
        React.useEffect(() => setOn(checked), [checked]);
        const toggle = () => {
          const v = !on;
          setOn(v);
          onChange && onChange(v);
        };
        return /*#__PURE__*/ React.createElement(
          "label",
          {
            className: className,
            style: {
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
              fontSize: 13.5,
              color: "var(--text)",
              ...style,
            },
          },
          /*#__PURE__*/ React.createElement(
            "span",
            {
              onClick: toggle,
              role: "switch",
              "aria-checked": on,
              style: {
                position: "relative",
                width: 34,
                height: 20,
                borderRadius: 999,
                background: on ? "var(--lime)" : "var(--line-strong)",
                border: on
                  ? "1px solid var(--lime-hover)"
                  : "1px solid var(--line2)",
                transition: "background var(--motion-fast)",
                flexShrink: 0,
              },
            },
            /*#__PURE__*/ React.createElement("span", {
              style: {
                position: "absolute",
                top: 1,
                left: on ? 15 : 1,
                width: 16,
                height: 16,
                borderRadius: 999,
                background: "#fff",
                boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
                transition: "left var(--motion-fast)",
              },
            }),
          ),
          label && /*#__PURE__*/ React.createElement("span", null, label),
        );
      }
      Object.assign(__ds_scope, { Toggle });
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "components/forms/Toggle.jsx",
      error: String((e && e.message) || e),
    });
  }

  // ui_kits/platform/dashboard.jsx
  try {
    (() => {
      /* Axona Platform UI kit — dashboard content + interactive app. Recreated from Design System.pdf §07.
   Severity is signalled by weight + label, never invented hue (green is the only status color). */
      const AXD = window.AxonaDesignSystem_4752cf;
      const PO_ROWS = [
        {
          id: "PO-10482",
          item: "SERVO-204 · Harmonic drive",
          vendor: "Vendor A",
          value: "$48,200",
          status: "Awaiting approval",
        },
        {
          id: "PO-10481",
          item: "LIDAR-88 module",
          vendor: "Vendor C",
          value: "$112,000",
          status: "Approved",
        },
        {
          id: "PO-10480",
          item: "Wiring harness, qty 220",
          vendor: "Vendor B",
          value: "$9,640",
          status: "Approved",
        },
        {
          id: "PO-10479",
          item: "Battery pack 48V",
          vendor: "Vendor D",
          value: "$76,500",
          status: "Sent",
        },
      ];
      function KpiRow() {
        const k = [
          ["ON-TIME BUILD RATE", "98.2%", "+3.1 pts"],
          ["OPEN SHORTAGES", "2", "↓ from 11"],
          ["POS AWAITING APPROVAL", "6", "drafted by agents"],
          ["UNITS IN BUILD", "48", "across 3 lines"],
        ];
        return /*#__PURE__*/ React.createElement(
          "div",
          {
            style: {
              display: "grid",
              gridTemplateColumns: "repeat(4,1fr)",
              gap: 12,
            },
          },
          k.map(([l, v, d]) =>
            /*#__PURE__*/ React.createElement(AXD.StatTile, {
              key: l,
              label: l,
              value: v,
              delta: d,
            }),
          ),
        );
      }
      function PoTable() {
        const [sel, setSel] = React.useState(["PO-10482", "PO-10480"]);
        const toggle = (id) =>
          setSel((s) =>
            s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
          );
        return /*#__PURE__*/ React.createElement(
          "div",
          {
            style: {
              border: "1px solid var(--line)",
              borderRadius: 14,
              overflow: "hidden",
              background: "var(--paper)",
            },
          },
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 16px",
                borderBottom: "1px solid var(--line)",
                minHeight: 30,
              },
            },
            sel.length > 0
              ? /*#__PURE__*/ React.createElement(
                  React.Fragment,
                  null,
                  /*#__PURE__*/ React.createElement(
                    "span",
                    {
                      style: {
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        color: "var(--ink)",
                        fontWeight: 600,
                      },
                    },
                    sel.length,
                    " SELECTED",
                  ),
                  /*#__PURE__*/ React.createElement(
                    AXD.Button,
                    {
                      size: "sm",
                    },
                    "Approve",
                  ),
                  /*#__PURE__*/ React.createElement(
                    AXD.Button,
                    {
                      size: "sm",
                      variant: "secondary",
                    },
                    "Assign vendor",
                  ),
                  /*#__PURE__*/ React.createElement(
                    AXD.Button,
                    {
                      size: "sm",
                      variant: "ghost",
                    },
                    "Export",
                  ),
                  /*#__PURE__*/ React.createElement(
                    "button",
                    {
                      onClick: () => setSel([]),
                      style: {
                        marginLeft: "auto",
                        border: "none",
                        background: "none",
                        cursor: "pointer",
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        color: "var(--dim)",
                      },
                    },
                    "Clear",
                  ),
                )
              : /*#__PURE__*/ React.createElement(
                  "span",
                  {
                    style: {
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: "var(--dim)",
                    },
                  },
                  "PURCHASE ORDERS",
                ),
          ),
          /*#__PURE__*/ React.createElement(
            "table",
            {
              style: {
                width: "100%",
                borderCollapse: "collapse",
                fontFamily: "var(--font-sans)",
              },
            },
            /*#__PURE__*/ React.createElement(
              "thead",
              null,
              /*#__PURE__*/ React.createElement(
                "tr",
                {
                  style: {
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    letterSpacing: "0.06em",
                    color: "var(--dim)",
                    textAlign: "left",
                  },
                },
                /*#__PURE__*/ React.createElement("th", {
                  style: {
                    padding: "10px 16px",
                    width: 36,
                  },
                }),
                /*#__PURE__*/ React.createElement(
                  "th",
                  {
                    style: {
                      padding: "10px 8px",
                    },
                  },
                  "PO",
                ),
                /*#__PURE__*/ React.createElement(
                  "th",
                  {
                    style: {
                      padding: "10px 8px",
                    },
                  },
                  "ITEM",
                ),
                /*#__PURE__*/ React.createElement(
                  "th",
                  {
                    style: {
                      padding: "10px 8px",
                    },
                  },
                  "VENDOR",
                ),
                /*#__PURE__*/ React.createElement(
                  "th",
                  {
                    style: {
                      padding: "10px 8px",
                      textAlign: "right",
                    },
                  },
                  "VALUE",
                ),
                /*#__PURE__*/ React.createElement(
                  "th",
                  {
                    style: {
                      padding: "10px 16px",
                    },
                  },
                  "STATUS",
                ),
              ),
            ),
            /*#__PURE__*/ React.createElement(
              "tbody",
              null,
              PO_ROWS.map((r) => {
                const on = sel.includes(r.id);
                return /*#__PURE__*/ React.createElement(
                  "tr",
                  {
                    key: r.id,
                    onClick: () => toggle(r.id),
                    style: {
                      borderTop: "1px solid var(--line)",
                      cursor: "pointer",
                      background: on ? "var(--panel)" : "transparent",
                    },
                  },
                  /*#__PURE__*/ React.createElement(
                    "td",
                    {
                      style: {
                        padding: "12px 16px",
                      },
                    },
                    /*#__PURE__*/ React.createElement(
                      "span",
                      {
                        style: {
                          width: 16,
                          height: 16,
                          borderRadius: 4,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          border: on
                            ? "none"
                            : "1.5px solid var(--line-strong)",
                          background: on ? "var(--ink)" : "transparent",
                          color: "#fff",
                          fontSize: 11,
                        },
                      },
                      on ? "✓" : "",
                    ),
                  ),
                  /*#__PURE__*/ React.createElement(
                    "td",
                    {
                      style: {
                        padding: "12px 8px",
                        fontFamily: "var(--font-mono)",
                        fontSize: 12.5,
                        color: "var(--ink)",
                      },
                    },
                    r.id,
                  ),
                  /*#__PURE__*/ React.createElement(
                    "td",
                    {
                      style: {
                        padding: "12px 8px",
                        fontSize: 13.5,
                        color: "var(--text)",
                      },
                    },
                    r.item,
                  ),
                  /*#__PURE__*/ React.createElement(
                    "td",
                    {
                      style: {
                        padding: "12px 8px",
                        fontSize: 13.5,
                        color: "var(--body)",
                      },
                    },
                    r.vendor,
                  ),
                  /*#__PURE__*/ React.createElement(
                    "td",
                    {
                      style: {
                        padding: "12px 8px",
                        fontFamily: "var(--font-mono)",
                        fontSize: 12.5,
                        color: "var(--ink)",
                        textAlign: "right",
                      },
                    },
                    r.value,
                  ),
                  /*#__PURE__*/ React.createElement(
                    "td",
                    {
                      style: {
                        padding: "12px 16px",
                      },
                    },
                    r.status === "Awaiting approval"
                      ? /*#__PURE__*/ React.createElement(
                          AXD.Badge,
                          {
                            tone: "neutral",
                          },
                          r.status,
                        )
                      : /*#__PURE__*/ React.createElement(
                          "span",
                          {
                            style: {
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              fontSize: 12.5,
                              color:
                                r.status === "Approved"
                                  ? "var(--ok)"
                                  : "var(--body)",
                            },
                          },
                          r.status === "Approved" &&
                            /*#__PURE__*/ React.createElement("span", {
                              style: {
                                width: 6,
                                height: 6,
                                borderRadius: 999,
                                background: "var(--ok)",
                              },
                            }),
                          r.status,
                        ),
                  ),
                );
              }),
            ),
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px",
                borderTop: "1px solid var(--line)",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--dim)",
              },
            },
            /*#__PURE__*/ React.createElement("span", null, "1\u20134 of 128"),
            /*#__PURE__*/ React.createElement(
              "span",
              {
                style: {
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                },
              },
              /*#__PURE__*/ React.createElement(
                "span",
                {
                  style: {
                    cursor: "pointer",
                  },
                },
                "\u2039",
              ),
              /*#__PURE__*/ React.createElement(
                "span",
                {
                  style: {
                    color: "var(--ink)",
                  },
                },
                "1",
              ),
              /*#__PURE__*/ React.createElement("span", null, "2"),
              /*#__PURE__*/ React.createElement("span", null, "3"),
              /*#__PURE__*/ React.createElement(
                "span",
                {
                  style: {
                    cursor: "pointer",
                  },
                },
                "\u203A",
              ),
            ),
          ),
        );
      }
      function UnitSpec() {
        const rows = [
          ["Model", "HX-2 Humanoid"],
          ["Line", "Site-3 · L2"],
          ["Started", "2026-06-18"],
          ["Parts traced", "142"],
        ];
        return /*#__PURE__*/ React.createElement(
          "div",
          {
            style: {
              border: "1px solid var(--line)",
              borderRadius: 14,
              background: "var(--paper)",
              padding: 20,
            },
          },
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                fontSize: 14.5,
                fontWeight: 600,
                color: "var(--ink)",
                marginBottom: 14,
              },
            },
            "Unit spec \xB7 ",
            /*#__PURE__*/ React.createElement(
              "span",
              {
                style: {
                  fontFamily: "var(--font-mono)",
                },
              },
              "SN-2208",
            ),
          ),
          rows.map(([k, v]) =>
            /*#__PURE__*/ React.createElement(
              "div",
              {
                key: k,
                style: {
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "9px 0",
                  borderTop: "1px solid var(--line)",
                  fontSize: 13,
                },
              },
              /*#__PURE__*/ React.createElement(
                "span",
                {
                  style: {
                    color: "var(--body)",
                  },
                },
                k,
              ),
              /*#__PURE__*/ React.createElement(
                "span",
                {
                  style: {
                    color: "var(--ink)",
                    fontWeight: 500,
                  },
                },
                v,
              ),
            ),
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                marginTop: 16,
              },
            },
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  color: "var(--body)",
                  marginBottom: 6,
                },
              },
              /*#__PURE__*/ React.createElement("span", null, "Build progress"),
              /*#__PURE__*/ React.createElement(
                "span",
                {
                  style: {
                    fontFamily: "var(--font-mono)",
                    color: "var(--ink)",
                  },
                },
                "84% \xB7 6 of 8 stages",
              ),
            ),
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  height: 8,
                  borderRadius: 999,
                  background: "var(--panel)",
                  overflow: "hidden",
                },
              },
              /*#__PURE__*/ React.createElement("div", {
                style: {
                  width: "84%",
                  height: "100%",
                  background: "var(--lime)",
                },
              }),
            ),
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  marginTop: 12,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                },
              },
              /*#__PURE__*/ React.createElement(
                AXD.MonoChip,
                null,
                "harmonic-drive",
              ),
              /*#__PURE__*/ React.createElement(
                AXD.MonoChip,
                null,
                "lot-88421",
              ),
              /*#__PURE__*/ React.createElement(AXD.MonoChip, null, "site-3"),
            ),
          ),
        );
      }
      function AgentRec({ approved, onApprove }) {
        return /*#__PURE__*/ React.createElement(
          "div",
          {
            style: {
              border: "1px solid var(--line)",
              borderRadius: 14,
              background: "var(--panel)",
              padding: 20,
            },
          },
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 12,
              },
            },
            /*#__PURE__*/ React.createElement(window.AXIcon, {
              name: "sparkles",
              size: 15,
              color: "var(--ink)",
            }),
            /*#__PURE__*/ React.createElement(
              "span",
              {
                style: {
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  letterSpacing: "0.06em",
                  color: "var(--ink)",
                  fontWeight: 600,
                },
              },
              "AGENT RECOMMENDATION",
            ),
          ),
          /*#__PURE__*/ React.createElement(
            "p",
            {
              style: {
                margin: 0,
                fontSize: 13.5,
                lineHeight: 1.5,
                color: "var(--text)",
              },
            },
            /*#__PURE__*/ React.createElement("b", null, "SERVO-204"),
            " is below reorder point and covers only the next 2 builds. Drafted ",
            /*#__PURE__*/ React.createElement(
              "span",
              {
                style: {
                  fontFamily: "var(--font-mono)",
                },
              },
              "PO-10482",
            ),
            " to Vendor A \xB7 ETA 4 days \xB7 ",
            /*#__PURE__*/ React.createElement("b", null, "$48,200"),
            ".",
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                marginTop: 16,
                display: "flex",
                gap: 10,
                alignItems: "center",
              },
            },
            approved
              ? /*#__PURE__*/ React.createElement(
                  AXD.Badge,
                  {
                    tone: "ok",
                  },
                  "\u2713 Approved \xB7 sent to Vendor A",
                )
              : /*#__PURE__*/ React.createElement(
                  React.Fragment,
                  null,
                  /*#__PURE__*/ React.createElement(
                    AXD.Button,
                    {
                      size: "sm",
                      onClick: onApprove,
                    },
                    "Approve PO",
                  ),
                  /*#__PURE__*/ React.createElement(
                    AXD.Button,
                    {
                      size: "sm",
                      variant: "secondary",
                    },
                    "Edit",
                  ),
                ),
          ),
        );
      }
      function AgentTrace() {
        const lines = [
          ["12:04:02", "scan BOM demand · SN-2208…SN-2256"],
          ["12:04:03", "SERVO-204 on-hand 6 · reorder pt 8 → shortfall"],
          ["12:04:03", "rfq Vendor A,B · best ETA 4d @ $48,200"],
          ["12:04:04", "draft PO-10482 → awaiting approval"],
        ];
        return /*#__PURE__*/ React.createElement(
          "div",
          {
            style: {
              border: "1px solid var(--line)",
              borderRadius: 14,
              background: "var(--ink)",
              padding: "16px 18px",
              color: "#fff",
            },
          },
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                fontFamily: "var(--font-mono)",
                fontSize: 10.5,
                letterSpacing: "0.06em",
                color: "rgba(255,255,255,0.5)",
                marginBottom: 12,
              },
            },
            "AGENT TRACE \xB7 proc-agent-04",
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                display: "flex",
                flexDirection: "column",
                gap: 7,
                fontFamily: "var(--font-mono)",
                fontSize: 12,
              },
            },
            lines.map(([t, m], i) =>
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  key: i,
                  style: {
                    display: "flex",
                    gap: 12,
                  },
                },
                /*#__PURE__*/ React.createElement(
                  "span",
                  {
                    style: {
                      color: "rgba(255,255,255,0.4)",
                    },
                  },
                  t,
                ),
                /*#__PURE__*/ React.createElement(
                  "span",
                  {
                    style: {
                      color: "rgba(255,255,255,0.9)",
                    },
                  },
                  m,
                ),
              ),
            ),
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  display: "flex",
                  gap: 12,
                },
              },
              /*#__PURE__*/ React.createElement(
                "span",
                {
                  style: {
                    color: "rgba(255,255,255,0.4)",
                  },
                },
                "12:04:04",
              ),
              /*#__PURE__*/ React.createElement(
                "span",
                {
                  style: {
                    color: "var(--lime)",
                  },
                },
                "\u258D",
              ),
            ),
          ),
        );
      }
      function Incidents() {
        const items = [
          [
            "Payload test failure · SN-2208",
            "LINE 2 HALTED · 6 MIN AGO",
            "Critical",
          ],
          [
            "Cost variance +9% · Vendor D",
            "ESCALATED BY AGENT · 1H AGO",
            "Attention",
          ],
          ["SERVO-204 shortage resolved", "AUTO-REORDERED · 3H AGO", "Nominal"],
        ];
        return /*#__PURE__*/ React.createElement(
          "div",
          {
            style: {
              border: "1px solid var(--line)",
              borderRadius: 14,
              background: "var(--paper)",
              padding: 20,
            },
          },
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                fontSize: 14.5,
                fontWeight: 600,
                color: "var(--ink)",
                marginBottom: 14,
              },
            },
            "Incidents",
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                display: "flex",
                flexDirection: "column",
              },
            },
            items.map(([t, meta, lvl], i) =>
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  key: i,
                  style: {
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 11,
                    padding: "12px 0",
                    borderTop: i ? "1px solid var(--line)" : "none",
                  },
                },
                /*#__PURE__*/ React.createElement(
                  "span",
                  {
                    style: {
                      marginTop: 4,
                    },
                  },
                  /*#__PURE__*/ React.createElement(window.StatusDot, {
                    level: lvl,
                  }),
                ),
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      flex: 1,
                    },
                  },
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      style: {
                        fontSize: 13.5,
                        color: "var(--ink)",
                        fontWeight: lvl === "Critical" ? 600 : 500,
                      },
                    },
                    t,
                  ),
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      style: {
                        fontFamily: "var(--font-mono)",
                        fontSize: 10,
                        letterSpacing: "0.04em",
                        color: "var(--dim)",
                        marginTop: 3,
                      },
                    },
                    meta,
                  ),
                ),
                /*#__PURE__*/ React.createElement(
                  "span",
                  {
                    style: {
                      fontFamily: "var(--font-mono)",
                      fontSize: 10.5,
                      color: lvl === "Critical" ? "var(--ink)" : "var(--body)",
                      fontWeight: lvl === "Critical" ? 700 : 500,
                    },
                  },
                  lvl,
                ),
              ),
            ),
          ),
        );
      }
      function Toasts() {
        const t = [
          ["2 receipts pending reconciliation on Site-3.", "Review"],
          [
            "SERVO-204 covers only 2 more builds — agent recommends reorder.",
            "Resolve",
          ],
        ];
        return /*#__PURE__*/ React.createElement(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              gap: 10,
            },
          },
          t.map(([msg, action], i) =>
            /*#__PURE__*/ React.createElement(
              "div",
              {
                key: i,
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  border: "1px solid var(--line2)",
                  borderRadius: 10,
                  background: "var(--paper)",
                  padding: "12px 16px",
                  boxShadow: "var(--shadow-float)",
                },
              },
              /*#__PURE__*/ React.createElement(window.StatusDot, {
                level: i ? "Attention" : "Nominal",
              }),
              /*#__PURE__*/ React.createElement(
                "span",
                {
                  style: {
                    flex: 1,
                    fontSize: 13,
                    color: "var(--text)",
                  },
                },
                msg,
              ),
              /*#__PURE__*/ React.createElement(
                "button",
                {
                  style: {
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--ink)",
                  },
                },
                action,
              ),
            ),
          ),
        );
      }
      function App() {
        const [nav, setNav] = React.useState("Procurement");
        const [tab, setTab] = React.useState("Genealogy");
        const [range, setRange] = React.useState("24h");
        const [approved, setApproved] = React.useState(false);
        return /*#__PURE__*/ React.createElement(
          "div",
          {
            style: {
              display: "flex",
              height: "100vh",
              overflow: "hidden",
              background: "var(--panel)",
            },
          },
          /*#__PURE__*/ React.createElement(window.Sidebar, {
            active: nav,
            onNav: setNav,
          }),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                flex: 1,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
              },
            },
            /*#__PURE__*/ React.createElement(window.TopBar, {
              tab: tab,
              onTab: setTab,
              range: range,
              onRange: setRange,
            }),
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  flex: 1,
                  overflow: "auto",
                  padding: 24,
                },
              },
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "space-between",
                    marginBottom: 20,
                  },
                },
                /*#__PURE__*/ React.createElement(
                  "div",
                  null,
                  /*#__PURE__*/ React.createElement(
                    "h1",
                    {
                      style: {
                        margin: 0,
                        fontSize: 24,
                        fontWeight: 600,
                        letterSpacing: "-0.02em",
                        color: "var(--ink)",
                      },
                    },
                    nav,
                  ),
                  /*#__PURE__*/ React.createElement(
                    "p",
                    {
                      style: {
                        margin: "4px 0 0",
                        fontSize: 14,
                        color: "var(--body)",
                      },
                    },
                    "Humans, machines, and agents on the same screen.",
                  ),
                ),
                /*#__PURE__*/ React.createElement(
                  AXD.Button,
                  null,
                  "Draft purchase order",
                ),
              ),
              /*#__PURE__*/ React.createElement(KpiRow, null),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    marginTop: 16,
                  },
                },
                /*#__PURE__*/ React.createElement(Toasts, null),
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    display: "grid",
                    gridTemplateColumns: "1.7fr 1fr",
                    gap: 16,
                    marginTop: 16,
                    alignItems: "start",
                  },
                },
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      display: "flex",
                      flexDirection: "column",
                      gap: 16,
                    },
                  },
                  /*#__PURE__*/ React.createElement(PoTable, null),
                  /*#__PURE__*/ React.createElement(AgentRec, {
                    approved: approved,
                    onApprove: () => setApproved(true),
                  }),
                  /*#__PURE__*/ React.createElement(AgentTrace, null),
                ),
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      display: "flex",
                      flexDirection: "column",
                      gap: 16,
                    },
                  },
                  /*#__PURE__*/ React.createElement(UnitSpec, null),
                  /*#__PURE__*/ React.createElement(Incidents, null),
                ),
              ),
            ),
          ),
        );
      }
      Object.assign(window, {
        PlatformApp: App,
      });
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "ui_kits/platform/dashboard.jsx",
      error: String((e && e.message) || e),
    });
  }

  // ui_kits/platform/shell.jsx
  try {
    (() => {
      /* Axona Platform UI kit — app shell (sidebar + topbar). Recreated from Design System.pdf §07
   "In-app components". Icons: Lucide (CDN) — the product ships no proprietary icon set; Lucide's
   clean technical line style matches the platform. Mounts DS primitives from the global namespace. */
      const AXP = window.AxonaDesignSystem_4752cf;
      function Icon({ name, size = 18, color = "currentColor", style = {} }) {
        const ref = React.useRef(null);
        React.useEffect(() => {
          if (ref.current && window.lucide) {
            ref.current.innerHTML = "";
            const el = document.createElement("i");
            el.setAttribute("data-lucide", name);
            ref.current.appendChild(el);
            window.lucide.createIcons({
              attrs: {
                width: size,
                height: size,
                stroke: color,
                "stroke-width": 1.8,
              },
            });
          }
        });
        return /*#__PURE__*/ React.createElement("span", {
          ref: ref,
          style: {
            display: "inline-flex",
            ...style,
          },
        });
      }
      function Sidebar({ active, onNav }) {
        const items = [
          ["Overview", "layout-grid"],
          ["Fleet", "cpu"],
          ["Procurement", "shopping-cart", "6"],
          ["Incidents", "triangle-alert"],
          ["Settings", "settings"],
        ];
        return /*#__PURE__*/ React.createElement(
          "aside",
          {
            style: {
              width: 220,
              flexShrink: 0,
              borderRight: "1px solid var(--line)",
              background: "var(--paper)",
              display: "flex",
              flexDirection: "column",
              height: "100%",
            },
          },
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                padding: "18px 20px",
                borderBottom: "1px solid var(--line)",
              },
            },
            /*#__PURE__*/ React.createElement(AXP.Wordmark, {
              size: 21,
            }),
          ),
          /*#__PURE__*/ React.createElement(
            "nav",
            {
              style: {
                padding: 12,
                display: "flex",
                flexDirection: "column",
                gap: 2,
              },
            },
            items.map(([label, icon, badge]) => {
              const on = label === active;
              return /*#__PURE__*/ React.createElement(
                "button",
                {
                  key: label,
                  onClick: () => onNav(label),
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: 11,
                    width: "100%",
                    textAlign: "left",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "var(--font-sans)",
                    fontSize: 14,
                    fontWeight: on ? 600 : 500,
                    background: on ? "var(--panel)" : "transparent",
                    color: on ? "var(--ink)" : "var(--body)",
                  },
                },
                /*#__PURE__*/ React.createElement(Icon, {
                  name: icon,
                  size: 17,
                  color: on ? "var(--ink)" : "var(--dim)",
                }),
                /*#__PURE__*/ React.createElement(
                  "span",
                  {
                    style: {
                      flex: 1,
                    },
                  },
                  label,
                ),
                badge &&
                  /*#__PURE__*/ React.createElement(
                    "span",
                    {
                      style: {
                        fontFamily: "var(--font-mono)",
                        fontSize: 10.5,
                        fontWeight: 600,
                        background: "var(--lime)",
                        color: "var(--on-lime)",
                        borderRadius: 999,
                        padding: "1px 7px",
                      },
                    },
                    badge,
                  ),
              );
            }),
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                marginTop: "auto",
                padding: 16,
                borderTop: "1px solid var(--line)",
              },
            },
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                },
              },
              /*#__PURE__*/ React.createElement(
                "span",
                {
                  style: {
                    width: 28,
                    height: 28,
                    borderRadius: 999,
                    background: "var(--ink)",
                    color: "#fff",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 600,
                  },
                },
                "LC",
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    lineHeight: 1.2,
                  },
                },
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--ink)",
                    },
                  },
                  "Lauren C.",
                ),
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      color: "var(--dim)",
                    },
                  },
                  "OPS \xB7 SITE-3",
                ),
              ),
            ),
          ),
        );
      }
      function TopBar({ tab, onTab, range, onRange }) {
        const tabs = [
          ["Genealogy", "142"],
          ["Telemetry", null],
          ["Tests", "3"],
          ["Audit log", null],
        ];
        return /*#__PURE__*/ React.createElement(
          "div",
          {
            style: {
              borderBottom: "1px solid var(--line)",
              background: "var(--paper)",
            },
          },
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "12px 24px",
              },
            },
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  position: "relative",
                  flex: 1,
                  maxWidth: 460,
                },
              },
              /*#__PURE__*/ React.createElement(
                "span",
                {
                  style: {
                    position: "absolute",
                    left: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                  },
                },
                /*#__PURE__*/ React.createElement(Icon, {
                  name: "search",
                  size: 15,
                  color: "var(--dim)",
                }),
              ),
              /*#__PURE__*/ React.createElement("input", {
                placeholder: "Search units, parts, vendors, agents\u2026",
                style: {
                  width: "100%",
                  boxSizing: "border-box",
                  border: "1px solid var(--line2)",
                  borderRadius: 8,
                  background: "var(--panel)",
                  padding: "9px 12px 9px 34px",
                  fontFamily: "var(--font-sans)",
                  fontSize: 13.5,
                  color: "var(--ink)",
                  outline: "none",
                },
              }),
              /*#__PURE__*/ React.createElement(
                "span",
                {
                  style: {
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: "var(--dim)",
                  },
                },
                "\u2318K",
              ),
            ),
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  marginLeft: "auto",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                },
              },
              /*#__PURE__*/ React.createElement(Icon, {
                name: "bell",
                size: 17,
                color: "var(--body)",
              }),
              /*#__PURE__*/ React.createElement(Icon, {
                name: "circle-help",
                size: 17,
                color: "var(--body)",
              }),
            ),
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "0 24px 0",
                height: 46,
                borderTop: "1px solid var(--line)",
              },
            },
            /*#__PURE__*/ React.createElement(
              "span",
              {
                style: {
                  fontFamily: "var(--font-mono)",
                  fontSize: 11.5,
                  letterSpacing: "0.04em",
                  color: "var(--body)",
                },
              },
              "Fleet \xB7 Site-3 \xB7 SN-2208",
            ),
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  marginLeft: 8,
                },
              },
              tabs.map(([t, n]) => {
                const on = t === tab;
                return /*#__PURE__*/ React.createElement(
                  "button",
                  {
                    key: t,
                    onClick: () => onTab(t),
                    style: {
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      padding: "6px 4px",
                      marginRight: 10,
                      fontFamily: "var(--font-sans)",
                      fontSize: 13.5,
                      fontWeight: on ? 600 : 500,
                      color: on ? "var(--ink)" : "var(--dim)",
                      borderBottom: on
                        ? "2px solid var(--ink)"
                        : "2px solid transparent",
                      height: 45,
                    },
                  },
                  t,
                  n &&
                    /*#__PURE__*/ React.createElement(
                      "span",
                      {
                        style: {
                          fontFamily: "var(--font-mono)",
                          fontSize: 10.5,
                          color: "var(--dim)",
                        },
                      },
                      n,
                    ),
                );
              }),
            ),
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  marginLeft: "auto",
                  display: "flex",
                  gap: 4,
                },
              },
              ["24h", "30d"].map((r) =>
                /*#__PURE__*/ React.createElement(
                  "button",
                  {
                    key: r,
                    onClick: () => onRange(r),
                    style: {
                      border: "1px solid var(--line2)",
                      background: r === range ? "var(--ink)" : "var(--paper)",
                      color: r === range ? "#fff" : "var(--body)",
                      borderRadius: 6,
                      padding: "4px 12px",
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      cursor: "pointer",
                    },
                  },
                  r,
                ),
              ),
            ),
          ),
        );
      }
      function StatusDot({ level }) {
        const map = {
          Nominal: "var(--ok)",
          Attention: "var(--body)",
          Critical: "var(--ink)",
          Idle: "var(--logo)",
        };
        return /*#__PURE__*/ React.createElement("span", {
          style: {
            width: 8,
            height: 8,
            borderRadius: 999,
            background: map[level],
            flexShrink: 0,
            boxShadow:
              level === "Critical" ? "0 0 0 3px rgba(10,10,10,0.08)" : "none",
          },
        });
      }
      Object.assign(window, {
        AXIcon: Icon,
        Sidebar,
        TopBar,
        StatusDot,
      });
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "ui_kits/platform/shell.jsx",
      error: String((e && e.message) || e),
    });
  }

  // ui_kits/website/chrome.jsx
  try {
    (() => {
      /* Axona website UI kit — chrome + hero. Mounts design-system primitives from the global namespace.
   Recreated from the Axona-Commercial-Website codebase (components/v2/*). */
      const AX = window.AxonaDesignSystem_4752cf;
      function AnnounceBar() {
        return /*#__PURE__*/ React.createElement(
          "div",
          {
            style: {
              display: "flex",
              minHeight: 36,
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              background: "var(--ink)",
              padding: "7px 40px",
              textAlign: "center",
              fontSize: 13,
              color: "#fff",
            },
          },
          /*#__PURE__*/ React.createElement(
            "span",
            null,
            "Introducing Agents by Axona \u2014 the AI operating system for robotics ops.",
          ),
          /*#__PURE__*/ React.createElement(
            "a",
            {
              href: "#",
              style: {
                color: "#fff",
                textUnderlineOffset: 2,
              },
            },
            "Learn more",
          ),
        );
      }
      function SiteNav() {
        const items = [
          ["Platform", true],
          ["Modules", true],
          ["Solutions", true],
          ["Customers", false],
          ["Pricing", false],
        ];
        return /*#__PURE__*/ React.createElement(
          "header",
          {
            style: {
              position: "sticky",
              top: 0,
              zIndex: 50,
              borderBottom: "1px solid var(--line)",
              background: "rgba(255,255,255,0.9)",
              backdropFilter: "blur(12px)",
            },
          },
          /*#__PURE__*/ React.createElement(
            "nav",
            {
              style: {
                margin: "0 auto",
                display: "flex",
                height: 62,
                maxWidth: 1180,
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 28px",
              },
            },
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: 40,
                },
              },
              /*#__PURE__*/ React.createElement(AX.Wordmark, null),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: 24,
                    fontSize: 14.5,
                    color: "var(--ink)",
                  },
                },
                items.map(([l, caret]) =>
                  /*#__PURE__*/ React.createElement(
                    "a",
                    {
                      key: l,
                      href: "#",
                      style: {
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        color: "var(--ink)",
                        textDecoration: "none",
                      },
                    },
                    l,
                    caret &&
                      /*#__PURE__*/ React.createElement(
                        "span",
                        {
                          style: {
                            fontSize: 9,
                            color: "var(--dim)",
                          },
                        },
                        "\u25BE",
                      ),
                  ),
                ),
              ),
            ),
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  display: "flex",
                  alignItems: "center",
                  gap: 18,
                },
              },
              /*#__PURE__*/ React.createElement(
                "a",
                {
                  href: "#",
                  style: {
                    fontSize: 14.5,
                    color: "var(--ink)",
                    textDecoration: "none",
                  },
                },
                "Sign in",
              ),
              /*#__PURE__*/ React.createElement(
                AX.Button,
                {
                  href: "#demo",
                },
                "See a demo",
              ),
            ),
          ),
        );
      }
      function Hero() {
        const stats = [
          ["BOMS SYNCED", "175.5K"],
          ["AGENT ACTIONS", "514"],
          ["POS DRAFTED", "13,422"],
          ["SHORTAGES CAUGHT", "2,288"],
          ["UNITS TRACED", "3,280"],
        ];
        return /*#__PURE__*/ React.createElement(
          "section",
          {
            style: {
              margin: "0 auto",
              maxWidth: 1180,
              padding: "64px 28px 0",
            },
          },
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                marginBottom: 26,
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: 10,
              },
            },
            /*#__PURE__*/ React.createElement(
              "span",
              {
                style: {
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  letterSpacing: "0.06em",
                  color: "var(--faint)",
                },
              },
              "PARTS UNDER MANAGEMENT BY AXONA:",
            ),
            /*#__PURE__*/ React.createElement(
              AX.MonoChip,
              null,
              "7,491,284 parts",
            ),
          ),
          /*#__PURE__*/ React.createElement(
            "h1",
            {
              style: {
                margin: 0,
                maxWidth: "13ch",
                fontWeight: 600,
                fontSize: "clamp(48px,8.2vw,108px)",
                lineHeight: 0.92,
                letterSpacing: "-0.045em",
                color: "var(--ink)",
              },
            },
            "Build robots. Not spreadsheets.",
          ),
          /*#__PURE__*/ React.createElement(
            "p",
            {
              style: {
                marginTop: 22,
                maxWidth: "52ch",
                fontSize: "clamp(17px,1.8vw,21px)",
                color: "var(--body)",
                lineHeight: 1.5,
              },
            },
            "Procurement, production, supply chain, and field service \u2014 humans, machines, and agents on one AI-native operating system for robotics companies.",
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                marginTop: 34,
              },
            },
            /*#__PURE__*/ React.createElement(AX.EmailCapture, null),
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              className: "ax-dotgrid",
              style: {
                position: "relative",
                marginTop: 48,
                display: "flex",
                minHeight: 540,
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                borderRadius: 14,
                background: "var(--panel)",
              },
            },
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  position: "relative",
                  height: 340,
                  width: "min(560px,80%)",
                },
              },
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    position: "absolute",
                    left: 0,
                    top: 48,
                    width: 230,
                    borderRadius: 10,
                    border: "1px solid var(--line2)",
                    background: "var(--paper)",
                    padding: 16,
                    boxShadow: "var(--shadow-float)",
                  },
                },
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      fontFamily: "var(--font-mono)",
                      fontSize: 9.5,
                      letterSpacing: "0.08em",
                      color: "var(--cap)",
                    },
                  },
                  "BOM \xB7 WORK ORDER",
                ),
                /*#__PURE__*/ React.createElement(AX.Skel, {
                  widths: ["100%", "70%", "84%"],
                }),
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    position: "absolute",
                    bottom: 0,
                    right: 0,
                    width: 250,
                    borderRadius: 10,
                    border: "1px solid var(--line2)",
                    background: "var(--paper)",
                    padding: 16,
                    boxShadow: "var(--shadow-float)",
                  },
                },
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--ok)",
                    },
                  },
                  /*#__PURE__*/ React.createElement("span", {
                    style: {
                      width: 7,
                      height: 7,
                      borderRadius: 999,
                      background: "var(--ok)",
                    },
                  }),
                  "ROUTED FOR APPROVAL",
                ),
                /*#__PURE__*/ React.createElement(AX.Skel, {
                  widths: ["100%", "60%"],
                }),
              ),
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  style: {
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    display: "flex",
                    height: 138,
                    width: 212,
                    transform: "translate(-50%,-50%) rotate(-8deg)",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    borderRadius: 13,
                    padding: 18,
                    color: "#fff",
                    boxShadow: "var(--shadow-hero)",
                    backgroundImage: "linear-gradient(135deg,#1a1a1a,#000)",
                  },
                },
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    },
                  },
                  /*#__PURE__*/ React.createElement(
                    "span",
                    {
                      style: {
                        fontFamily: "var(--font-mono)",
                        fontSize: 10,
                        letterSpacing: "0.06em",
                        color: "rgba(255,255,255,0.55)",
                      },
                    },
                    "UNIT \xB7 SN-2208",
                  ),
                  /*#__PURE__*/ React.createElement(
                    "span",
                    {
                      style: {
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        fontSize: 10,
                        fontWeight: 600,
                        color: "var(--lime)",
                      },
                    },
                    /*#__PURE__*/ React.createElement("span", {
                      style: {
                        width: 6,
                        height: 6,
                        borderRadius: 999,
                        background: "var(--lime)",
                      },
                    }),
                    "IN BUILD",
                  ),
                ),
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      display: "flex",
                      alignItems: "flex-end",
                      gap: 5,
                    },
                  },
                  [14, 22, 30].map((h, i) =>
                    /*#__PURE__*/ React.createElement("span", {
                      key: i,
                      style: {
                        width: 7,
                        borderRadius: 2,
                        background: "var(--lime)",
                        height: h,
                      },
                    }),
                  ),
                  [24, 16].map((h, i) =>
                    /*#__PURE__*/ React.createElement("span", {
                      key: i,
                      style: {
                        width: 7,
                        borderRadius: 2,
                        background: "rgba(255,255,255,0.25)",
                        height: h,
                      },
                    }),
                  ),
                  /*#__PURE__*/ React.createElement(
                    "span",
                    {
                      style: {
                        marginLeft: "auto",
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        fontWeight: 600,
                      },
                    },
                    "84%",
                  ),
                ),
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      fontSize: 12,
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.85)",
                    },
                  },
                  "Build genealogy \xB7 142 parts traced",
                ),
              ),
            ),
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                marginTop: 28,
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: "12px 0",
                borderTop: "1px solid var(--line)",
                borderBottom: "1px solid var(--line)",
                padding: "14px 0",
              },
            },
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  marginRight: 22,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  borderRight: "1px solid var(--line)",
                  paddingRight: 22,
                },
              },
              /*#__PURE__*/ React.createElement(
                "span",
                {
                  style: {
                    display: "grid",
                    gridTemplateColumns: "repeat(3,1fr)",
                    gap: 2,
                  },
                },
                [1, 1, 0, 1, 0, 1].map((on, i) =>
                  /*#__PURE__*/ React.createElement("span", {
                    key: i,
                    style: {
                      width: 3,
                      height: 3,
                      background: on ? "var(--ink)" : "var(--line2)",
                    },
                  }),
                ),
              ),
              /*#__PURE__*/ React.createElement(
                "span",
                {
                  style: {
                    fontFamily: "var(--font-mono)",
                    fontSize: 10.5,
                    letterSpacing: "0.06em",
                    color: "var(--body)",
                  },
                },
                "AGENTS AT WORK TODAY",
              ),
            ),
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  display: "flex",
                  flex: 1,
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: "8px 26px",
                },
              },
              stats.map(([l, v]) =>
                /*#__PURE__*/ React.createElement(AX.StatChip, {
                  key: l,
                  label: l,
                  value: v,
                }),
              ),
            ),
          ),
        );
      }
      Object.assign(window, {
        AnnounceBar,
        SiteNav,
        Hero,
      });
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "ui_kits/website/chrome.jsx",
      error: String((e && e.message) || e),
    });
  }

  // ui_kits/website/sections.jsx
  try {
    (() => {
      /* Axona website UI kit — body sections: platform, architecture, verticals, closing, footer. */
      const AXS = window.AxonaDesignSystem_4752cf;
      function Platform() {
        const [active, setActive] = React.useState("Procurement");
        const tabs = [
          "Procurement",
          "Manufacturing",
          "Quality & Test",
          "Logistics",
          "Field Service",
          "R&D",
          "IT & Security",
        ];
        return /*#__PURE__*/ React.createElement(
          "section",
          {
            style: {
              margin: "0 auto",
              maxWidth: 1180,
              padding: "72px 28px 30px",
            },
          },
          /*#__PURE__*/ React.createElement(
            "h2",
            {
              style: {
                margin: 0,
                maxWidth: "18ch",
                fontWeight: 600,
                fontSize: "clamp(30px,4vw,52px)",
                lineHeight: 1.02,
                letterSpacing: "-0.035em",
                color: "var(--ink)",
              },
            },
            "One operating system. Every function on the floor.",
          ),
          /*#__PURE__*/ React.createElement(
            "p",
            {
              style: {
                margin: "6px 0 0",
                fontSize: "clamp(18px,2vw,24px)",
                fontWeight: 500,
                color: "var(--dim)",
              },
            },
            "Domains that share one spine \u2014 and infinite agents that work 24/7.",
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                marginTop: 28,
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
              },
            },
            tabs.map((t) =>
              /*#__PURE__*/ React.createElement(
                AXS.Pill,
                {
                  key: t,
                  active: t === active,
                  onClick: () => setActive(t),
                },
                t,
              ),
            ),
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                marginTop: 24,
                display: "grid",
                gap: 16,
                gridTemplateColumns: "1fr 1fr",
              },
            },
            /*#__PURE__*/ React.createElement(AXS.FeatureCard, {
              title: "Procurement",
              cap: "PO-10482 \xB7 DRAFT",
              body: "The wedge. Agents source long-lead components, run RFQs, and draft purchase orders from live BOM demand \u2014 your buyers approve in one click.",
            }),
            /*#__PURE__*/ React.createElement(AXS.FeatureCard, {
              title: "Manufacturing",
              cap: "WORK ORDER \xB7 UNIT #2208",
              body: "Plan builds, route work orders, and keep per-unit build genealogy from the first PCB to the packaged robot.",
            }),
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                marginTop: 16,
                display: "grid",
                gap: 16,
                gridTemplateColumns: "repeat(3,1fr)",
              },
            },
            /*#__PURE__*/ React.createElement(AXS.FeatureCard, {
              size: "sm",
              title: "Quality & Test",
              cap: "QA \xB7 SERIAL TRACE",
              body: "Capture test results against every serial. Catch the defect pattern before it ships.",
            }),
            /*#__PURE__*/ React.createElement(AXS.FeatureCard, {
              size: "sm",
              title: "Logistics",
              cap: "INBOUND \xB7 SITE-3",
              body: "Multi-site stock, transfers, and inbound tracking on one connected graph.",
            }),
            /*#__PURE__*/ React.createElement(AXS.FeatureCard, {
              size: "sm",
              title: "Field Service",
              cap: "FLEET \xB7 UPTIME",
              body: "Warranty, parts, firmware, and uptime for every robot in the field.",
            }),
          ),
        );
      }
      function Architecture() {
        const layers = [
          [
            "L4 · VERTICAL EDITIONS",
            "Vertical Editions",
            "A version of Axona pre-configured for your industry — the workflows, terminology, and screens a humanoid, defense, or space team needs on day one.",
            false,
          ],
          [
            "L3 · DOMAIN APPS",
            "Domain Apps",
            "Composable workflows built from shared primitives — procurement, manufacturing, quality, logistics, field service.",
            false,
          ],
          [
            "L2 · INTELLIGENCE & AGENT SPINE",
            "Intelligence & Agent Spine",
            "Specialized models, long-term memory, and per-unit build genealogy — orchestrating humans, machines, and agents.",
            true,
          ],
          [
            "L1 · DATA & CONTEXT",
            "Data & Context",
            "Connectors to ERP, PLM, MES, telemetry, and docs — plus an ontology of how your company actually works. VPC / on-prem / edge.",
            false,
          ],
        ];
        const primitives = [
          "SOPs",
          "Documents",
          "Data",
          "Agents",
          "Humans",
          "Machines",
          "Inventory",
          "Meetings",
          "Integrations",
          "Interfaces",
        ];
        return /*#__PURE__*/ React.createElement(
          "section",
          {
            style: {
              margin: "0 auto",
              maxWidth: 1180,
              padding: "88px 28px",
            },
          },
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                display: "flex",
                flexWrap: "wrap",
                alignItems: "flex-end",
                justifyContent: "space-between",
                gap: 20,
              },
            },
            /*#__PURE__*/ React.createElement(
              "div",
              null,
              /*#__PURE__*/ React.createElement(
                "span",
                {
                  style: {
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    letterSpacing: "0.08em",
                    color: "var(--faint)",
                  },
                },
                "THE ARCHITECTURE",
              ),
              /*#__PURE__*/ React.createElement(
                "h2",
                {
                  style: {
                    margin: "14px 0 0",
                    maxWidth: "20ch",
                    fontWeight: 600,
                    fontSize: "clamp(30px,4vw,52px)",
                    lineHeight: 1.02,
                    letterSpacing: "-0.035em",
                    color: "var(--ink)",
                  },
                },
                "One system that adapts to how your factory runs.",
              ),
            ),
            /*#__PURE__*/ React.createElement(
              "p",
              {
                style: {
                  maxWidth: "36ch",
                  fontSize: 15,
                  lineHeight: 1.5,
                  color: "var(--body)",
                },
              },
              "Four layers stacked on one spine. Forward-deployed work recycles into reusable primitives \u2014 a platform, never one-off code.",
            ),
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                marginTop: 44,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              },
            },
            layers.map(([tag, title, body, moat]) =>
              /*#__PURE__*/ React.createElement(
                "div",
                {
                  key: tag,
                  style: {
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: 28,
                    borderRadius: 14,
                    border: "1px solid var(--line)",
                    background: "var(--panel)",
                    padding: "26px 28px",
                  },
                },
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      minWidth: 230,
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      letterSpacing: "0.06em",
                      color: "var(--body)",
                    },
                  },
                  tag,
                ),
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      minWidth: 240,
                      flex: 1,
                    },
                  },
                  /*#__PURE__*/ React.createElement(
                    "div",
                    {
                      style: {
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      },
                    },
                    /*#__PURE__*/ React.createElement(
                      "h3",
                      {
                        style: {
                          margin: 0,
                          fontSize: 19,
                          fontWeight: 600,
                          letterSpacing: "-0.02em",
                          color: "var(--ink)",
                        },
                      },
                      title,
                    ),
                    moat &&
                      /*#__PURE__*/ React.createElement(
                        AXS.Badge,
                        {
                          tone: "lime",
                        },
                        "THE MOAT",
                      ),
                  ),
                  /*#__PURE__*/ React.createElement(
                    "p",
                    {
                      style: {
                        margin: "6px 0 0",
                        maxWidth: "74ch",
                        fontSize: 14,
                        lineHeight: 1.45,
                        color: "var(--body)",
                      },
                    },
                    body,
                  ),
                ),
              ),
            ),
          ),
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                marginTop: 40,
                borderTop: "1px solid var(--line)",
                paddingTop: 32,
              },
            },
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  marginBottom: 18,
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  letterSpacing: "0.06em",
                  color: "var(--faint)",
                },
              },
              "THE PRIMITIVES \u2014 THE ELEMENTS EVERY WORKFLOW IS BUILT FROM",
            ),
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 10,
                },
              },
              primitives.map((p) =>
                /*#__PURE__*/ React.createElement(
                  "span",
                  {
                    key: p,
                    style: {
                      borderRadius: 999,
                      border: "1px solid var(--line2)",
                      background: "var(--paper)",
                      padding: "10px 18px",
                      fontSize: 14,
                      fontWeight: 500,
                      color: "var(--ink)",
                    },
                  },
                  p,
                ),
              ),
            ),
          ),
        );
      }
      function Verticals() {
        const items = [
          ["Humanoids", "01", "MVP"],
          ["Defense", "02", "Coming soon"],
          ["Logistics", "03", "Coming soon"],
          ["Manufacturing", "04"],
          ["Construction", "05"],
          ["Healthcare", "06"],
          ["Space", "07"],
          ["Automotive", "08"],
        ];
        return /*#__PURE__*/ React.createElement(
          "section",
          {
            style: {
              margin: "0 auto",
              maxWidth: 1180,
              padding: "20px 28px 40px",
            },
          },
          /*#__PURE__*/ React.createElement(
            "div",
            {
              className: "ax-dotgrid",
              style: {
                borderRadius: 16,
                background: "var(--panel)",
                padding: "56px 40px",
              },
            },
            /*#__PURE__*/ React.createElement(
              "span",
              {
                style: {
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  letterSpacing: "0.08em",
                  color: "var(--faint)",
                },
              },
              "THE VERTICALS",
            ),
            /*#__PURE__*/ React.createElement(
              "h2",
              {
                style: {
                  margin: "14px 0 0",
                  maxWidth: "22ch",
                  fontWeight: 600,
                  fontSize: "clamp(28px,3.6vw,46px)",
                  lineHeight: 1.04,
                  letterSpacing: "-0.03em",
                  color: "var(--ink)",
                },
              },
              "One engine, proven on humanoids \u2014 then carried to every kind of robot company.",
            ),
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  marginTop: 36,
                  display: "grid",
                  gridTemplateColumns: "repeat(4,1fr)",
                  gap: 12,
                },
              },
              items.map(([name, idx, tag]) =>
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    key: idx,
                    style: {
                      position: "relative",
                      display: "flex",
                      minHeight: 96,
                      flexDirection: "column",
                      justifyContent: "space-between",
                      borderRadius: 12,
                      border: "1px solid var(--line2)",
                      background: "var(--paper)",
                      padding: "22px 20px",
                    },
                  },
                  tag &&
                    /*#__PURE__*/ React.createElement(
                      "span",
                      {
                        style: {
                          position: "absolute",
                          right: 14,
                          top: 14,
                        },
                      },
                      /*#__PURE__*/ React.createElement(
                        AXS.Badge,
                        {
                          tone: "lime",
                        },
                        tag,
                      ),
                    ),
                  /*#__PURE__*/ React.createElement(
                    "span",
                    {
                      style: {
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        color: "var(--logo)",
                      },
                    },
                    idx,
                  ),
                  /*#__PURE__*/ React.createElement(
                    "span",
                    {
                      style: {
                        fontSize: 18,
                        fontWeight: 600,
                        letterSpacing: "-0.02em",
                        color: "var(--ink)",
                      },
                    },
                    name,
                  ),
                ),
              ),
            ),
          ),
        );
      }
      function Closing() {
        return /*#__PURE__*/ React.createElement(
          "section",
          {
            id: "demo",
            style: {
              margin: "0 auto",
              maxWidth: 1180,
              padding: "0 28px 80px",
            },
          },
          /*#__PURE__*/ React.createElement(
            "div",
            {
              className: "ax-dotgrid",
              style: {
                borderRadius: 16,
                background: "var(--panel)",
                padding: "72px 28px",
                textAlign: "center",
              },
            },
            /*#__PURE__*/ React.createElement(
              "h2",
              {
                style: {
                  margin: 0,
                  fontWeight: 600,
                  fontSize: "clamp(36px,5.5vw,76px)",
                  lineHeight: 0.96,
                  letterSpacing: "-0.04em",
                  color: "var(--ink)",
                },
              },
              "Hit every build date.",
            ),
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  marginTop: 32,
                  display: "flex",
                  justifyContent: "center",
                },
              },
              /*#__PURE__*/ React.createElement(AXS.EmailCapture, null),
            ),
          ),
        );
      }
      function SiteFooter() {
        const cols = [
          [
            "PRODUCT",
            [
              "Platform",
              "Modules",
              "AI agents",
              "Integrations",
              "Security",
              "Pricing",
            ],
          ],
          [
            "SOLUTIONS",
            ["Drones", "Mobility", "Warehouse", "Industrial", "Contract mfg"],
          ],
          ["COMPANY", ["About", "Customers", "Careers", "Blog", "Contact"]],
          ["RESOURCES", ["Docs", "Guides", "ROI calculator", "Status", "FAQs"]],
        ];
        return /*#__PURE__*/ React.createElement(
          "footer",
          {
            style: {
              background: "var(--ink)",
              color: "#fff",
            },
          },
          /*#__PURE__*/ React.createElement(
            "div",
            {
              style: {
                margin: "0 auto",
                maxWidth: 1180,
                padding: "72px 28px 28px",
              },
            },
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  display: "grid",
                  gap: 32,
                  gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1fr",
                },
              },
              /*#__PURE__*/ React.createElement(
                "div",
                null,
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    style: {
                      marginBottom: 18,
                    },
                  },
                  /*#__PURE__*/ React.createElement(AXS.Wordmark, {
                    tone: "paper",
                  }),
                ),
                /*#__PURE__*/ React.createElement(
                  "p",
                  {
                    style: {
                      margin: 0,
                      maxWidth: "26ch",
                      fontSize: 13.5,
                      lineHeight: 1.6,
                      color: "rgba(255,255,255,0.55)",
                    },
                  },
                  "The AI-native operating system for companies building robots.",
                ),
              ),
              cols.map(([head, links]) =>
                /*#__PURE__*/ React.createElement(
                  "div",
                  {
                    key: head,
                  },
                  /*#__PURE__*/ React.createElement(
                    "h2",
                    {
                      style: {
                        margin: "0 0 16px",
                        fontSize: 12,
                        fontWeight: 600,
                        letterSpacing: "0.04em",
                        color: "rgba(255,255,255,0.5)",
                      },
                    },
                    head,
                  ),
                  /*#__PURE__*/ React.createElement(
                    "ul",
                    {
                      style: {
                        margin: 0,
                        padding: 0,
                        listStyle: "none",
                        display: "flex",
                        flexDirection: "column",
                        gap: 11,
                        fontSize: 13.5,
                        color: "rgba(255,255,255,0.7)",
                      },
                    },
                    links.map((l) =>
                      /*#__PURE__*/ React.createElement(
                        "li",
                        {
                          key: l,
                        },
                        /*#__PURE__*/ React.createElement(
                          "a",
                          {
                            href: "#",
                            style: {
                              color: "inherit",
                              textDecoration: "none",
                            },
                          },
                          l,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
            /*#__PURE__*/ React.createElement(
              "div",
              {
                style: {
                  marginTop: 52,
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  borderTop: "1px solid rgba(255,255,255,0.1)",
                  paddingTop: 24,
                },
              },
              /*#__PURE__*/ React.createElement(
                "span",
                {
                  style: {
                    fontSize: 12.5,
                    color: "rgba(255,255,255,0.45)",
                  },
                },
                "\xA9 2026 Axona, Inc. \xB7 Placeholder wordmark \u2014 swap with your logo",
              ),
              /*#__PURE__*/ React.createElement(
                AXS.Button,
                {
                  href: "#demo",
                },
                "See a demo",
              ),
            ),
          ),
        );
      }
      Object.assign(window, {
        Platform,
        Architecture,
        Verticals,
        Closing,
        SiteFooter,
      });
    })();
  } catch (e) {
    __ds_ns.__errors.push({
      path: "ui_kits/website/sections.jsx",
      error: String((e && e.message) || e),
    });
  }

  __ds_ns.ArrowLink = __ds_scope.ArrowLink;

  __ds_ns.Badge = __ds_scope.Badge;

  __ds_ns.Button = __ds_scope.Button;

  __ds_ns.MonoChip = __ds_scope.MonoChip;

  __ds_ns.Pill = __ds_scope.Pill;

  __ds_ns.StatChip = __ds_scope.StatChip;

  __ds_ns.Wordmark = __ds_scope.Wordmark;

  __ds_ns.FeatureCard = __ds_scope.FeatureCard;

  __ds_ns.Skel = __ds_scope.Skel;

  __ds_ns.StatTile = __ds_scope.StatTile;

  __ds_ns.EmailCapture = __ds_scope.EmailCapture;

  __ds_ns.Select = __ds_scope.Select;

  __ds_ns.Toggle = __ds_scope.Toggle;
})();
