import { YuliClient, StateVector, DownloadProgress, TelemetryStats, parseModelResponse } from '../src/index';

const statusBadge = document.getElementById('runtime-status-badge')!;
const downloadInterstitial = document.getElementById('download-interstitial')!;
const interstitialBar = document.getElementById('interstitial-bar')!;
const interstitialPct = document.getElementById('interstitial-pct')!;
const interstitialBytes = document.getElementById('interstitial-bytes')!;
const interstitialStatus = document.getElementById('interstitial-status-text')!;
const chatContainer = document.getElementById('chat-container')!;
const thoughtText = document.getElementById('thought-text')!;
const thoughtStatus = document.getElementById('thought-status')!;
const activeCoordinatePill = document.getElementById('active-coordinate-pill')!;
const promptForm = document.getElementById('prompt-form') as HTMLFormElement;
const userInput = document.getElementById('user-input') as HTMLInputElement;
const sendBtn = document.getElementById('send-btn') as HTMLButtonElement;
const clearBtn = document.getElementById('clear-btn') as HTMLButtonElement;
const clearCacheBtn = document.getElementById('clear-cache-btn') as HTMLButtonElement | null;
const debugLogEntries = document.getElementById('debug-log-entries')!;
const debugLogCount = document.getElementById('debug-log-count')!;
const latestTpsPill = document.getElementById('latest-tps-pill')!;
const copyAllDebugBtn = document.getElementById('copy-all-debug-btn') as HTMLButtonElement | null;
const debugEmptyPlaceholder = document.getElementById('debug-empty-placeholder');

interface DebugTurnEntry {
  turn: number;
  timestamp: string;
  prompt: string;
  dialogue: string;
  rawResponse: string;
  state: StateVector;
  telemetry: TelemetryStats;
}

const debugLogHistory: DebugTurnEntry[] = [];

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function copyToClipboard(text: string, buttonElement?: HTMLElement): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      textArea.remove();
    }

    if (buttonElement) {
      const originalText = buttonElement.innerHTML;
      buttonElement.innerHTML = '✓ Copied!';
      buttonElement.classList.add('bg-emerald-700', 'text-emerald-100', 'border-emerald-500');
      buttonElement.classList.remove('bg-neutral-800', 'text-neutral-200', 'text-neutral-300');
      setTimeout(() => {
        buttonElement.innerHTML = originalText;
        buttonElement.classList.remove('bg-emerald-700', 'text-emerald-100', 'border-emerald-500');
        buttonElement.classList.add('bg-neutral-800', 'text-neutral-200');
      }, 2000);
    }
    return true;
  } catch (err) {
    console.error('Failed to copy to clipboard', err);
    if (buttonElement) {
      buttonElement.textContent = '❌ Failed';
      setTimeout(() => { buttonElement.textContent = 'Copy Raw'; }, 2000);
    }
    return false;
  }
}

const hudCards: Record<string, HTMLElement> = {
  EGO: document.getElementById('hud-ego')!,
  SHADOW: document.getElementById('hud-shadow')!,
  SUBCONSCIOUS: document.getElementById('hud-subconscious')!,
  SUPEREGO: document.getElementById('hud-superego')!
};

function updateHUD(state: StateVector) {
  Object.keys(hudCards).forEach((quadrant) => {
    const card = hudCards[quadrant];
    if (quadrant === state.quadrant) {
      card.classList.add('border-amber-500', 'bg-neutral-800');
      card.classList.remove('border-neutral-800', 'bg-neutral-900/50');
    } else {
      card.classList.remove('border-amber-500', 'bg-neutral-800');
      card.classList.add('border-neutral-800', 'bg-neutral-900/50');
    }
  });
  activeCoordinatePill.textContent = `NODE: <s:${state.hex}> (${state.quadrant})`;
}

