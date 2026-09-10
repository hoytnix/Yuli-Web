# Product Context: @yuli-ai/web

## Problem Statement
Traditional AI NPC and persona runtimes rely on cloud LLM APIs, incurring recurrent API costs, high network latency (300ms–2s+), offline failure modes, and potential privacy leaks.

## Value Proposition
- **Zero-Marginal-Cost Edge AI**: 100% on-device model execution eliminating cloud inference bills.
- **In-Game Dynamic NPC Dialogue**: Immediate token responses integrated directly into client rendering pipelines without UI thread stutter.
- **Procedural CYOA Branching**: Real-time narrative choice evaluation driven by cognitive state transitions.
- **Game Loop Hooks**: Seamless event listeners (`onToken`, `onState`, `onThought`, `onComplete`) allowing easy integration into game loops and frontend UI state machines.
