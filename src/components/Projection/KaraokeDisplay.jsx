export default function KaraokeDisplay({ lines, lineIdx }) {
  const prev = lines[lineIdx - 1] || '';
  const active = lines[lineIdx] || '';
  const next = lines[lineIdx + 1] || '';

  return (
    <div className="flex flex-col items-center justify-center gap-6 w-[95%] text-center">
      <p className="text-white/40 transition-all duration-500" style={{ fontSize: '4.5vw', minHeight: '5.5vw' }}>
        {prev}
      </p>
      <p className="font-bold text-white transition-all duration-300 leading-tight" style={{ fontSize: '10vw', minHeight: '12vw' }}>
        {active}
      </p>
      <p className="text-white/40 transition-all duration-500" style={{ fontSize: '4.5vw', minHeight: '5.5vw' }}>
        {next}
      </p>
    </div>
  );
}
