const LOGO_URL = "https://cdn-image.jolink.co.id/logosmk.png"

export function SchoolLogo({ className }: { className?: string }) {
  return (
    <img
      src={LOGO_URL}
      alt="Logo Sekolah"
      className={className}
      onError={(event) => {
        event.currentTarget.style.visibility = "hidden"
      }}
    />
  )
}