function appendBubbleWithWrapper(role: 'user' | 'assistant', initialText: string = '', state?: StateVector) {
  const msgWrapper = document.createElement('div');
  msgWrapper.className = `flex flex-col ${role === 'user' ? 'items-end' : 'items-start'} max-w-full`;

  const meta = document.createElement('span');
  meta.className = 'text-[9px] text-neutral-500 mb-0.5 uppercase tracking-wider';
  meta.textContent = role === 'user' ? 'YOU' : `YULI ${state ? `(${state.quadrant})` : ''}`;

  const bubble = document.createElement('div');
  bubble.className = role === 'user'
    ? 'bg-amber-500/15 border border-amber-500/30 text-amber-100 text-xs px-3 py-2 rounded-lg max-w-[85%] whitespace-pre-wrap'
    : 'bg-neutral-950 border border-neutral-800 text-neutral-200 text-xs px-3 py-2 rounded-lg max-w-[85%] whitespace-pre-wrap leading-relaxed';
  bubble.textContent = initialText;

  msgWrapper.appendChild(meta);
  msgWrapper.appendChild(bubble);
  chatContainer.appendChild(msgWrapper);
  chatContainer.scrollTop = chatContainer.scrollHeight;
  return { bubble, wrapper: msgWrapper };
}

function appendBubble(role: 'user' | 'assistant', initialText: string = '', state?: StateVector): HTMLElement {
  return appendBubbleWithWrapper(role, initialText, state).bubble;
}

function addDebugLogEntry(entry: DebugTurnEntry) {
  debugLogHistory.push(entry);
  if (debugEmptyPlaceholder) {
    debugEmptyPlaceholder.remove();
  }

  debugLogCount.textContent = `${debugLogHistory.length} prompt${debugLogHistory.length === 1 ? '' : 's'}`;
  latestTpsPill.textContent = `TPS: ${entry.telemetry.tokensPerSecond}`;

  const card = document.createElement('div');
  card.className = 'p-2.5 rounded bg-neutral-950 border border-neutral-800/80 flex flex-col gap-2 font-mono-code text-[10px]';

  const header = document.createElement('div');
  header.className = 'flex flex-wrap items-center justify-between gap-1 border-b border-neutral-800/60 pb-1.5';
  header.innerHTML = `
    <div class="flex items-center gap-2">
      <span class="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold">TURN #${entry.turn}</span>
      <span class="text-neutral-400 font-medium truncate max-w-[280px]">"${escapeHtml(entry.prompt)}"</span>
    </div>
    <span class="text-neutral-500 text-[9px]">${entry.timestamp}</span>
  `;

  const telemetryRow = document.createElement('div');
  telemetryRow.className = 'flex flex-wrap items-center gap-1.5 text-neutral-300';
  telemetryRow.innerHTML = `
    <span class="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold">
      ⚡ ${entry.telemetry.tokensPerSecond} TPS
    </span>
    <span class="px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-300">
      ⏱️ TTFT: ${entry.telemetry.ttftMs}ms
    </span>
    <span class="px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-400">
      ⏳ Latency: ${entry.telemetry.totalTimeMs}ms
    </span>
    <span class="px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-400">
      🔢 ${entry.telemetry.tokensGenerated} tokens
    </span>
    <span class="px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-400">
      📍 &lt;s:${entry.state.hex}&gt; (${entry.state.quadrant})
    </span>
  `;

  const rawSection = document.createElement('div');
  rawSection.className = 'flex flex-col gap-1.5';

  const actionRow = document.createElement('div');
  actionRow.className = 'flex items-center justify-between';
  actionRow.innerHTML = `
    <span class="text-neutral-500 text-[9px] uppercase font-bold tracking-wider">Complete Raw Response Buffer:</span>
    <button class="entry-copy-raw-btn px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-colors">
      📋 Copy Raw Response
    </button>
  `;

  const rawPre = document.createElement('pre');
  rawPre.className = 'p-2 rounded bg-neutral-900/90 border border-neutral-800 text-neutral-300 text-[10px] whitespace-pre-wrap select-all max-h-32 overflow-y-auto';
  rawPre.textContent = entry.rawResponse;

  const copyBtn = actionRow.querySelector('.entry-copy-raw-btn') as HTMLElement;
  copyBtn.addEventListener('click', () => {
    copyToClipboard(entry.rawResponse, copyBtn);
  });

  rawSection.appendChild(actionRow);
  rawSection.appendChild(rawPre);

  card.appendChild(header);
  card.appendChild(telemetryRow);
  card.appendChild(rawSection);

  debugLogEntries.prepend(card);
}

