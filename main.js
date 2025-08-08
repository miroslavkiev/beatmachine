// Sick Beat Machine
// Web Audio API drum synth + 16-step sequencer

const ctx = new (window.AudioContext || window.webkitAudioContext)();
const masterGain = ctx.createGain();
masterGain.gain.value = 0.9;

const lpf = ctx.createBiquadFilter();
lpf.type = "lowpass";
lpf.frequency.value = 10000;

const drive = ctx.createWaveShaper();
function makeDrive(amount){
  const n = 65536;
  const curve = new Float32Array(n);
  const k = amount * 100;
  const deg = Math.PI / 180;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}
drive.curve = makeDrive(0);

// Feedback delay
const delay = ctx.createDelay(1.0);
delay.delayTime.value = 0.25;
const delayFeedback = ctx.createGain();
delayFeedback.gain.value = 0.3;
const delayMix = ctx.createGain();
delayMix.gain.value = 0.15;

masterGain.connect(lpf);
lpf.connect(drive);
drive.connect(ctx.destination);

// delay send
drive.connect(delay);
delay.connect(delayFeedback);
delayFeedback.connect(delay);
delay.connect(delayMix);
delayMix.connect(ctx.destination);

// Also route to MediaStream for recording
const mediaDest = ctx.createMediaStreamDestination();
drive.connect(mediaDest);

// Tracks
const steps = 16;
const tracks = ["kick","snare","hat","bass"];
const state = {
  bpm: 120,
  swing: 0.1,
  step: 0,
  running: false,
  grid: {
    kick: Array(steps).fill(false),
    snare: Array(steps).fill(false),
    hat: Array(steps).fill(false),
    bass: Array(steps).fill(false),
  },
  vol: {kick:.9, snare:.8, hat:.6, bass:.7},
  params: {
    kickDecay: 0.35,
    snareNoise: 0.7,
    hatDecay: 0.07,
    bassCutoff: 800,
    bassQ: 6,
    masterCutoff: 10000,
    delayMix: 0.15,
    delayTime: 0.25,
    drive: 0.0
  }
};

// UI
const stepsEl = document.getElementById("steps");
const legend = ["KICK","SNARE","HAT","BASS"];
for(let r=0;r<tracks.length;r++){
  for(let c=0;c<steps;c++){
    const btn = document.createElement("button");
    btn.className = "step";
    btn.dataset.track = tracks[r];
    btn.dataset.index = c;
    btn.addEventListener("click", () => {
      const t = btn.dataset.track;
      const i = Number(btn.dataset.index);
      state.grid[t][i] = !state.grid[t][i];
      btn.classList.toggle("on", state.grid[t][i]);
    });
    stepsEl.appendChild(btn);
  }
}

// Controls
const bpmEl = document.getElementById("bpm");
const swingEl = document.getElementById("swing");
const masterCutoffEl = document.getElementById("masterCutoff");
const delayMixEl = document.getElementById("delayMix");
const delayTimeEl = document.getElementById("delayTime");
const driveEl = document.getElementById("drive");

bpmEl.addEventListener("input", e => state.bpm = Number(e.target.value));
swingEl.addEventListener("input", e => state.swing = Number(e.target.value));
masterCutoffEl.addEventListener("input", e => lpf.frequency.value = Number(e.target.value));
delayMixEl.addEventListener("input", e => { delayMix.gain.value = Number(e.target.value); state.params.delayMix = delayMix.gain.value; });
delayTimeEl.addEventListener("input", e => { delay.delayTime.value = Number(e.target.value); state.params.delayTime = delay.delayTime.value; });
driveEl.addEventListener("input", e => { drive.curve = makeDrive(Number(e.target.value)); state.params.drive = Number(e.target.value); });

