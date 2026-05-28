export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t py-4 px-6">
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: "#4a6080" }}>
          PanamaCompliance SGDDR &mdash; {currentYear}
        </p>
        <p className="text-xs" style={{ color: "#2a3a50" }}>
          Ley 23/2015 &middot; Ley 254/2021
        </p>
      </div>
    </footer>
  )
}