const client = new YuliClient({
  workerUrl: new URL('../src/worker.ts', import.meta.url).href,
  maxHistoryTurns: 6,
  onStatusChange: (status: string) => {
    statusBadge.textContent = status;
    if (!downloadInterstitial.classList.contains('hidden')) {
      interstitialStatus.textContent = status;
    }
  },
  onDownloadProgress: (progress: DownloadProgress) => {
    downloadInterstitial.classList.remove('hidden');
    interstitialBar.style.width = `${progress.pct}%`;
    interstitialPct.textContent = `${progress.pct}%`;
    const loadedMB = (progress.bytesLoaded / (1024 * 1024)).toFixed(1);
    const totalMB = progress.totalBytes > 0 ? (progress.totalBytes / (1024 * 1024)).toFixed(1) : '~380';
    interstitialBytes.textContent = `${loadedMB} MB / ${totalMB} MB`;
    interstitialStatus.textContent = `Streaming GGUF into OPFS (${loadedMB}MB / ${totalMB}MB)...`;
  }
});

async function boot() {
  try {
    statusBadge.textContent = 'Checking Cache...';

    // Games and apps can determine whether the GGUF model is cached in OPFS:
    const isCached = await client.isModelCached();
    if (!isCached) {
      // First boot: show download interstitial overlay with progress bar
      downloadInterstitial.classList.remove('hidden');
      interstitialStatus.textContent = 'Preparing download (~380MB GGUF)...';
    } else {
      statusBadge.textContent = 'Mounting Engine...';
    }

    await client.init();

    if (!downloadInterstitial.classList.contains('hidden')) {
      interstitialStatus.textContent = 'Download Complete! Launching Persona HUD...';
      interstitialBar.style.width = '100%';
      interstitialPct.textContent = '100%';
      setTimeout(() => {
        downloadInterstitial.classList.add('hidden');
      }, 500);
    }

    statusBadge.textContent = 'ONLINE';
    statusBadge.classList.remove('text-neutral-400', 'border-neutral-700');
    statusBadge.classList.add('text-emerald-400', 'border-emerald-500/50', 'bg-emerald-950/30');

    userInput.disabled = false;
    sendBtn.disabled = false;
    userInput.focus();
    appendBubble('assistant', 'Hey. What are we working on in the kitchen today?');
  } catch (err: any) {
    statusBadge.textContent = 'ERROR';
    statusBadge.classList.add('text-red-400', 'border-red-500');
    if (!downloadInterstitial.classList.contains('hidden')) {
      interstitialStatus.textContent = `Download/Init failure: ${err.message}`;
    }
    appendBubble('assistant', `Runtime initialization failure: ${err.message}`);
  }
}

let turnCounter = 0;

