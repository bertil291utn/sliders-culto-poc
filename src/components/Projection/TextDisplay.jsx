export default function TextDisplay({ content, label }) {
  const paragraphs = content ? content.split('\n').filter(Boolean) : [];

  return (
    <div className="flex flex-col items-center justify-center gap-4 w-[95%] text-center">
      {label && (
        <p className="text-white/50 font-medium" style={{ fontSize: '3.5vw' }}>{label}</p>
      )}
      {paragraphs.map((line, i) => (
        <p key={i} className="font-bold text-white leading-relaxed" style={{ fontSize: '8vw' }}>
          {line}
        </p>
      ))}
    </div>
  );
}