// Channel params
document.querySelectorAll(".vol").forEach(inp => {
  inp.addEventListener("input", e => {
    const t = e.target.dataset.track;
    state.vol[t] = Number(e.target.value);
  });
});
document.getElementById("kickDecay").addEventListener("input", e => state.params.kickDecay = Number(e.target.value));
document.getElementById("snareNoise").addEventListener("input", e => state.params.snareNoise = Number(e.target.value));
document.getElementById("hatDecay").addEventListener("input", e => state.params.hatDecay = Number(e.target.value));
document.getElementById("bassCutoff").addEventListener("input", e => state.params.bassCutoff = Number(e.target.value));
document.getElementById("bassQ").addEventListener("input", e => state.params.bassQ = Number(e.target.value));

// Start/Stop
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
startBtn.addEventListener("click", start);
stopBtn.addEventListener("click", stop);
document.body.addEventListener("keydown", (e) => {
  if(e.code === "Space"){
    e.preventDefault();
    state.running ? stop() : start();
  }
});

// Shuffle/Clear
document.getElementById("shuffleBtn").addEventListener("click", () => {
  tracks.forEach(t => {
    for(let i=0;i<steps;i++){
      state.grid[t][i] = Math.random() < (t==="hat" ? 0.6 : t==="snare" ? (i%4===2 ? 0.7 : 0.15) : t==="kick" ? (i%4===0 ? 0.8 : 0.2) : 0.25);
    }
  });
  refreshGrid();
});
document.getElementById("clearBtn").addEventListener("click", () => {
  tracks.forEach(t => state.grid[t].fill(false));
  refreshGrid();
});

// Save/Load
document.getElementById("saveBtn").addEventListener("click", () => {
  localStorage.setItem("sick-beat", JSON.stringify(state));
});
document.getElementById("loadBtn").addEventListener("click", () => {
  const s = localStorage.getItem("sick-beat");
  if(!s) return;
  const obj = JSON.parse(s);
  // Only copy known keys
  ["bpm","swing","grid","vol","params"].forEach(k => { if(obj[k] !== undefined) state[k] = obj[k]; });
  bpmEl.value = state.bpm;
  swingEl.value = state.swing;
  masterCutoffEl.value = state.params.masterCutoff ?? masterCutoffEl.value;
  delayMixEl.value = state.params.delayMix ?? delayMixEl.value;
  delayTimeEl.value = state.params.delayTime ?? delayTimeEl.value;
  driveEl.value = state.params.drive ?? 0;
  refreshGrid();
});

function refreshGrid(){
  document.querySelectorAll(".step").forEach(btn => {
    const t = btn.dataset.track;
    const i = Number(btn.dataset.index);
    btn.classList.toggle("on", !!state.grid[t][i]);
  });
}

// Synths
function playKick(time){
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const decay = state.params.kickDecay;
  o.type = "sine";
  o.frequency.setValueAtTime(150, time);
  o.frequency.exponentialRampToValueAtTime(45, time + decay);
  g.gain.setValueAtTime(state.vol.kick, time);
  g.gain.exponentialRampToValueAtTime(0.0001, time + decay);
  o.connect(g).connect(drive);
  o.start(time);
  o.stop(time + decay + 0.02);
}
function whiteNoiseBuffer(){
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 1.0, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for(let i=0;i<data.length;i++) data[i] = Math.random()*2 - 1;
  return buffer;
}
const noiseBuf = whiteNoiseBuffer();
function playSnare(time){
  const g = ctx.createGain();
  const n = ctx.createBufferSource();
  const tone = ctx.createOscillator();
  n.buffer = noiseBuf;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(state.params.snareNoise * state.vol.snare, time);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.2);

  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 1800;
  bp.Q.value = 0.7;

  tone.type = "triangle";
  tone.frequency.setValueAtTime(180, time);
  const toneGain = ctx.createGain();
  toneGain.gain.setValueAtTime(0.4 * state.vol.snare, time);
  toneGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.1);

  n.connect(bp).connect(noiseGain).connect(drive);
  tone.connect(toneGain).connect(drive);

  n.start(time);
  tone.start(time);
  n.stop(time + 0.21);
  tone.stop(time + 0.12);
}