async function handleGenerate(promptText: string) {
  if (!promptText.trim()) return;

  turnCounter++;
  const currentTurn = turnCounter;
  const timestamp = new Date().toLocaleTimeString();

  appendBubble('user', promptText);
  userInput.value = '';
  userInput.disabled = true;
  sendBtn.disabled = true;

  const { bubble: yuliBubble, wrapper: msgWrapper } = appendBubbleWithWrapper('assistant', '');
  thoughtText.textContent = '';
  thoughtStatus.textContent = 'deliberating...';

  try {
    const result = await client.prompt(promptText, {
      onToken: (tok: string) => {
        yuliBubble.textContent += tok;
        chatContainer.scrollTop = chatContainer.scrollHeight;
      },
      onThought: (th: string) => {
        thoughtText.textContent += th;
      },
      onState: (st: StateVector) => {
        updateHUD(st);
      }
    });

    const parsed = parseModelResponse(result.rawText);
    yuliBubble.textContent = parsed.dialogue;
    if (parsed.thought) {
      thoughtText.textContent = parsed.thought;
    }
    thoughtStatus.textContent = 'resolved';

    // Build inline telemetry bar and copy raw button under Yuli's response bubble
    const telemetryWidget = document.createElement('div');
    telemetryWidget.className = 'mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-neutral-400 font-mono-code';
    telemetryWidget.innerHTML = `
      <span class="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold">
        ⚡ ${result.telemetry.tokensPerSecond} TPS
      </span>
      <span class="px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-300">
        ⏱️ TTFT: ${result.telemetry.ttftMs}ms
      </span>
      <span class="px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-400">
        ⏳ ${result.telemetry.totalTimeMs}ms
      </span>
      <span class="px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-400">
        🔢 ${result.telemetry.tokensGenerated} tok
      </span>
      <button class="inline-copy-raw-btn px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-colors flex items-center gap-1 font-bold">
        📋 Copy Raw
      </button>
      <button class="inline-toggle-raw-btn px-1.5 py-0.5 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-400 border border-neutral-800 transition-colors">
        Raw ▾
      </button>
    `;

    const rawBox = document.createElement('div');
    rawBox.className = 'hidden mt-1.5 p-2 rounded bg-neutral-950 border border-neutral-800 text-[10px] text-neutral-300 font-mono-code whitespace-pre-wrap select-all max-h-36 overflow-y-auto w-full max-w-[85%]';
    rawBox.textContent = result.rawText;

    const inlineCopyBtn = telemetryWidget.querySelector('.inline-copy-raw-btn') as HTMLElement;
    inlineCopyBtn.addEventListener('click', () => {
      copyToClipboard(result.rawText, inlineCopyBtn);
    });

    const inlineToggleBtn = telemetryWidget.querySelector('.inline-toggle-raw-btn') as HTMLElement;
    inlineToggleBtn.addEventListener('click', () => {
      const isHidden = rawBox.classList.toggle('hidden');
      inlineToggleBtn.textContent = isHidden ? 'Raw ▾' : 'Hide ▴';
      chatContainer.scrollTop = chatContainer.scrollHeight;
    });

    msgWrapper.appendChild(telemetryWidget);
    msgWrapper.appendChild(rawBox);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    // Record into the Debug Log Drawer
    addDebugLogEntry({
      turn: currentTurn,
      timestamp,
      prompt: promptText,
      dialogue: parsed.dialogue,
      rawResponse: result.rawText,
      state: result.state,
      telemetry: result.telemetry
    });

  } catch (err: any) {
    yuliBubble.textContent = `[Inference Error: ${err.message}]`;
    thoughtStatus.textContent = 'aborted';
  } finally {
    userInput.disabled = false;
    sendBtn.disabled = false;
    userInput.focus();
  }
}

promptForm.addEventListener('submit', (e) => {
  e.preventDefault();
  handleGenerate(userInput.value);
});

clearBtn.addEventListener('click', () => {
  client.resetHistory();
  chatContainer.innerHTML = '';
  appendBubble('assistant', 'Conversation context reset. Ready for a new shift.');
});

copyAllDebugBtn?.addEventListener('click', () => {
  if (debugLogHistory.length === 0) {
    alert('No debug logs available to copy yet.');
    return;
  }
  const formatted = JSON.stringify(debugLogHistory, null, 2);
  copyToClipboard(formatted, copyAllDebugBtn);
});

clearCacheBtn?.addEventListener('click', async () => {
  if (confirm('Clear the cached GGUF model from OPFS? The page will reload and show the download interstitial.')) {
    await client.clearCachedModel();
    window.location.reload();
  }
});

document.querySelectorAll('.preset-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const prompt = btn.getAttribute('data-prompt');
    if (prompt) handleGenerate(prompt);
  });
});

boot();

