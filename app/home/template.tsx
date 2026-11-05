// Remounts on every screen change under /home, so switching tabs fades the new
// screen in instead of snapping. Opacity only, and short: tabs change often.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-fade-in">{children}</div>;
}
