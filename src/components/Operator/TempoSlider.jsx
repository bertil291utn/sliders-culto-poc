const MIN = 1;
const MAX = 10;

// Slider position → tempo in seconds (inverted: right = faster = fewer seconds)
function posToTempo(pos) { return MAX + MIN - pos; }
function tempoToPos(tempo) { return MAX + MIN - tempo; }

export default function TempoSlider({ tempo, onChange, disabled = false }) {
  return (
    <div className={`flex flex-col gap-1 ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
      <div className="flex items-center justify-between">
        <label className="text-sm text-gray-400">Velocidad karaoke — solo canción</label>
        <span className="text-sm font-mono text-white">{tempo}s/línea</span>
      </div>
      <input
        type="range"
        min={MIN}
        max={MAX}
        step={0.5}
        value={tempoToPos(tempo)}
        onChange={(e) => onChange(posToTempo(Number(e.target.value)))}
        className="w-full accent-indigo-500"
        disabled={disabled}
      />
      <div className="flex justify-between text-xs text-gray-500">
        <span>Lento</span>
        <span>Rápido</span>
      </div>
    </div>
  );
}
