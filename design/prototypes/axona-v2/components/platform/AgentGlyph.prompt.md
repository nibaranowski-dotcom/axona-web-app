The Axona agent mark — the single visual that says "an agent did this." A static ring of 12 dots, used everywhere an agent is represented. Never animate it (a rotating/fading version reads as a loading spinner — that was explicitly rejected).

```jsx
<AgentGlyph size={30} />                                  // chat header
<AgentGlyph size={22} status="var(--success)" ring="active" />  // avatar switcher, selected + live
<AgentGlyph size={24} status="var(--ink-strong)" />      // critical-state agent
```

Status dot colors follow the palette: `var(--success)` = live/healthy, `var(--accent)` = working/attention, `var(--ink-strong)` = critical. Use `ring="active"` for the selected agent in a switcher, `ring="idle"` for the rest.
