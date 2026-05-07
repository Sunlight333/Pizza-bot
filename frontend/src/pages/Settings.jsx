import AnimatedPage from '@/components/layout/AnimatedPage'
import BotPersonality from '@/components/settings/BotPersonality'
import BotSimulator from '@/components/settings/BotSimulator'
import DatacaixaSync from '@/components/settings/DatacaixaSync'
import EvolutionConfig from '@/components/settings/EvolutionConfig'
import MenuImages from '@/components/settings/MenuImages'

export default function Settings() {
  return (
    <AnimatedPage className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DatacaixaSync />
        <EvolutionConfig />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BotPersonality />
        <BotSimulator />
      </div>
      <MenuImages />
    </AnimatedPage>
  )
}
