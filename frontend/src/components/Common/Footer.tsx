export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t py-4 px-6">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          PanamaCompliance SGDDR &mdash; {currentYear}
        </p>
        <p className="text-muted-foreground/70 text-xs">
          Ley 23/2015 &middot; Ley 254/2021
        </p>
      </div>
    </footer>
  )
}
