export default function TitleDisplay({ label }) {
  return (
    <div className="flex items-center justify-center w-[95%]">
      <p className="font-bold text-white text-center" style={{ fontSize: '12vw' }}>{label}</p>
    </div>
  );
}
