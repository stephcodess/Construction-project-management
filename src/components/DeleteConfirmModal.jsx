import { AlertTriangle, X } from 'lucide-react'

export default function DeleteConfirmModal({ title, description, onConfirm, onCancel, loading }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: '#FFF0F0' }}>
              <AlertTriangle className="w-5 h-5" style={{ color: '#CC0000' }} />
            </div>
            <div>
              <h3 className="font-black text-base" style={{ color: '#1C1C1C' }}>
                {title ?? 'Delete this item?'}
              </h3>
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                {description ?? 'This action cannot be undone.'}
              </p>
            </div>
          </div>
          <button onClick={onCancel} className="text-gray-300 hover:text-gray-500 transition ml-3 shrink-0 mt-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Divider */}
        <div className="h-px mx-6" style={{ background: '#F0F0F0' }} />

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4">
          <button
            onClick={onCancel}
            className="px-5 py-2.5 rounded-xl text-sm font-bold border-2 transition"
            style={{ borderColor: '#E5E5E5', color: '#555' }}
            onMouseEnter={e => e.currentTarget.style.background = '#F5F5F5'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition disabled:opacity-60"
            style={{ background: '#CC0000' }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#AA0000' }}
            onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#CC0000' }}
          >
            {loading ? 'Deleting…' : 'Yes, Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}
