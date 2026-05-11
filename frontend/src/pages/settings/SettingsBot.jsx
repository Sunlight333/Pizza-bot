import AnimatedPage from '@/components/layout/AnimatedPage'
import BotPersonality from '@/components/settings/BotPersonality'
import BotSimulator from '@/components/settings/BotSimulator'

export default function SettingsBot() {
  return (
    <AnimatedPage className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <BotPersonality />
      <BotSimulator />
    </AnimatedPage>
  )
}
