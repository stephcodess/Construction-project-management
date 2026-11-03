import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export function usePagination(data, pageSize = 15) {
  const [page, setPage] = useState(1)

  const total = data?.length ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * pageSize
  const paginated = data?.slice(start, start + pageSize) ?? []

  function reset() { setPage(1) }

  return { page: safePage, setPage, totalPages, paginated, total, reset }
}

export default function Pagination({ page, totalPages, total, pageSize, onPageChange }) {
  if (totalPages <= 1) return null

  const start = (page - 1) * pageSize + 1
  const end   = Math.min(page * pageSize, total)

  const pages = []
  const delta = 2
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - delta && i <= page + delta)) {
      pages.push(i)
    } else if (i === page - delta - 1 || i === page + delta + 1) {
      pages.push('...')
    }
  }
  const cleaned = pages.filter((p, i) => !(p === '...' && pages[i - 1] === '...'))

  const btn = 'w-8 h-8 flex items-center justify-center rounded-lg text-sm font-semibold transition-all'

  return (
    <div className="flex items-center justify-between px-5 py-3 border-t"
      style={{ borderColor: '#F0F0F0' }}>
      <p className="text-xs text-gray-400">
        Showing <span className="font-bold text-gray-600">{start}–{end}</span> of{' '}
        <span className="font-bold text-gray-600">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className={`${btn} text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed`}>
          <ChevronLeft className="w-4 h-4" />
        </button>
        {cleaned.map((p, i) =>
          p === '...' ? (
            <span key={`el-${i}`} className="w-8 h-8 flex items-center justify-center text-xs text-gray-400">…</span>
          ) : (
            <button key={p} onClick={() => onPageChange(p)} className={btn}
              style={p === page ? { background: '#CC0000', color: 'white' } : { color: '#555' }}
              onMouseEnter={e => { if (p !== page) e.currentTarget.style.background = '#F5F5F5' }}
              onMouseLeave={e => { if (p !== page) e.currentTarget.style.background = 'transparent' }}>
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className={`${btn} text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed`}>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
