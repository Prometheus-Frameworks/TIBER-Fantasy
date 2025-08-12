export default function Footer() {
  return (
    <footer className="border-t border-line bg-white">
      <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-body">
        © {new Date().getFullYear()} On The Clock
      </div>
    </footer>
  );
}