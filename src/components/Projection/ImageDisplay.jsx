export default function ImageDisplay({ imageData }) {
  if (!imageData) {
    return (
      <div className="flex flex-col items-center justify-center gap-4">
        <span className="text-8xl text-white/20">🖼</span>
        <p className="text-white/30 text-2xl">Sin imagen</p>
      </div>
    );
  }
  return (
    <img
      src={imageData}
      alt=""
      className="max-w-full max-h-full object-contain"
    />
  );
}