function playHat(time){
  const n = ctx.createBufferSource();
  n.buffer = noiseBuf;
  const hpf = ctx.createBiquadFilter();
  hpf.type = "highpass";
  hpf.frequency.value = 7000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(state.vol.hat, time);
  g.gain.exponentialRampToValueAtTime(0.0001, time + state.params.hatDecay);
  n.connect(hpf).connect(g).connect(drive);
  n.start(time);
  n.stop(time + state.params.hatDecay + 0.02);
}

function playBass(time, note){
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = state.params.bassCutoff;
  f.Q.value = state.params.bassQ;
  o.type = "sawtooth";
  o.frequency.value = note;
  g.gain.setValueAtTime(state.vol.bass, time);
  g.gain.exponentialRampToValueAtTime(0.0001, time + 0.3);
  o.connect(f).connect(g).connect(drive);
  o.start(time);
  o.stop(time + 0.31);
}

const bassScale = [43.65, 49.00, 58.27, 65.41]; // E1, G1, A#1, C2 (approx)

// Sequencer
let nextNoteTime = 0;
let timerID;
const scheduleAheadTime = 0.1;
const lookahead = 25; // ms

function nextStepTime(){
  const secPerBeat = 60 / state.bpm;
  let stepLen = 0.25 * secPerBeat; // 16th
  // swing every odd step
  if (state.step % 2 === 1) stepLen += state.swing * 0.5 * stepLen;
  nextNoteTime += stepLen;
  state.step = (state.step + 1) % steps;
}

function scheduler(){
  while(nextNoteTime < ctx.currentTime + scheduleAheadTime){
    scheduleStep(state.step, nextNoteTime);
    nextStepTime();
  }
  timerID = window.setTimeout(scheduler, lookahead);
}

function scheduleStep(step, when){
  // UI highlight
  const all = [...document.querySelectorAll(".step")];
  all.forEach(btn => btn.classList.toggle("playing", Number(btn.dataset.index) === step));

  if(state.grid.kick[step]) playKick(when);
  if(state.grid.snare[step]) playSnare(when);
  if(state.grid.hat[step]) playHat(when);
  if(state.grid.bass[step]) {
    const idx = (step % bassScale.length);
    playBass(when, bassScale[idx]);
  }
}

async function start(){
  if(state.running) return;
  await ctx.resume();
  state.running = true;
  startBtn.disabled = true;
  stopBtn.disabled = false;
  nextNoteTime = ctx.currentTime + 0.05;
  scheduler();
}
function stop(){
  if(!state.running) return;
  state.running = false;
  startBtn.disabled = false;
  stopBtn.disabled = true;
  window.clearTimeout(timerID);
  document.querySelectorAll(".step").forEach(b => b.classList.remove("playing"));
}

// Recording
const exportBtn = document.getElementById("exportAudioBtn");
const dl = document.getElementById("downloadLink");
let mediaRecorder;
let recChunks = [];

exportBtn.addEventListener("click", () => {
  if(mediaRecorder && mediaRecorder.state === "recording"){
    mediaRecorder.stop();
    exportBtn.textContent = "Record";
    return;
  }
  const stream = mediaDest.stream;
  mediaRecorder = new MediaRecorder(stream);
  recChunks = [];
  mediaRecorder.ondataavailable = e => e.data.size && recChunks.push(e.data);
  mediaRecorder.onstop = async () => {
    const blob = new Blob(recChunks, {type: "audio/webm"});
    const url = URL.createObjectURL(blob);
    dl.href = url;
    dl.classList.remove("hidden");
    dl.click();
    setTimeout(()=>URL.revokeObjectURL(url), 15000);
  };
  mediaRecorder.start();
  exportBtn.textContent = "Stop Rec";
});
