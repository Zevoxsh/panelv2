import { useState } from 'react'
import { Save } from 'lucide-react'

const inputCls = 'w-full bg-black/20 border border-admin-border/50 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-teal/50 transition-colors'

export default function SettingsPage() {
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    panelName: 'Pterodactyl Panel',
    panelUrl: window.location.origin,
    timezone: 'UTC',
    analyticsEnabled: false,
  })

  function handleSave() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 text-sm mt-0.5">Panel configuration and preferences</p>
      </div>

      <div className="space-y-6 max-w-2xl">
        <div className="bg-admin-surface border border-admin-border/50 rounded-xl p-6 space-y-5">
          <p className="text-white font-semibold text-sm">General</p>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Panel Name</label>
            <input
              value={form.panelName}
              onChange={e => setForm(f => ({ ...f, panelName: e.target.value }))}
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Panel URL</label>
            <input
              value={form.panelUrl}
              onChange={e => setForm(f => ({ ...f, panelUrl: e.target.value }))}
              className={inputCls}
            />
            <p className="text-gray-600 text-xs mt-1">The public URL of this panel</p>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Timezone</label>
            <select
              value={form.timezone}
              onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}
              className={inputCls}
            >
              <option value="UTC">UTC</option>
              <option value="America/New_York">America/New_York</option>
              <option value="America/Los_Angeles">America/Los_Angeles</option>
              <option value="Europe/London">Europe/London</option>
              <option value="Europe/Paris">Europe/Paris</option>
              <option value="Asia/Tokyo">Asia/Tokyo</option>
            </select>
          </div>
        </div>

        <div className="bg-admin-surface border border-admin-border/50 rounded-xl p-6 space-y-4">
          <p className="text-white font-semibold text-sm">Privacy</p>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.analyticsEnabled}
              onChange={e => setForm(f => ({ ...f, analyticsEnabled: e.target.checked }))}
              className="mt-0.5 accent-teal"
            />
            <div>
              <p className="text-gray-200 text-sm font-medium">Usage Analytics</p>
              <p className="text-gray-500 text-xs mt-0.5">Help improve the panel by sharing anonymous usage data</p>
            </div>
          </label>
        </div>

        <button
          onClick={handleSave}
          className="flex items-center gap-2 bg-teal hover:opacity-90 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-opacity"
        >
          <Save size={14} />
          {saved ? 'Saved ✓' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}
