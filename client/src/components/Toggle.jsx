/**
 * Toggle — switch reutilizable
 *
 * Props:
 *   enabled  {boolean}  estado actual
 *   onChange {function} callback(newValue: boolean)
 *   disabled {boolean}  bloquea interacción
 *   size     {'sm'|'md'} tamaño (default 'md')
 */
export default function Toggle({ enabled, onChange, disabled = false, size = 'md' }) {
  const sizes = {
    sm: { track: 'h-5 w-9',   thumb: 'h-3.5 w-3.5', on: 'translate-x-5', off: 'translate-x-0.5' },
    md: { track: 'h-6 w-11',  thumb: 'h-4 w-4',      on: 'translate-x-6', off: 'translate-x-1'   },
  }
  const s = sizes[size] ?? sizes.md

  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!enabled)}
      disabled={disabled}
      className={[
        'relative inline-flex items-center rounded-full transition-colors focus:outline-none shrink-0',
        s.track,
        enabled  ? 'bg-primary'  : 'bg-gray-300',
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
      ].join(' ')}
    >
      <span className={[
        'inline-block rounded-full bg-white shadow transition-transform',
        s.thumb,
        enabled ? s.on : s.off,
      ].join(' ')} />
    </button>
  )
}
