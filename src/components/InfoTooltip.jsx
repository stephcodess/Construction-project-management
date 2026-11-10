import { useState } from 'react'
import { Info } from 'lucide-react'

export default function InfoTooltip({ text, size = 13 }) {
  const [show, setShow] = useState(false)

  return (
    <span className="relative inline-flex items-center ml-1 align-middle">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        className="text-gray-300 hover:text-gray-500 transition-colors focus:outline-none"
        tabIndex={-1}
        aria-label="More information"
      >
        <Info style={{ width: size, height: size }} />
      </button>

      {show && (
        <span
          className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 rounded-xl px-3 py-2.5 text-xs leading-relaxed shadow-xl pointer-events-none"
          style={{ background: '#1C1C1C', color: '#E5E5E5', border: '1px solid #333' }}
        >
          {text}
          {/* Arrow */}
          <span
            className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent"
            style={{ borderTopColor: '#1C1C1C' }}
          />
        </span>
      )}
    </span>
  )
}
