import { YuliClient, StateVector, DownloadProgress } from '../src/index';

const statusBadge = document.getElementById('runtime-status-badge')!;
const progressContainer = document.getElementById('progress-container')!;
const progressBar = document.getElementById('progress-bar')!;
const progressPct = document.getElementById('progress-pct')!;
const chatContainer = document.getElementById('chat-container')!;
const thoughtText = document.getElementById('thought-text')!;
const thoughtStatus = document.getElementById('thought-status')!;
const activeCoordinatePill = document.getElementById('active-coordinate-pill')!;
const promptForm = document.getElementById('prompt-form') as HTMLFormElement;
const userInput = document.getElementById('user-input') as HTMLInputElement;
const sendBtn = document.getElementById('send-btn') as HTMLButtonElement;
const clearBtn = document.getElementById('clear-btn') as HTMLButtonElement;

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

function appendBubble(role: 'user' | 'assistant', initialText: string = '', state?: StateVector): HTMLElement {
  const msgWrapper = document.createElement('div');
  msgWrapper.className = `flex flex-col ${role === 'user' ? 'items-end' : 'items-start'}`;

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
  return bubble;
}

const client = new YuliClient({
  workerUrl: new URL('../src/worker.ts', import.meta.url).href,
  maxHistoryTurns: 6,
  onStatusChange: (status: string) => {
    statusBadge.textContent = status;
  },
  onDownloadProgress: (progress: DownloadProgress) => {
    progressContainer.classList.remove('hidden');
    progressBar.style.width = `${progress.pct}%`;
    progressPct.textContent = `${progress.pct}%`;
    if (progress.pct >= 100) {
      setTimeout(() => progressContainer.classList.add('hidden'), 1200);
    }
  }
});

async function boot() {
  try {
    statusBadge.textContent = 'Mounting Engine...';
    await client.init();
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
    appendBubble('assistant', `Runtime initialization failure: ${err.message}`);
  }
}

async function handleGenerate(promptText: string) {
  if (!promptText.trim()) return;

  appendBubble('user', promptText);
  userInput.value = '';
  userInput.disabled = true;
  sendBtn.disabled = true;

  const yuliBubble = appendBubble('assistant', '');
  thoughtText.textContent = '';
  thoughtStatus.textContent = 'deliberating...';

  try {
    await client.prompt(promptText, {
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
    thoughtStatus.textContent = 'resolved';
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

document.querySelectorAll('.preset-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const prompt = btn.getAttribute('data-prompt');
    if (prompt) handleGenerate(prompt);
  });
});

boot();
