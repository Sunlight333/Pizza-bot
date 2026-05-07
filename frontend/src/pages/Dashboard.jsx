import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import { DollarSign, ShoppingBag, TrendingUp, Clock } from 'lucide-react'

import AnimatedPage from '@/components/layout/AnimatedPage'
import CountUp from '@/components/ui/CountUp'
import OrderGlobe from '@/components/3d/OrderGlobe'
import ParticleBackground from '@/components/3d/ParticleBackground'
import HealthWidget from '@/components/dashboard/HealthWidget'
import LiveOrderFeed from '@/components/dashboard/LiveOrderFeed'
import PeakHoursHeatmap from '@/components/dashboard/PeakHoursHeatmap'
import { ordersApi } from '@/services/orders'
import { useLiveOrders } from '@/hooks/useLiveOrders'
import { useChartPalette } from '@/hooks/useChartPalette'
import { ASSETS } from '@/utils/assets'

const brl = (n) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n) || 0)

function StatsCard({ icon: Icon, label, value, format, tint = 'primary' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-5 relative overflow-hidden"
    >
      <div
        className={`absolute -top-6 -right-6 w-24 h-24 rounded-full blur-3xl opacity-30 ${
          tint === 'accent' ? 'bg-accent' : tint === 'success' ? 'bg-success' : 'bg-primary'
        }`}
      />
      <div className="flex items-center justify-between relative">
        <div>
          <div className="text-xs uppercase text-white/50 tracking-wide">{label}</div>
          <div className="font-display text-3xl mt-2">
            {format === 'brl' ? (
              <CountUp value={value} format={(n) => brl(n)} />
            ) : (
              <CountUp value={value} format={(n) => Math.round(n).toString()} />
            )}
          </div>
        </div>
        <div
          className={`p-3 rounded-xl ${
            tint === 'accent'
              ? 'bg-accent/20 text-accent'
              : tint === 'success'
              ? 'bg-success/20 text-success'
              : 'bg-primary/20 text-primary'
          }`}
        >
          <Icon size={20} />
        </div>
      </div>
    </motion.div>
  )
}

export default function Dashboard() {
  useLiveOrders()

  const { data: stats } = useQuery({
    queryKey: ['order-stats'],
    queryFn: ordersApi.stats,
    refetchInterval: 30_000,
  })

  const revenueData = (stats?.revenue_7d || []).map((d) => ({
    label: new Date(d.date).toLocaleDateString('pt-BR', { weekday: 'short' }),
    revenue: Number(d.revenue || 0),
  }))

  const chartPalette = useChartPalette()

  return (
    <AnimatedPage className="space-y-4 relative">
      <ParticleBackground className="opacity-50" />

      {/* Hero banner */}
      <div className="relative h-32 md:h-40 rounded-2xl overflow-hidden border border-glass-border">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${ASSETS.backgrounds.dashboardHero})` }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, rgba(15,15,35,0.85) 0%, rgba(15,15,35,0.55) 60%, rgba(15,15,35,0.2) 100%)',
          }}
        />
        <div className="relative h-full flex flex-col justify-center px-6">
          <h2 className="font-display text-2xl md:text-3xl">Olá, bem-vindo de volta 👋</h2>
          <p className="text-white/60 text-sm mt-1 max-w-md">
            Acompanhe pedidos em tempo real, receita do dia e o status da integração com Datacaixa e WhatsApp.
          </p>
        </div>
      </div>

      <HealthWidget />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatsCard icon={ShoppingBag} label="Pedidos hoje" value={stats?.orders_today ?? 0} />
        <StatsCard
          icon={DollarSign}
          label="Receita hoje"
          value={stats?.revenue_today ?? 0}
          format="brl"
          tint="accent"
        />
        <StatsCard
          icon={TrendingUp}
          label="Ticket médio"
          value={stats?.avg_ticket ?? 0}
          format="brl"
          tint="success"
        />
        <StatsCard
          icon={Clock}
          label="Sync pendentes"
          value={stats?.sync_pending ?? 0}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass-card p-5 lg:col-span-2">
          <h3 className="font-display mb-4">Receita (últimos 7 dias)</h3>
          <div className="h-56">
            {revenueData.length === 0 ? (
              <div className="text-white/40 text-sm h-full flex items-center justify-center">
                Sem dados ainda
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData}>
                  <defs>
                    <linearGradient id="grad-rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chartPalette.stroke} stopOpacity={0.6} />
                      <stop offset="100%" stopColor={chartPalette.stroke} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={chartPalette.grid} vertical={false} />
                  <XAxis dataKey="label" stroke={chartPalette.axis} fontSize={11} />
                  <YAxis stroke={chartPalette.axis} fontSize={11} tickFormatter={(v) => `R$${v.toFixed(0)}`} />
                  <Tooltip
                    contentStyle={{
                      background: chartPalette.tooltipBg,
                      border: `1px solid ${chartPalette.tooltipBorder}`,
                      borderRadius: 12,
                      backdropFilter: 'blur(12px)',
                      fontSize: 12,
                      color: chartPalette.tooltipFg,
                    }}
                    labelStyle={{ color: chartPalette.tooltipFg }}
                    itemStyle={{ color: chartPalette.tooltipFg }}
                    formatter={(v) => brl(v)}
                  />
                  <Area type="monotone" dataKey="revenue" stroke={chartPalette.stroke} fill="url(#grad-rev)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="glass-card p-5 flex flex-col">
          <h3 className="font-display mb-2">Pedidos (visualização)</h3>
          <div className="flex-1 min-h-[200px]">
            <OrderGlobe orderCount={stats?.orders_today ?? 0} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <PeakHoursHeatmap data={stats?.by_dow_hour || []} />
        </div>
        <LiveOrderFeed limit={8} />
      </div>
    </AnimatedPage>
  )
}
